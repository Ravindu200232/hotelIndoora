import { Payment } from '../models/Payment.js';
import { createReference } from './reference.js';
import { sendMail, bookingConfirmedEmail } from './mailer.js';
import { hotelDetailsOf, roomTypeOf } from './clients.js';

/**
 * Confirming a booking happens in exactly one place, whether the guest paid on
 * the Payment page or through a payment link staff emailed, and whether PayPal
 * told us directly or through a notification. A repeated confirmation changes
 * nothing, so a second notification can never pay a booking twice.
 */
export async function confirmBooking(config, booking, { transactionId, amount, note = '' }) {
  const already = await Payment.findOne({
    booking_id: booking._id, type: 'charge', status: 'completed',
  });
  if (already && booking.status === 'confirmed') {
    return { booking, payment: already, alreadyConfirmed: true };
  }

  const payment = await Payment.create({
    booking_id: booking._id,
    paypal_transaction_id: transactionId,
    amount: amount ?? booking.total_price,
    type: 'charge',
    status: 'completed',
    note,
  });

  booking.status = 'confirmed';
  booking.booking_reference = booking.booking_reference ?? createReference();
  booking.hold_expires_at = undefined;
  await booking.save();

  let mail = { status: 'sent' };
  try {
    const [hotel, roomType] = await Promise.all([
      hotelDetailsOf(config).catch(() => null),
      roomTypeOf(config, booking.room_type_id).catch(() => null),
    ]);
    if (hotel) {
      await sendMail({
        to: booking.guest_email,
        ...bookingConfirmedEmail({ hotel, booking, roomType }),
      }, config);
    } else {
      mail = { status: 'failed', error: 'The hotel details are not set yet.' };
    }
  } catch (error) {
    mail = { status: 'failed', error: error.message };
  }

  return { booking, payment, mail };
}
