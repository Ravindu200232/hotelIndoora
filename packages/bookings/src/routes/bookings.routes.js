import { Router } from 'express';
import mongoose from 'mongoose';
import { Booking } from '../models/Booking.js';
import { Payment } from '../models/Payment.js';
import { requireRole } from '../lib/identity.js';
import { bookingProblems, stayProblems } from '../lib/validation.js';
import { differenceFor, nightsBetween, paidTotal, totalFor } from '../lib/pricing.js';
import { normaliseReference } from '../lib/reference.js';
import { createOrder, captureOrder, refundCapture, PayPalError } from '../lib/paypal.js';
import { confirmBooking } from '../lib/confirm.js';
import { freeRoomsFor, guestOf, roomTypeOf } from '../lib/clients.js';
import { bookingChangedEmail, bookingCancelledEmail, sendMail } from '../lib/mailer.js';
import { hotelDetailsOf } from '../lib/clients.js';

/**
 * The guest's own bookings: booking a room, paying for it, changing it, and
 * cancelling it with the whole amount refunded.
 *
 * Every query is scoped to the signed-in guest's own account, so a booking id
 * typed by hand reaches nothing that is not theirs.
 */
export function createGuestBookingsRouter(config) {
  const router = Router();
  router.use(requireRole('guest'));

  const mine = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.bookingId)) {
      res.status(404).json({ error: 'We cannot show that booking' });
      return null;
    }
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking || String(booking.booked_by_guest_account_id ?? '') !== String(req.user.id)) {
      res.status(404).json({ error: 'We cannot show that booking' });
      return null;
    }
    return booking;
  };

  const withPayments = async (booking) => booking.toPublic(
    await Payment.find({ booking_id: booking._id }).sort({ created_at: 1 }),
  );

  const sendQuietly = async (message) => {
    try { await sendMail(message, config); return { status: 'sent' }; } catch (error) {
      return { status: 'failed', error: error.message };
    }
  };

  // ------------------------------------------------------------- create -------
  router.post('/', async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const errors = stayProblems({
        check_in_date: body.check_in_date, check_out_date: body.check_out_date,
      });
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the dates', errors });
      if (!mongoose.isValidObjectId(body.room_type_id)) {
        return res.status(400).json({ error: 'Choose a room type' });
      }

      const guest = await guestOf(config, req.user.id).catch((error) => ({ error: error.message }));
      if (guest?.error) return res.status(503).json({ error: `We could not check your account: ${guest.error}` });
      if (!guest.email_confirmed) {
        return res.status(403).json({
          error: 'Your email address is not confirmed yet',
          code: 'email_unconfirmed',
        });
      }

      const roomType = await roomTypeOf(config, body.room_type_id).catch(() => null);
      if (!roomType || !roomType.on_sale) {
        return res.status(409).json({ error: 'That room type is not on sale', code: 'off_sale' });
      }

      const details = bookingProblems(body, { maxGuests: roomType.max_guests });
      if (Object.keys(details).length) return res.status(400).json({ error: 'Check the form', errors: details });

      // The last room can go between the search and the booking, so it is
      // checked again here rather than trusted from the page.
      const { freeRooms } = await freeRoomsFor(config, {
        roomTypeId: body.room_type_id,
        checkIn: body.check_in_date,
        checkOut: body.check_out_date,
      });
      if (freeRooms < 1) {
        return res.status(409).json({
          error: 'The last room for these nights has just gone',
          code: 'no_room_free',
        });
      }

      const nights = nightsBetween(body.check_in_date, body.check_out_date);
      const booking = await Booking.create({
        room_type_id: roomType.id ?? body.room_type_id,
        check_in_date: new Date(body.check_in_date),
        check_out_date: new Date(body.check_out_date),
        nights,
        nightly_rate: roomType.nightly_rate,
        total_price: totalFor(roomType.nightly_rate, nights),
        lead_guest_name: String(body.lead_guest_name).trim(),
        guest_email: guest.email,
        contact_phone: String(body.contact_phone).trim(),
        guest_count: Number(body.guest_count),
        expected_arrival_time: String(body.expected_arrival_time).trim(),
        special_requests: String(body.special_requests ?? ''),
        status: 'pending_payment',
        booked_by_guest_account_id: req.user.id,
        booked_at: new Date(),
        hold_expires_at: new Date(Date.now() + config.holdMinutes * 60 * 1000),
      });

      // Hand the guest to PayPal to pay the full amount. A missing credential is
      // reported here; the room is held meanwhile and the guest can try again.
      try {
        const order = await createOrder(config, {
          amount: booking.total_price,
          reference: String(booking._id),
          returnUrl: `${req.protocol}://${req.get('host')}/bookings/new/payment?order=${booking._id}`,
          cancelUrl: `${req.protocol}://${req.get('host')}/bookings/new/payment?cancelled=1`,
        });
        booking.paypal_order_id = order.id;
        await booking.save();
        res.status(201).json({
          booking: await withPayments(booking),
          paypal: { order_id: order.id, approve_url: order.approveUrl },
        });
      } catch (error) {
        res.status(201).json({
          booking: await withPayments(booking),
          payments_unavailable: error instanceof PayPalError ? error.message : 'Payments are not connected yet',
        });
      }
    } catch (error) { next(error); }
  });

  // --------------------------------------------------------------- list -------
  router.get('/', async (req, res, next) => {
    try {
      const bookings = await Booking.find({ booked_by_guest_account_id: req.user.id })
        .sort({ check_in_date: -1 })
        .limit(100);
      const payments = await Payment.find({ booking_id: { $in: bookings.map((booking) => booking._id) } }).sort({ created_at: 1 });
      const byBooking = new Map();
      for (const payment of payments) {
        const key = String(payment.booking_id);
        if (!byBooking.has(key)) byBooking.set(key, []);
        byBooking.get(key).push(payment);
      }
      const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
      const rows = bookings.map((booking) => booking.toPublic(byBooking.get(String(booking._id)) ?? []));
      res.json({
        upcoming: rows.filter((row) => new Date(row.check_in_date) >= today && row.status !== 'cancelled'),
        past: rows.filter((row) => new Date(row.check_in_date) < today || row.status === 'cancelled'),
      });
    } catch (error) { next(error); }
  });

  // ---------------------------------------------------------------- one -------
  router.get('/:bookingId', async (req, res, next) => {
    try {
      const booking = await mine(req, res);
      if (!booking) return undefined;
      res.json({ booking: await withPayments(booking) });
    } catch (error) { next(error); }
  });

  // The confirmation page is opened by booking reference, so a guest can find
  // their own booking that way too — never anyone else's.
  router.get('/reference/:reference', async (req, res, next) => {
    try {
      const booking = await Booking.findOne({ booking_reference: normaliseReference(req.params.reference) });
      if (!booking || String(booking.booked_by_guest_account_id ?? '') !== String(req.user.id)) {
        return res.status(404).json({ error: 'We cannot show that booking' });
      }
      res.json({ booking: await withPayments(booking) });
    } catch (error) { next(error); }
  });

  // ------------------------------------------------------- open PayPal --------
  // The Payment page asks for this on load and again when the guest retries:
  // one order for the full amount, approved by the guest, then captured.
  router.post('/:bookingId/paypal-order', async (req, res, next) => {
    try {
      const booking = await mine(req, res);
      if (!booking) return undefined;
      if (booking.status === 'confirmed') {
        return res.status(409).json({ error: 'This booking is already confirmed', code: 'already_confirmed' });
      }
      if (booking.status === 'cancelled') {
        return res.status(409).json({ error: 'This booking is cancelled', code: 'cancelled' });
      }
      try {
        const order = await createOrder(config, {
          amount: booking.total_price,
          reference: String(booking._id),
          returnUrl: `${req.protocol}://${req.get('host')}/bookings/new/payment?booking_id=${booking._id}`,
          cancelUrl: `${req.protocol}://${req.get('host')}/bookings/new/payment?booking_id=${booking._id}&cancelled=1`,
        });
        booking.paypal_order_id = order.id;
        await booking.save();
        res.json({ order_id: order.id, approve_url: order.approveUrl, total: booking.total_price });
      } catch (error) {
        res.status(502).json({
          error: error instanceof PayPalError ? error.message : 'PayPal could not be reached',
          code: 'payments_unavailable',
        });
      }
    } catch (error) { next(error); }
  });

  // -------------------------------------------------------------- capture -----
  router.post('/:bookingId/paypal-capture', async (req, res, next) => {
    try {
      const booking = await mine(req, res);
      if (!booking) return undefined;
      if (booking.status === 'confirmed') return res.json({ booking: await withPayments(booking) });
      if (booking.status === 'cancelled') {
        return res.status(409).json({ error: 'That booking is cancelled', code: 'cancelled' });
      }

      const orderId = String(req.body?.order_id ?? booking.paypal_order_id ?? '');
      if (!orderId) {
        return res.status(400).json({
          error: 'Payments are not connected yet, so there is nothing to capture.',
          code: 'payments_unavailable',
        });
      }

      let captured;
      try {
        captured = await captureOrder(config, orderId);
      } catch (error) {
        return res.status(502).json({
          error: error instanceof PayPalError ? error.message : 'The payment could not be completed',
          code: 'payment_failed',
        });
      }

      const outcome = await confirmBooking(config, booking, {
        transactionId: captured.transactionId,
        amount: captured.amount ?? booking.total_price,
        note: 'Paid in full through PayPal when booking',
      });
      res.json({ booking: await withPayments(outcome.booking), mail: outcome.mail });
    } catch (error) { next(error); }
  });

  // --------------------------------------------------------------- change -----
  router.patch('/:bookingId', async (req, res, next) => {
    try {
      const booking = await mine(req, res);
      if (!booking) return undefined;
      if (booking.status === 'cancelled') {
        return res.status(409).json({ error: 'That booking is cancelled', code: 'cancelled' });
      }

      const body = req.body ?? {};
      const checkIn = body.check_in_date ? new Date(body.check_in_date) : booking.check_in_date;
      const checkOut = body.check_out_date ? new Date(body.check_out_date) : booking.check_out_date;
      const errors = stayProblems({ check_in_date: checkIn, check_out_date: checkOut });
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the dates', errors });

      const roomTypeId = body.room_type_id ?? String(booking.room_type_id);
      const roomType = await roomTypeOf(config, roomTypeId).catch(() => null);
      if (!roomType || !roomType.on_sale) {
        return res.status(409).json({ error: 'That room type is not on sale', code: 'off_sale' });
      }
      const details = bookingProblems({ ...booking.toObject(), ...body }, { maxGuests: roomType.max_guests });
      if (Object.keys(details).length) return res.status(400).json({ error: 'Check the form', errors: details });

      const { freeRooms } = await freeRoomsFor(config, { roomTypeId, checkIn, checkOut });
      if (freeRooms < 1) {
        return res.status(409).json({ error: 'No room of that room type is free for those nights', code: 'no_room_free' });
      }

      const nights = nightsBetween(checkIn, checkOut);
      const newTotal = totalFor(roomType.nightly_rate, nights);
      const payments = await Payment.find({ booking_id: booking._id });
      const settled = differenceFor(newTotal, paidTotal(payments));

      // Settle before the booking changes, so a refused PayPal call leaves the
      // stay exactly as it was.
      let settlement = { direction: settled.direction, amount: settled.amount };
      if (settled.direction !== 'none') {
        const charge = payments.find((payment) => payment.type === 'charge' && payment.status === 'completed');
        try {
          if (settled.direction === 'refund') {
            const refund = await refundCapture(config, { transactionId: charge?.paypal_transaction_id, amount: settled.amount });
            await Payment.create({
              booking_id: booking._id,
              paypal_transaction_id: refund.id,
              amount: settled.amount,
              type: 'refund',
              status: refund.completed ? 'completed' : 'pending',
              note: 'Price difference after the stay changed',
            });
          } else {
            // A difference the guest has not approved at PayPal yet is handed
            // back as it is, so pressing the change again never opens a second
            // order for the same amount.
            const waiting = payments.find((payment) => payment.type === 'charge'
              && payment.status === 'pending' && payment.approve_url
              && Number(payment.amount) === settled.amount);
            if (waiting) {
              settlement = {
                ...settlement,
                order_id: waiting.paypal_transaction_id,
                approve_url: waiting.approve_url,
              };
            } else {
              const order = await createOrder(config, {
                amount: settled.amount,
                reference: String(booking._id),
                // Back to the change itself, where the difference is collected.
                returnUrl: `${req.protocol}://${req.get('host')}/my-bookings/${booking._id}/change?settling=1`,
                cancelUrl: `${req.protocol}://${req.get('host')}/my-bookings/${booking._id}/change?settled=0`,
              });
              await Payment.create({
                booking_id: booking._id,
                paypal_transaction_id: order.id,
                amount: settled.amount,
                type: 'charge',
                status: 'pending',
                approve_url: order.approveUrl,
                note: 'Price difference after the stay changed',
              });
              settlement = { ...settlement, order_id: order.id, approve_url: order.approveUrl };
            }
          }
        } catch (error) {
          return res.status(502).json({
            error: error instanceof PayPalError ? error.message : 'PayPal did not settle the difference',
            code: 'settlement_failed',
          });
        }
      }

      booking.room_type_id = roomType.id ?? roomTypeId;
      booking.check_in_date = checkIn;
      booking.check_out_date = checkOut;
      booking.nights = nights;
      booking.nightly_rate = roomType.nightly_rate;
      booking.total_price = newTotal;
      if (body.lead_guest_name) booking.lead_guest_name = String(body.lead_guest_name).trim();
      if (body.contact_phone) booking.contact_phone = String(body.contact_phone).trim();
      if (body.guest_count) booking.guest_count = Number(body.guest_count);
      if (body.expected_arrival_time) booking.expected_arrival_time = String(body.expected_arrival_time).trim();
      if (body.special_requests !== undefined) booking.special_requests = String(body.special_requests);
      await booking.save();

      const hotel = await hotelDetailsOf(config).catch(() => null);
      // A difference waiting at PayPal is described as waiting, not as paid.
      const forEmail = settlement.approve_url ? { ...settled, pending: true } : settled;
      const mail = hotel
        ? await sendQuietly({ to: booking.guest_email, ...bookingChangedEmail({ hotel, booking, roomType, settled: forEmail }) })
        : { status: 'failed', error: 'The hotel details are not set yet.' };

      res.json({ booking: await withPayments(booking), settlement, mail });
    } catch (error) { next(error); }
  });

  // ------------------------------------------- the difference collected ------
  // After the guest approves the difference at PayPal they come back to the
  // change with the order in the address; this collects it and closes the
  // pending payment, leaving the booking itself untouched.
  router.post('/:bookingId/change-capture', async (req, res, next) => {
    try {
      const booking = await mine(req, res);
      if (!booking) return undefined;

      const orderId = String(req.body?.order_id ?? '');
      if (!orderId) {
        return res.status(400).json({ error: 'There is no payment to collect for this change', code: 'payments_unavailable' });
      }
      const waiting = await Payment.findOne({
        booking_id: booking._id, type: 'charge', status: 'pending', paypal_transaction_id: orderId,
      });
      if (!waiting) {
        return res.status(409).json({ error: 'That payment is not waiting on this booking', code: 'not_waiting' });
      }

      let captured;
      try {
        captured = await captureOrder(config, orderId);
      } catch (error) {
        return res.status(502).json({
          error: error instanceof PayPalError ? error.message : 'PayPal did not complete the payment for the change',
          code: 'settlement_failed',
        });
      }

      waiting.status = captured.completed ? 'completed' : 'pending';
      waiting.paypal_transaction_id = captured.transactionId ?? orderId;
      if (captured.amount) waiting.amount = captured.amount;
      await waiting.save();

      res.json({
        booking: await withPayments(booking),
        settlement: {
          direction: 'charge',
          amount: waiting.amount,
          status: waiting.status,
          approve_url: waiting.status === 'pending' ? waiting.approve_url || null : null,
        },
      });
    } catch (error) { next(error); }
  });

  // --------------------------------------------------------------- cancel -----
  router.post('/:bookingId/cancel', async (req, res, next) => {
    try {
      const booking = await mine(req, res);
      if (!booking) return undefined;
      if (booking.status === 'cancelled') {
        return res.status(409).json({ error: 'This booking is already cancelled', code: 'cancelled' });
      }

      const payments = await Payment.find({ booking_id: booking._id });
      const charge = payments.find((payment) => payment.type === 'charge' && payment.status === 'completed');
      let refund = null;
      if (charge) {
        try {
          const attempt = await refundCapture(config, { transactionId: charge.paypal_transaction_id });
          const record = await Payment.create({
            booking_id: booking._id,
            paypal_transaction_id: attempt.id,
            amount: charge.amount,
            type: 'refund',
            status: attempt.completed ? 'completed' : 'pending',
            note: 'Cancelled: the whole amount refunded, with no fee kept back',
          });
          refund = { id: attempt.id, amount: record.amount, status: record.status };
        } catch (error) {
          return res.status(502).json({
            error: error instanceof PayPalError ? error.message : 'PayPal could not refund this booking',
            code: 'refund_failed',
          });
        }
      }

      booking.status = 'cancelled';
      booking.hold_expires_at = undefined;
      await booking.save();

      const hotel = await hotelDetailsOf(config).catch(() => null);
      const mail = hotel
        ? await sendQuietly({ to: booking.guest_email, ...bookingCancelledEmail({ hotel, booking, refund: refund?.amount }) })
        : { status: 'failed', error: 'The hotel details are not set yet.' };

      res.json({ booking: await withPayments(booking), refund, mail });
    } catch (error) { next(error); }
  });

  return router;
}

/**
 * The page a guest lands on from an emailed PayPal link. It is public because
 * the guest may not be signed in, so it answers with the least it can: the
 * status, the stay, the room type name and the amount paid - no guest name,
 * phone number or email.
 */
export function createReferenceRouter() {
  const router = Router();
  router.get('/:reference/status', async (req, res, next) => {
    try {
      const reference = normaliseReference(req.params.reference);
      const booking = await Booking.findOne({ booking_reference: reference });
      if (!booking) return res.status(404).json({ error: 'We cannot find that booking', code: 'not_found' });
      const payments = await Payment.find({ booking_id: booking._id, status: 'completed' });
      const charge = payments.find((payment) => payment.type === 'charge');
      res.json({
        reference: booking.booking_reference,
        status: booking.status,
        check_in_date: booking.check_in_date,
        check_out_date: booking.check_out_date,
        nights: booking.nights,
        guests: booking.guest_count,
        room_type_id: String(booking.room_type_id),
        total_price: booking.total_price,
        paid: paidTotal(payments),
        // The receipt lines a guest reads on this page. No guest name, phone
        // number, email or PayPal transaction id: anyone holding a reference
        // can open it.
        payment_status: charge ? 'completed' : 'pending',
        payment_type: charge ? charge.type : null,
        paid_on: charge?.created_at ?? null,
      });
    } catch (error) { next(error); }
  });
  return router;
}
