import { Router } from 'express';
import mongoose from 'mongoose';
import { GuestAccount } from '../models/GuestAccount.js';

/**
 * The door the bookings service knocks on: one guest account's name, email and
 * confirmation state, so a booking can be refused for an unconfirmed address
 * and written with the guest's own details.
 *
 * Mounted under `/internal/...`, which the gateway never proxies, and every
 * call carries the shared token.
 */
export function createInternalRouter(config) {
  const router = Router();
  router.use((req, res, next) => {
    if (req.get('x-internal-token') !== config.internalToken) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    next();
  });

  router.get('/guests/:guestAccountId', async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.guestAccountId)) {
        return res.status(404).json({ error: 'That account is not one of ours.' });
      }
      const guest = await GuestAccount.findById(req.params.guestAccountId);
      if (!guest || guest.status === 'deleted') {
        return res.status(404).json({ error: 'That account is not one of ours.' });
      }
      res.json({
        guest: {
          id: String(guest._id),
          full_name: guest.full_name,
          email: guest.email,
          email_confirmed: Boolean(guest.email_confirmed),
        },
      });
    } catch (error) { next(error); }
  });

  return router;
}
