import { Router } from 'express';
import { Booking } from '../models/Booking.js';
import { Payment } from '../models/Payment.js';
import { verifyWebhook, PayPalError } from '../lib/paypal.js';
import { confirmBooking } from '../lib/confirm.js';

/**
 * PayPal's notifications: a completed payment, a refund, a failure.
 *
 * Every notification is verified with PayPal before anything changes, and each
 * one is processed at most once - a repeated notification can never pay or
 * refund a booking twice.
 */
export function createPayPalRouter(config) {
  const router = Router();

  router.post('/webhook', async (req, res, next) => {
    try {
      let verified = false;
      try {
        verified = await verifyWebhook(config, { headers: req.headers, body: req.body });
      } catch (error) {
        const message = error instanceof PayPalError ? error.message : 'The notification could not be verified';
        console.error('[bookings] unverified PayPal notification:', message);
        return res.status(400).json({ error: message, code: 'unverified' });
      }
      if (!verified) {
        console.error('[bookings] PayPal refused a notification as not its own');
        return res.status(400).json({ error: 'The notification is not from PayPal', code: 'unverified' });
      }

      const event = req.body ?? {};
      const type = String(event.event_type ?? '');
      const resource = event.resource ?? {};
      const transactionId = String(resource.id ?? resource.capture_id ?? '');

      if (type === 'PAYMENT.CAPTURE.COMPLETED') {
        const reference = String(resource.custom_id ?? resource.invoice_id ?? '');
        const orderId = String(resource.supplementary_data?.related_ids?.order_id ?? '');

        // A difference from a moved stay is a charge against a booking that is
        // already confirmed: PayPal's notification closes that payment instead of
        // confirming the booking again.
        const waiting = orderId
          ? await Payment.findOne({ type: 'charge', status: 'pending', paypal_transaction_id: orderId })
          : null;
        if (waiting) {
          waiting.status = 'completed';
          waiting.paypal_transaction_id = transactionId || orderId;
          if (resource.amount?.value) waiting.amount = Number(resource.amount.value);
          await waiting.save();
          return res.json({ handled: true, difference_settled: true });
        }

        const booking = (reference && await Booking.findById(reference).catch(() => null))
          || (orderId ? await Booking.findOne({ paypal_order_id: orderId }) : null);
        if (!booking) return res.json({ handled: false, reason: 'no booking for that payment' });
        const outcome = await confirmBooking(config, booking, {
          transactionId,
          amount: resource.amount?.value ? Number(resource.amount.value) : booking.total_price,
          note: 'Paid in full through PayPal',
        });
        return res.json({ handled: true, already_confirmed: Boolean(outcome.alreadyConfirmed) });
      }

      if (type === 'PAYMENT.CAPTURE.REFUNDED') {
        const booking = await Booking.findOne({ paypal_order_id: String(resource.supplementary_data?.related_ids?.order_id ?? '') });
        if (!booking) return res.json({ handled: false, reason: 'no booking for that refund' });
        const already = await Payment.findOne({ paypal_transaction_id: transactionId, type: 'refund' });
        if (already) return res.json({ handled: true, already_recorded: true });
        await Payment.create({
          booking_id: booking._id,
          paypal_transaction_id: transactionId,
          amount: resource.amount?.value ? Number(resource.amount.value) : booking.total_price,
          type: 'refund',
          status: 'completed',
          note: 'Refund reported by PayPal',
        });
        return res.json({ handled: true });
      }

      res.json({ handled: false, reason: `nothing to do for ${type}` });
    } catch (error) { next(error); }
  });

  return router;
}
