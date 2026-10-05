import { Router } from 'express';
import mongoose from 'mongoose';
import { GuestAccount } from '../models/GuestAccount.js';
import { StaffAccount } from '../models/StaffAccount.js';
import { createToken, inviteLink } from '../lib/tokens.js';
import { inviteEmail, sendMail } from '../lib/mailer.js';
import { problems, validate } from '../lib/validation.js';
import { requireRole } from '../lib/identity.js';

/**
 * The hotel's staff accounts: every account has exactly the same full access,
 * any signed-in staff member may add a colleague, and a colleague sets their
 * own password from the emailed link. Staff accounts are never deleted or
 * deactivated.
 */
export function createTeamRouter(config) {
  const router = Router();
  router.use(requireRole('hotel_staff'));

  router.get('/', async (req, res, next) => {
    try {
      const staff = await StaffAccount.find({}).sort({ added_at: 1 });
      const byId = new Map(staff.map((member) => [String(member._id), member.full_name]));
      res.json({
        members: staff.map((member) => member.toPublic(
          member.added_by_staff_account_id ? byId.get(String(member.added_by_staff_account_id)) ?? null : null,
        )),
      });
    } catch (error) { next(error); }
  });

  router.post('/', async (req, res, next) => {
    try {
      const fullName = req.body?.full_name;
      const email = req.body?.email;
      const errors = validate({
        full_name: () => problems.fullName(fullName),
        email: () => problems.email(email),
      });
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the form', errors });

      const address = String(email).trim().toLowerCase();
      const [staffTaken, guestTaken] = await Promise.all([
        StaffAccount.findOne({ email: address }),
        GuestAccount.findOne({ email: address }),
      ]);
      if (staffTaken || guestTaken) {
        return res.status(409).json({
          error: 'That email address already belongs to a staff or guest account',
          code: 'email_taken',
          errors: { email: 'This email address already belongs to a staff or guest account. Enter a different email address.' },
        });
      }

      const { token, expiresAt } = createToken(config.inviteHours);
      const member = await StaffAccount.create({
        full_name: String(fullName).trim(),
        email: address,
        invite_token: token,
        invite_expires_at: expiresAt,
        added_by_staff_account_id: req.user.id,
        added_at: new Date(),
        status: 'invited',
      });

      let mail = { status: 'sent' };
      try {
        await sendMail(
          { to: member.email, ...inviteEmail({
            hotelName: config.mail.hotelName,
            fullName: member.full_name,
            invitedBy: req.user.name || 'A colleague',
            link: inviteLink(token, config.siteUrl),
          }) },
          config,
        );
      } catch (error) {
        mail = { status: 'failed', error: error.message };
      }

      res.status(201).json({ member: member.toPublic(req.user.name || null), mail });
    } catch (error) { next(error); }
  });

  // ------------------------------------------------- the invitation, again ----
  // An invitation that did not reach the colleague is re-sent from here: the link
  // is issued afresh, works once, and expires after the invitation window. The
  // account itself is untouched — it stays invited until the colleague sets a
  // password of their own.
  router.post('/:memberId/invite', async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.memberId)) {
        return res.status(404).json({ error: 'That staff account is not one of ours' });
      }
      const member = await StaffAccount.findById(req.params.memberId);
      if (!member) return res.status(404).json({ error: 'That staff account is not one of ours' });
      if (member.status === 'active') {
        return res.status(409).json({
          error: 'That colleague already has a password',
          code: 'already_active',
        });
      }

      const { token, expiresAt } = createToken(config.inviteHours);
      member.invite_token = token;
      member.invite_expires_at = expiresAt;
      await member.save();

      let mail = { status: 'sent' };
      try {
        await sendMail(
          { to: member.email, ...inviteEmail({
            hotelName: config.mail.hotelName,
            fullName: member.full_name,
            invitedBy: req.user.name || 'A colleague',
            link: inviteLink(token, config.siteUrl),
          }) },
          config,
        );
      } catch (error) {
        mail = { status: 'failed', error: error.message };
      }

      res.json({ member: member.toPublic(req.user.name || null), mail });
    } catch (error) { next(error); }
  });

  return router;
}
