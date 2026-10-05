import { Router } from 'express';
import mongoose from 'mongoose';
import { Booking } from '../models/Booking.js';
import { Payment } from '../models/Payment.js';
import { requireInternal } from '../lib/identity.js';
import { getRefund, refundCapture, PayPalError } from '../lib/paypal.js';

const DAY_MS = 86400000;

/**
 * The doors other services knock on. They are mounted under `/internal/...`,
 * a prefix the gateway never proxies, and every call carries the shared token.
 *
 * Nothing here is a shortcut around a rule: the guest-deletion door is the
 * place the money is settled before an account is erased.
 */
export function createInternalRouter(config) {
  const router = Router();
  router.use(requireInternal(config));

  /**
   * How many rooms of each room type are occupied on each night.
   * The rooms service counts its own rooms and blocks; this is the booked part.
   */
  router.get('/booked-counts', async (req, res, next) => {
    try {
      const checkIn = new Date(`${String(req.query.check_in ?? '').slice(0, 10)}T00:00:00.000Z`);
      const checkOut = new Date(`${String(req.query.check_out ?? '').slice(0, 10)}T00:00:00.000Z`);
      if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
        return res.status(400).json({ error: 'check_in and check_out are required' });
      }
      const filter = {
        status: { $in: ['confirmed', 'pending_payment'] },
        check_in_date: { $lt: checkOut },
        check_out_date: { $gt: checkIn },
      };
      if (req.query.room_type_ids) {
        const ids = String(req.query.room_type_ids).split(',').filter((id) => mongoose.isValidObjectId(id));
        filter.room_type_id = { $in: ids };
      }

      const bookings = await Booking.find(filter).select('room_type_id check_in_date check_out_date status hold_expires_at released_at');
      const now = new Date();
      const counts = new Map();
      for (const booking of bookings) {
        if (!booking.occupies(now)) continue; // an abandoned hold stops occupying its room
        const from = Math.max(booking.check_in_date.getTime(), checkIn.getTime());
        const to = Math.min(booking.check_out_date.getTime(), checkOut.getTime());
        for (let at = from; at < to; at += DAY_MS) {
          const night = new Date(at).toISOString().slice(0, 10);
          const key = `${String(booking.room_type_id)}|${night}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }

      res.json({
        counts: [...counts.entries()].map(([key, rooms]) => {
          const [roomTypeId, night] = key.split('|');
          return { room_type_id: roomTypeId, night, rooms };
        }),
      });
    } catch (error) { next(error); }
  });

  /**
   * Cancel every future confirmed booking of a guest and refund it in full.
   * The answer is honest: `refundsConfirmed` is true only when PayPal has
   * reported every refund completed, and `outstanding` names what is not.
   */
  router.post('/guest-deletion', async (req, res, next) => {
    try {
      const guestAccountId = String(req.body?.guestAccountId ?? '');
      if (!mongoose.isValidObjectId(guestAccountId)) return res.status(400).json({ error: 'A guest account id is required' });

      const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
      const bookings = await Booking.find({
        booked_by_guest_account_id: guestAccountId,
        status: 'confirmed',
        check_out_date: { $gte: today },
      }).sort({ check_in_date: 1 });

      const outstanding = [];
      for (const booking of bookings) {
        const charge = await Payment.findOne({ booking_id: booking._id, type: 'charge', status: 'completed' });
        if (!charge) {
          outstanding.push({ reference: booking.booking_reference, reason: 'no completed payment to refund' });
          continue;
        }
        const deadline = Date.now() + config.refundConfirmationSeconds * 1000;
        let confirmed = false;
        try {
          const attempt = await refundCapture(config, { transactionId: charge.paypal_transaction_id });
          const payment = await Payment.create({
            booking_id: booking._id,
            paypal_transaction_id: attempt.id,
            amount: charge.amount,
            type: 'refund',
            status: attempt.completed ? 'completed' : 'pending',
            note: 'Refunded in full before the account was deleted',
          });
          confirmed = attempt.completed;
          // PayPal can answer before the refund has finished; keep asking until
          // the confirmation window closes.
          while (!confirmed && Date.now() < deadline && attempt.id) {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            const read = await getRefund(config, attempt.id);
            confirmed = read.completed;
            if (confirmed) {
              payment.status = 'completed';
              await payment.save();
            }
          }
        } catch (error) {
          confirmed = false;
          await Payment.create({
            booking_id: booking._id,
            amount: charge.amount,
            type: 'refund',
            status: 'failed',
            note: error instanceof PayPalError ? error.message : 'The refund could not be requested',
          });
        }

        if (confirmed) {
          booking.status = 'cancelled';
          await booking.save();
        } else {
          outstanding.push({ reference: booking.booking_reference, amount: charge.amount });
        }
      }

      res.json({ refundsConfirmed: outstanding.length === 0, outstanding, checked: bookings.length });
    } catch (error) { next(error); }
  });

  /** Past bookings stay for accounting, with the guest's personal details gone. */
  router.post('/guest-anonymise', async (req, res, next) => {
    try {
      const guestAccountId = String(req.body?.guestAccountId ?? '');
      if (!mongoose.isValidObjectId(guestAccountId)) return res.status(400).json({ error: 'A guest account id is required' });
      const result = await Booking.updateMany(
        { booked_by_guest_account_id: guestAccountId },
        {
          $set: {
            lead_guest_name: 'Deleted guest',
            guest_email: '',
            contact_phone: '',
            special_requests: '',
          },
          $unset: { booked_by_guest_account_id: 1 },
        },
      );
      res.json({ cleaned: result.modifiedCount ?? 0 });
    } catch (error) { next(error); }
  });

  return router;
}
