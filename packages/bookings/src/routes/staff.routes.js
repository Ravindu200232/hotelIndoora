import { Router } from 'express';
import mongoose from 'mongoose';
import { Booking } from '../models/Booking.js';
import { Payment } from '../models/Payment.js';
import { requireRole } from '../lib/identity.js';
import { bookingProblems, emailProblem, stayProblems } from '../lib/validation.js';
import { differenceFor, nightsBetween, paidTotal, totalFor } from '../lib/pricing.js';
import { createOrder, createPaymentLink, refundCapture, PayPalError } from '../lib/paypal.js';
import { confirmBooking } from '../lib/confirm.js';
import { createReference } from '../lib/reference.js';
import { freeRoomsFor, roomTypeOf, hotelDetailsOf } from '../lib/clients.js';
import { bookingChangedEmail, paymentLinkEmail, bookingCancelledEmail, sendMail } from '../lib/mailer.js';

const PER_PAGE = 25;
const startOfToday = () => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

/**
 * The desk's side of the bookings: finding any of them, opening one in full,
 * moving a stay, cancelling with the full refund, cancelling an unpaid booking
 * to free the room, and taking a booking for a guest who phoned or walked in.
 */
export function createStaffBookingsRouter(config) {
  const router = Router();
  router.use(requireRole('hotel_staff'));

  const withPayments = async (booking) => booking.toPublic(
    await Payment.find({ booking_id: booking._id }).sort({ created_at: 1 }),
  );

  /**
   * A booking the desk takes is given its reference straight away: the desk reads
   * it to the guest on the phone, and it is what the guest quotes when they pay.
   * A guest's own online booking still takes its reference when it is confirmed.
   */
  const referenceFor = async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = createReference();
      const taken = await Booking.findOne({ booking_reference: candidate }).select('_id');
      if (!taken) return candidate;
    }
    throw new Error('A booking reference could not be issued');
  };
  const sendQuietly = async (message) => {
    try { await sendMail(message, config); return { status: 'sent' }; } catch (error) {
      return { status: 'failed', error: error.message };
    }
  };

  // ---------------------------------------------------------------- find -----
  router.get('/', async (req, res, next) => {
    try {
      const filter = {};
      if (req.query.status && req.query.status !== 'any') filter.status = String(req.query.status);
      if (req.query.room_type_id && mongoose.isValidObjectId(req.query.room_type_id)) filter.room_type_id = req.query.room_type_id;
      if (req.query.guest) filter.lead_guest_name = { $regex: String(req.query.guest), $options: 'i' };
      if (req.query.check_in || req.query.check_out) {
        const from = req.query.check_in ? new Date(req.query.check_in) : null;
        const to = req.query.check_out ? new Date(req.query.check_out) : null;
        if (from) filter.check_out_date = { $gt: from };
        if (to) filter.check_in_date = { $lt: to };
      }

      const page = Math.max(1, Number(req.query.page ?? 1));
      const [total, bookings] = await Promise.all([
        Booking.countDocuments(filter),
        Booking.find(filter).sort({ check_in_date: 1 }).skip((page - 1) * PER_PAGE).limit(PER_PAGE),
      ]);
      const payments = await Payment.find({ booking_id: { $in: bookings.map((booking) => booking._id) } }).sort({ created_at: 1 });
      const byBooking = new Map();
      for (const payment of payments) {
        const key = String(payment.booking_id);
        if (!byBooking.has(key)) byBooking.set(key, []);
        byBooking.get(key).push(payment);
      }
      res.json({
        bookings: bookings.map((booking) => booking.toPublic(byBooking.get(String(booking._id)) ?? [])),
        total,
        page,
        per_page: PER_PAGE,
        pages: Math.max(1, Math.ceil(total / PER_PAGE)),
      });
    } catch (error) { next(error); }
  });

  router.get('/:bookingId', async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.bookingId)) return res.status(404).json({ error: 'That booking is not one of ours' });
      const booking = await Booking.findById(req.params.bookingId);
      if (!booking) return res.status(404).json({ error: 'That booking is not one of ours' });
      res.json({ booking: await withPayments(booking) });
    } catch (error) { next(error); }
  });

  // ------------------------------------------------- take one for a guest ----
  router.post('/', async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const errors = stayProblems({ check_in_date: body.check_in_date, check_out_date: body.check_out_date });
      const emailIssue = emailProblem(body.guest_email);
      if (emailIssue) errors.guest_email = emailIssue;
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the dates and the email address', errors });
      if (!mongoose.isValidObjectId(body.room_type_id)) return res.status(400).json({ error: 'Choose a room type' });

      const roomType = await roomTypeOf(config, body.room_type_id).catch(() => null);
      if (!roomType || !roomType.on_sale) return res.status(409).json({ error: 'That room type is not on sale', code: 'off_sale' });

      const details = bookingProblems(body, { maxGuests: roomType.max_guests });
      if (Object.keys(details).length) return res.status(400).json({ error: 'Check the form', errors: details });

      const { freeRooms } = await freeRoomsFor(config, {
        roomTypeId: body.room_type_id, checkIn: body.check_in_date, checkOut: body.check_out_date,
      });
      if (freeRooms < 1) return res.status(409).json({ error: 'No room of that room type is free for those nights', code: 'no_room_free' });

      const nights = nightsBetween(body.check_in_date, body.check_out_date);
      const booking = await Booking.create({
        booking_reference: await referenceFor(),
        room_type_id: roomType.id ?? body.room_type_id,
        check_in_date: new Date(body.check_in_date),
        check_out_date: new Date(body.check_out_date),
        nights,
        nightly_rate: roomType.nightly_rate,
        total_price: totalFor(roomType.nightly_rate, nights),
        lead_guest_name: String(body.lead_guest_name).trim(),
        guest_email: String(body.guest_email).trim().toLowerCase(),
        contact_phone: String(body.contact_phone).trim(),
        guest_count: Number(body.guest_count),
        expected_arrival_time: String(body.expected_arrival_time).trim(),
        special_requests: String(body.special_requests ?? ''),
        status: 'pending_payment',
        booked_by_staff_account_id: req.user.id,
        booked_by_staff_name: req.user.name || '',
        booked_at: new Date(),
        // A staff-made booking holds its room until the desk cancels it.
      });

      const hotel = await hotelDetailsOf(config).catch(() => null);
      let mail = { status: 'failed', error: 'The hotel details are not set yet.' };
      let link = null;
      try {
        link = await createPaymentLink(config, {
          amount: booking.total_price,
          reference: String(booking._id),
          returnUrl: `${req.protocol}://${req.get('host')}/bookings/${booking._id}/paid`,
        });
        booking.paypal_order_id = link.orderId;
        booking.payment_link_sent_at = new Date();
        await booking.save();
        if (hotel) {
          mail = await sendQuietly({
            to: booking.guest_email,
            ...paymentLinkEmail({ hotel, booking, roomType, url: link.url }),
          });
        }
      } catch (error) {
        mail = {
          status: 'failed',
          error: error instanceof PayPalError ? error.message : 'The payment link could not be created',
        };
      }

      res.status(201).json({ booking: await withPayments(booking), payment_link: link?.url ?? null, mail });
    } catch (error) { next(error); }
  });

  // ---------------------------------------------------------- edit a stay ----
  router.patch('/:bookingId', async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.bookingId)) return res.status(404).json({ error: 'That booking is not one of ours' });
      const booking = await Booking.findById(req.params.bookingId);
      if (!booking) return res.status(404).json({ error: 'That booking is not one of ours' });
      if (booking.status === 'cancelled') return res.status(409).json({ error: 'That booking is cancelled', code: 'cancelled' });

      const body = req.body ?? {};
      const checkIn = body.check_in_date ? new Date(body.check_in_date) : booking.check_in_date;
      const checkOut = body.check_out_date ? new Date(body.check_out_date) : booking.check_out_date;
      const errors = stayProblems({ check_in_date: checkIn, check_out_date: checkOut });
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the dates', errors });

      const roomTypeId = body.room_type_id ?? String(booking.room_type_id);
      const roomType = await roomTypeOf(config, roomTypeId).catch(() => null);
      if (!roomType) return res.status(409).json({ error: 'That room type is not one of ours', code: 'unknown_room_type' });
      const details = bookingProblems({ ...booking.toObject(), ...body }, { maxGuests: roomType.max_guests });
      if (Object.keys(details).length) return res.status(400).json({ error: 'Check the form', errors: details });

      const { freeRooms } = await freeRoomsFor(config, { roomTypeId, checkIn, checkOut });
      if (freeRooms < 1) return res.status(409).json({ error: 'No room of that room type is free for those nights', code: 'no_room_free' });

      const nights = nightsBetween(checkIn, checkOut);
      const newTotal = totalFor(roomType.nightly_rate, nights);
      const payments = await Payment.find({ booking_id: booking._id });
      const settled = differenceFor(newTotal, paidTotal(payments));
      const charge = payments.find((payment) => payment.type === 'charge' && payment.status === 'completed');

      let settlement = { direction: settled.direction, amount: settled.amount };
      if (settled.direction !== 'none') {
        try {
          if (settled.direction === 'refund') {
            const refund = await refundCapture(config, { transactionId: charge?.paypal_transaction_id, amount: settled.amount });
            await Payment.create({
              booking_id: booking._id, paypal_transaction_id: refund.id, amount: settled.amount,
              type: 'refund', status: refund.completed ? 'completed' : 'pending', note: 'Price difference after the stay moved',
            });
          } else {
            // A difference the guest has not approved at PayPal yet is handed back
            // as it is, so pressing the change again never opens a second order for
            // the same amount.
            const waiting = payments.find((payment) => payment.type === 'charge'
              && payment.status === 'pending' && payment.approve_url
              && Number(payment.amount) === settled.amount);
            if (waiting) {
              settlement = {
                ...settlement,
                order_id: waiting.paypal_transaction_id,
                approve_url: waiting.approve_url,
                pending: true,
              };
            } else {
              const order = await createOrder(config, {
                amount: settled.amount,
                reference: String(booking._id),
                returnUrl: `${req.protocol}://${req.get('host')}/bookings/${booking._id}/paid`,
              });
              await Payment.create({
                booking_id: booking._id, paypal_transaction_id: order.id, amount: settled.amount,
                type: 'charge', status: 'pending', approve_url: order.approveUrl,
                note: 'Price difference after the stay moved',
              });
              settlement = { ...settlement, order_id: order.id, approve_url: order.approveUrl, pending: true };
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
      if (body.guest_email) booking.guest_email = String(body.guest_email).trim().toLowerCase();
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

  // ---------------------------------------- the difference, sent to the guest --
  // Moving a stay to a dearer one opens a PayPal order for the difference. The
  // guest is the one who approves a payment, so the desk emails them the link for
  // it and PayPal reports back when it is paid, exactly as with a payment link.
  router.post('/:bookingId/difference-link', async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.bookingId)) return res.status(404).json({ error: 'That booking is not one of ours' });
      const booking = await Booking.findById(req.params.bookingId);
      if (!booking) return res.status(404).json({ error: 'That booking is not one of ours' });

      const waiting = await Payment.findOne({
        booking_id: booking._id, type: 'charge', status: 'pending', approve_url: { $ne: '' },
      }).sort({ created_at: -1 });
      if (!waiting) {
        return res.status(409).json({
          error: 'Nothing is waiting to be paid on this booking',
          code: 'nothing_waiting',
        });
      }

      const roomType = await roomTypeOf(config, booking.room_type_id).catch(() => null);
      const hotel = await hotelDetailsOf(config).catch(() => null);
      const mail = hotel
        ? await sendQuietly({
          to: booking.guest_email,
          ...paymentLinkEmail({
            hotel,
            booking,
            roomType,
            url: waiting.approve_url,
            amount: waiting.amount,
            heading: 'Pay the difference on your stay',
            intro: 'Your stay has moved. Pay the difference through PayPal and everything is settled — the rest of your booking is already paid and unchanged.',
          }),
        })
        : { status: 'failed', error: 'The hotel details are not set yet.' };

      res.json({
        booking: await withPayments(booking),
        difference_link: waiting.approve_url,
        amount: waiting.amount,
        mail,
      });
    } catch (error) { next(error); }
  });

  // ------------------------------------------------------------- cancel ------
  router.post('/:bookingId/cancel', async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.bookingId)) return res.status(404).json({ error: 'That booking is not one of ours' });
      const booking = await Booking.findById(req.params.bookingId);
      if (!booking) return res.status(404).json({ error: 'That booking is not one of ours' });
      if (booking.status === 'cancelled') return res.status(409).json({ error: 'That booking is already cancelled', code: 'cancelled' });

      const payments = await Payment.find({ booking_id: booking._id });
      const charge = payments.find((payment) => payment.type === 'charge' && payment.status === 'completed');
      let refund = null;
      if (charge) {
        try {
          const attempt = await refundCapture(config, { transactionId: charge.paypal_transaction_id });
          const record = await Payment.create({
            booking_id: booking._id, paypal_transaction_id: attempt.id, amount: charge.amount,
            type: 'refund', status: attempt.completed ? 'completed' : 'pending',
            note: 'Cancelled by the hotel: the whole amount refunded',
          });
          refund = { amount: record.amount, status: record.status };
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

  // ------------------------------------------------------- payment link ------
  router.post('/:bookingId/payment-link', async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.bookingId)) return res.status(404).json({ error: 'That booking is not one of ours' });
      const booking = await Booking.findById(req.params.bookingId);
      if (!booking) return res.status(404).json({ error: 'That booking is not one of ours' });
      if (booking.status !== 'pending_payment') {
        return res.status(409).json({ error: 'That booking is not waiting for payment', code: 'not_waiting' });
      }

      // The desk may correct the address as it sends the link, since the link and
      // the confirmation both go to the guest's own email address.
      if (req.body?.email !== undefined) {
        const issue = emailProblem(req.body.email);
        if (issue) return res.status(400).json({ error: 'Check the email address', errors: { guest_email: issue } });
        if (String(req.body.email).trim().toLowerCase() !== booking.guest_email) {
          booking.guest_email = String(req.body.email).trim().toLowerCase();
          await booking.save();
        }
      }

      const roomType = await roomTypeOf(config, booking.room_type_id).catch(() => null);
      const hotel = await hotelDetailsOf(config).catch(() => null);
      let link;
      try {
        link = await createPaymentLink(config, {
          amount: booking.total_price,
          reference: String(booking._id),
          returnUrl: `${req.protocol}://${req.get('host')}/bookings/${booking._id}/paid`,
        });
      } catch (error) {
        return res.status(502).json({
          error: error instanceof PayPalError ? error.message : 'The payment link could not be created',
          code: 'payment_link_failed',
        });
      }

      booking.paypal_order_id = link.orderId;
      booking.payment_link_sent_at = new Date();
      await booking.save();

      const mail = hotel
        ? await sendQuietly({ to: booking.guest_email, ...paymentLinkEmail({ hotel, booking, roomType, url: link.url }) })
        : { status: 'failed', error: 'The hotel details are not set yet.' };

      res.json({ booking: await withPayments(booking), payment_link: link.url, mail });
    } catch (error) { next(error); }
  });

  return router;
}

/** What the desk sees at the start of a shift. */
export function createDashboardRouter() {
  const router = Router();
  router.use(requireRole('hotel_staff'));

  router.get('/', async (req, res, next) => {
    try {
      const today = startOfToday();
      const tomorrow = new Date(today.getTime() + 86400000);
      const [arrivals, departures, upcoming, waiting] = await Promise.all([
        Booking.find({ status: 'confirmed', check_in_date: { $gte: today, $lt: tomorrow } }).sort({ expected_arrival_time: 1 }),
        Booking.find({ status: 'confirmed', check_out_date: { $gte: today, $lt: tomorrow } }).sort({ check_out_date: 1 }),
        Booking.find({ status: 'confirmed', check_in_date: { $gte: tomorrow } }).sort({ check_in_date: 1 }).limit(20),
        Booking.find({ status: 'pending_payment' }).sort({ booked_at: 1 }),
      ]);
      const shape = (booking) => booking.toPublic();
      res.json({
        today: today.toISOString().slice(0, 10),
        arrivals: arrivals.map(shape),
        departures: departures.map(shape),
        upcoming: upcoming.map(shape),
        waiting_for_payment: waiting.map(shape),
      });
    } catch (error) { next(error); }
  });

  return router;
}
