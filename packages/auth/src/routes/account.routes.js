import { Router } from 'express';
import { GuestAccount } from '../models/GuestAccount.js';
import { hashPassword, passwordProblem, verifyPassword } from '../lib/passwords.js';
import { problems, validate } from '../lib/validation.js';
import { requireRole } from '../lib/identity.js';

/**
 * The guest's own account: their name, phone number and password, and the
 * deletion that erases their personal details.
 *
 * Deletion never runs ahead of the money. A future confirmed booking is
 * cancelled and refunded through PayPal first; while a refund is unconfirmed
 * nothing is erased, the account stays active and the guest is told which
 * booking is outstanding.
 */
export function createAccountRouter(config) {
  const router = Router();
  router.use(requireRole('guest'));

  const loadGuest = async (req, res) => {
    const guest = await GuestAccount.findById(req.user.id).select('+password_hash');
    if (!guest || guest.status === 'deleted') {
      res.status(401).json({ error: 'Not signed in' });
      return null;
    }
    return guest;
  };

  const callBookings = async (path, body) => {
    const response = await fetch(new URL(path, config.bookingsUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-token': config.internalToken },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error ?? 'The bookings service could not complete that');
      error.status = response.status;
      throw error;
    }
    return payload;
  };

  // ------------------------------------------------- name and phone number ----
  router.patch('/', async (req, res, next) => {
    try {
      const guest = await loadGuest(req, res);
      if (!guest) return undefined;

      const body = req.body ?? {};
      // The email address carries the confirmation state, so it is not
      // changeable here - and a request that tries is refused rather than
      // quietly ignored.
      if (body.email && String(body.email).toLowerCase() !== guest.email) {
        return res.status(400).json({ error: 'The email address on your account cannot be changed here.' });
      }

      const errors = validate({
        full_name: () => problems.fullName(body.full_name ?? guest.full_name),
        phone_number: () => problems.phone(body.phone_number ?? guest.phone_number),
      });
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the form', errors });

      if (body.full_name !== undefined) guest.full_name = String(body.full_name).trim();
      if (body.phone_number !== undefined) guest.phone_number = String(body.phone_number).trim();
      await guest.save();
      res.json({ account: guest.toPublic() });
    } catch (error) { next(error); }
  });

  // ------------------------------------------------------------- password -----
  router.post('/password', async (req, res, next) => {
    try {
      const guest = await loadGuest(req, res);
      if (!guest) return undefined;

      const current = String(req.body?.current_password ?? '');
      const next_ = String(req.body?.new_password ?? '');
      const ok = await verifyPassword(current, guest.password_hash);
      if (!ok) {
        return res.status(403).json({
          error: 'Your password was not changed',
          code: 'wrong_password',
          errors: { current_password: 'Check your current password and type it again.' },
        });
      }
      const issue = passwordProblem(next_);
      if (issue) return res.status(400).json({ error: issue, errors: { new_password: issue } });

      guest.password_hash = await hashPassword(next_);
      await guest.save();
      res.json({ changed: true });
    } catch (error) { next(error); }
  });

  // ------------------------------------------------------------- deletion -----
  router.delete('/', async (req, res, next) => {
    try {
      const guest = await loadGuest(req, res);
      if (!guest) return undefined;

      const password = String(req.body?.password ?? '');
      const ok = await verifyPassword(password, guest.password_hash);
      if (!ok) {
        return res.status(403).json({
          error: 'That password is not correct',
          code: 'wrong_password',
          errors: { password: 'Check your password and enter it again.' },
        });
      }

      // Cancel and refund every future confirmed booking. The bookings service
      // answers only once PayPal has reported each refund completed, or names
      // the booking whose refund is outstanding.
      let outcome;
      try {
        outcome = await callBookings('/internal/guest-deletion', { guestAccountId: String(guest._id) });
      } catch (error) {
        return res.status(502).json({
          error: `Your account was not deleted: ${error.message}`,
          code: 'refund_unconfirmed',
        });
      }
      if (!outcome.refundsConfirmed) {
        return res.status(409).json({
          error: 'Your account was not deleted',
          code: 'refund_unconfirmed',
          outstanding: outcome.outstanding ?? [],
          message: 'PayPal has not confirmed every refund, so nothing has been erased and you are still signed in.',
        });
      }

      // Past bookings stay for accounting with the personal details removed and
      // the link to this account cleared, then the account itself goes.
      await callBookings('/internal/guest-anonymise', { guestAccountId: String(guest._id) });
      await GuestAccount.deleteOne({ _id: guest._id });
      res.status(204).end();
    } catch (error) { next(error); }
  });

  return router;
}
