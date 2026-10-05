import mongoose from 'mongoose';

/**
 * Booking: one room of one room type for one guest for a check-in and check-out
 * date, with the nightly rate at the time of booking, the total, the guest's
 * stay details, its status, and who booked it.
 *
 * The nightly rate is the final price - no tax, cleaning or service fee is added
 * - and one booking always covers exactly one room of one room type.
 */
const bookingSchema = new mongoose.Schema({
  booking_reference: { type: String, unique: true, sparse: true },
  room_type_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  check_in_date: { type: Date, required: true },
  check_out_date: { type: Date, required: true },
  nights: { type: Number, required: true, min: 1 },
  nightly_rate: { type: Number, required: true, min: 0.01 },
  total_price: { type: Number, required: true, min: 0.01 },
  lead_guest_name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  guest_email: { type: String, required: true, trim: true, lowercase: true },
  contact_phone: { type: String, required: true, trim: true },
  guest_count: { type: Number, required: true, min: 1 },
  expected_arrival_time: { type: String, required: true, trim: true },
  special_requests: { type: String, default: '' },
  status: { type: String, required: true, enum: ['pending_payment', 'confirmed', 'cancelled'], default: 'pending_payment' },
  booked_by_guest_account_id: { type: mongoose.Schema.Types.ObjectId },
  booked_by_staff_account_id: { type: mongoose.Schema.Types.ObjectId },
  // The desk's own name at the moment the booking was taken, so the dashboard
  // can show who took it without asking the auth service for a label.
  booked_by_staff_name: { type: String, default: '' },
  booked_at: { type: Date, required: true, default: Date.now },
  // Kept while a room is held and the payment has not come back yet.
  hold_expires_at: { type: Date },
  released_at: { type: Date },
  // The PayPal order a guest is paying, and the emailed payment link.
  paypal_order_id: { type: String },
  payment_link_sent_at: { type: Date },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Every list in the product filters on one of these.
bookingSchema.index({ guest_email: 1, check_in_date: -1 });
bookingSchema.index({ booked_by_guest_account_id: 1, check_in_date: -1 });
bookingSchema.index({ status: 1, check_in_date: 1 });
bookingSchema.index({ room_type_id: 1, check_in_date: 1, check_out_date: 1 });

/** True while this booking still occupies its room. */
bookingSchema.methods.occupies = function occupies(now = new Date()) {
  if (this.status === 'confirmed') return true;
  if (this.status !== 'pending_payment') return false;
  if (this.released_at) return false;
  return !this.hold_expires_at || new Date(this.hold_expires_at) > now;
};

bookingSchema.methods.toPublic = function toPublic(payments = []) {
  return {
    id: String(this._id),
    booking_reference: this.booking_reference ?? null,
    room_type_id: String(this.room_type_id),
    check_in_date: this.check_in_date,
    check_out_date: this.check_out_date,
    nights: this.nights,
    nightly_rate: this.nightly_rate,
    total_price: this.total_price,
    lead_guest_name: this.lead_guest_name,
    guest_email: this.guest_email,
    contact_phone: this.contact_phone,
    guest_count: this.guest_count,
    expected_arrival_time: this.expected_arrival_time,
    special_requests: this.special_requests ?? '',
    status: this.status,
    booked_by: this.booked_by_staff_account_id ? 'staff' : 'guest',
    booked_by_staff_name: this.booked_by_staff_name || null,
    booked_at: this.booked_at,
    // Present while an online booking still holds its room.
    hold_expires_at: this.hold_expires_at ?? null,
    payments: payments.map((payment) => ({
      id: String(payment._id),
      amount: payment.amount,
      type: payment.type,
      status: payment.status,
      paypal_transaction_id: payment.paypal_transaction_id ?? null,
      // Present while a difference is still waiting to be approved at PayPal.
      approve_url: payment.approve_url || null,
      created_at: payment.created_at,
    })),
  };
};

export const Booking = mongoose.models.Booking ?? mongoose.model('Booking', bookingSchema);
