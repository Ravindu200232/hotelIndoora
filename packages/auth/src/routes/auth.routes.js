import { Router } from 'express';
import { GuestAccount } from '../models/GuestAccount.js';
import { StaffAccount } from '../models/StaffAccount.js';
import { hashPassword, passwordProblem, verifyPassword } from '../lib/passwords.js';
import { confirmationLink, createToken, isExpired } from '../lib/tokens.js';
import { confirmationEmail, sendMail } from '../lib/mailer.js';
import { problems, validate } from '../lib/validation.js';
import { caller } from '../lib/identity.js';

export function createAuthRouter(config) {
  const router = Router();

  const refused = (res) => res.status(401).json({
    error: 'That email and password do not match',
    code: 'invalid_credentials',
  });

  /** Guest and staff share one sign-in form, so both are looked for here. */
  const findAccountByEmail = async (email) => {
    const guest = await GuestAccount.findOne({ email }).select('+password_hash');
    if (guest) return { kind: 'guest', account: guest };
    const staff = await StaffAccount.findOne({ email }).select('+password_hash');
    if (staff) return { kind: 'staff', account: staff };
    return null;
  };

  // ---------------------------------------------------------------- register --
  router.post('/register', async (req, res, next) => {
    try {
      const { full_name: fullName, email, password } = req.body ?? {};
      const errors = validate({
        full_name: () => problems.fullName(fullName),
        email: () => problems.email(email),
      });
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the form', errors });

      const passwordIssue = passwordProblem(password);
      if (passwordIssue) return res.status(400).json({ error: passwordIssue, errors: { password: passwordIssue } });

      const address = String(email).trim().toLowerCase();
      // An address belongs to one account in the whole hotel: guest and staff
      // share the one sign-in form, so it may not exist in either place.
      const [guestTaken, staffTaken] = await Promise.all([
        GuestAccount.findOne({ email: address }),
        StaffAccount.findOne({ email: address }),
      ]);
      if (guestTaken || staffTaken) {
        return res.status(409).json({
          error: 'That email address is already registered',
          code: 'email_taken',
          errors: { email: 'This address already has an account. Sign in with it, or enter another address.' },
        });
      }

      const { token, expiresAt } = createToken(config.confirmationHours);
      const account = await GuestAccount.create({
        full_name: String(fullName).trim(),
        email: address,
        password_hash: await hashPassword(password),
        email_confirmed: false,
        email_confirmation_token: token,
        email_confirmation_expires_at: expiresAt,
      });

      let mail = { status: 'sent' };
      try {
        await sendMail(
          { to: account.email, ...confirmationEmail({
            hotelName: config.mail.hotelName,
            fullName: account.full_name,
            link: confirmationLink(token, config.siteUrl),
          }) },
          config,
        );
      } catch (error) {
        // The account exists and the guest can ask for another email, so this
        // is reported rather than rolled back - and never silently ignored.
        mail = { status: 'failed', error: error.message };
      }

      res.status(201).json({ account: account.toPublic(), mail });
    } catch (error) { next(error); }
  });

  // ----------------------------------------------------------- confirm email --
  router.post('/confirm-email', async (req, res, next) => {
    try {
      const token = String(req.body?.token ?? '').trim();
      if (!token) return res.status(400).json({ error: 'That confirmation link is not complete.' });
      const account = await GuestAccount.findOne({ email_confirmation_token: token });
      if (!account) return res.status(404).json({ error: 'That confirmation link is not one of ours.' });
      if (isExpired(account.email_confirmation_expires_at)) {
        return res.status(410).json({ error: 'That confirmation link has run out. Ask for another.', code: 'link_expired' });
      }
      account.email_confirmed = true;
      account.email_confirmation_token = undefined;
      account.email_confirmation_expires_at = undefined;
      await account.save();
      res.json({ account: account.toPublic() });
    } catch (error) { next(error); }
  });

  // ------------------------------------------------------- resend confirmation --
  router.post('/resend-confirmation', async (req, res, next) => {
    try {
      const address = String(req.body?.email ?? '').trim().toLowerCase();
      const account = await GuestAccount.findOne({ email: address, status: 'active' });
      // The answer never says whether the address has an account.
      if (!account) return res.json({ sent: true, remaining: null });

      if (account.email_confirmed) {
        return res.json({ sent: false, alreadyConfirmed: true, remaining: null });
      }

      const now = Date.now();
      const windowStart = account.resend_window_started_at ? new Date(account.resend_window_started_at).getTime() : 0;
      const insideWindow = windowStart && now - windowStart < 60 * 60 * 1000;
      const used = insideWindow ? account.resend_count : 0;
      if (used >= config.resendLimitPerHour) {
        const retryAt = new Date(windowStart + 60 * 60 * 1000);
        return res.status(429).json({
          error: 'You have reached the limit for now',
          code: 'resend_limit',
          retryAt,
          remaining: 0,
        });
      }

      const { token, expiresAt } = createToken(config.confirmationHours);
      account.email_confirmation_token = token;
      account.email_confirmation_expires_at = expiresAt;
      account.resend_count = used + 1;
      account.resend_window_started_at = insideWindow ? account.resend_window_started_at : new Date(now);
      await account.save();

      try {
        await sendMail(
          { to: account.email, ...confirmationEmail({
            hotelName: config.mail.hotelName,
            fullName: account.full_name,
            link: confirmationLink(token, config.siteUrl),
          }) },
          config,
        );
      } catch (error) {
        return res.status(502).json({
          error: `We could not send the confirmation email: ${error.message}`,
          code: 'mail_failed',
        });
      }

      res.json({
        sent: true,
        remaining: config.resendLimitPerHour - account.resend_count,
        retryAt: new Date(new Date(account.resend_window_started_at).getTime() + 60 * 60 * 1000),
      });
    } catch (error) { next(error); }
  });

  // -------------------------------------------------------------------- login --
  router.post('/login', async (req, res, next) => {
    try {
      const address = String(req.body?.email ?? '').trim().toLowerCase();
      const password = String(req.body?.password ?? '');
      if (!address || !password) return refused(res);

      const found = await findAccountByEmail(address);
      if (!found) return refused(res);
      const { account, kind } = found;

      if (kind === 'guest' && account.status === 'deleted') return refused(res);
      if (kind === 'staff' && account.status !== 'active') {
        return res.status(403).json({
          error: 'That account has not set its password yet. Open the link in your invitation.',
          code: 'invite_pending',
        });
      }

      if (account.locked_until && new Date(account.locked_until).getTime() > Date.now()) {
        return res.status(429).json({
          error: 'Too many attempts. Try again in a few minutes.',
          code: 'locked',
          lockedUntil: account.locked_until,
        });
      }

      const ok = await verifyPassword(password, account.password_hash);
      if (!ok) {
        account.failed_attempts = (account.failed_attempts ?? 0) + 1;
        if (account.failed_attempts >= config.signInAttempts) {
          account.locked_until = new Date(Date.now() + config.lockoutMinutes * 60 * 1000);
          account.failed_attempts = 0;
        }
        await account.save();
        return refused(res);
      }

      if (kind === 'guest' && !account.email_confirmed) {
        return res.status(403).json({
          error: 'Your email address is not confirmed yet',
          code: 'email_unconfirmed',
        });
      }

      account.failed_attempts = 0;
      account.locked_until = undefined;
      await account.save();

      res.json({ account: account.toPublic() });
    } catch (error) { next(error); }
  });

  // -------------------------------------------------------------- session ------
  router.get('/session', async (req, res, next) => {
    try {
      const who = caller(req);
      if (!who) return res.status(401).json({ error: 'Not signed in' });
      if (who.role === 'hotel_staff') {
        const staff = await StaffAccount.findById(who.id);
        if (!staff) return res.status(401).json({ error: 'Not signed in' });
        return res.json({ account: staff.toPublic() });
      }
      const guest = await GuestAccount.findById(who.id);
      if (!guest || guest.status === 'deleted') return res.status(401).json({ error: 'Not signed in' });
      res.json({ account: guest.toPublic() });
    } catch (error) { next(error); }
  });

  // --------------------------------------------------------- staff password ----
  router.post('/staff/password-setup', async (req, res, next) => {
    try {
      const token = String(req.body?.token ?? '').trim();
      const password = String(req.body?.password ?? '');
      if (!token) return res.status(400).json({ error: 'That invitation link is not complete.' });
      const issue = passwordProblem(password);
      if (issue) return res.status(400).json({ error: issue, errors: { password: issue } });

      const staff = await StaffAccount.findOne({ invite_token: token }).select('+password_hash');
      if (!staff) {
        return res.status(404).json({ error: 'That invitation has already been used. Ask for a new one.', code: 'invite_used' });
      }
      if (isExpired(staff.invite_expires_at)) {
        return res.status(410).json({ error: 'That invitation has run out. Ask for a new one.', code: 'invite_expired' });
      }
      staff.password_hash = await hashPassword(password);
      staff.invite_token = undefined;
      staff.invite_expires_at = undefined;
      staff.status = 'active';
      await staff.save();
      res.json({ account: staff.toPublic() });
    } catch (error) { next(error); }
  });

  return router;
}
