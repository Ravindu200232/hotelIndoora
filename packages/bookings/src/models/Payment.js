import mongoose from 'mongoose';

/**
 * Payment: every PayPal charge and refund against a booking, with the PayPal
 * transaction id, the amount, the type, the status and the date and time.
 *
 * No card or bank details are ever stored - only what PayPal tells us.
 */
const paymentSchema = new mongoose.Schema({
  booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  paypal_transaction_id: { type: String, index: { sparse: true } },
  amount: { type: Number, required: true },
  type: { type: String, required: true, enum: ['charge', 'refund'] },
  status: { type: String, required: true, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  // The approval address PayPal gave for this order. A difference that is still
  // waiting to be approved is handed back as it is, so a retry never opens a
  // second order for the same amount.
  approve_url: { type: String, default: '' },
  // What the payment was for, so a refund can explain itself.
  note: { type: String, default: '' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

paymentSchema.index({ booking_id: 1, created_at: 1 });

paymentSchema.methods.toPublic = function toPublic() {
  return {
    id: String(this._id),
    booking_id: String(this.booking_id),
    paypal_transaction_id: this.paypal_transaction_id ?? null,
    amount: this.amount,
    type: this.type,
    status: this.status,
    note: this.note ?? '',
    // Present while a difference is waiting for the guest to approve it at
    // PayPal, so the change can point them back to it.
    approve_url: this.approve_url || null,
    created_at: this.created_at,
  };
};

export const Payment = mongoose.models.Payment ?? mongoose.model('Payment', paymentSchema);
