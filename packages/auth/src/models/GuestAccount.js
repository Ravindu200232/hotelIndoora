import mongoose from 'mongoose';

/**
 * Guest Account: the account a guest creates with a full name, email address
 * and password, whose email address must be confirmed before the guest can
 * book, and which the guest can change or delete themselves.
 *
 * The fields below are the specification's, with its bounds: full name 2 to 120
 * characters, a well-formed email address unique across guest and staff
 * accounts, a password of at least 10 characters with a letter and a digit, an
 * optional phone number, and a status of active or deleted.
 */
const guestAccountSchema = new mongoose.Schema({
  full_name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  password_hash: { type: String, required: true, select: false },
  email_confirmed: { type: Boolean, required: true, default: false },
  email_confirmation_token: { type: String, index: { sparse: true } },
  email_confirmation_expires_at: { type: Date },
  phone_number: { type: String, trim: true },
  status: { type: String, required: true, enum: ['active', 'deleted'], default: 'active' },
  // Sign-in throttling and the resend cap live with the account they protect.
  failed_attempts: { type: Number, default: 0 },
  locked_until: { type: Date },
  resend_count: { type: Number, default: 0 },
  resend_window_started_at: { type: Date },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

guestAccountSchema.index({ status: 1, email: 1 });

/** One serializer, so every route in this service returns the same shape. */
guestAccountSchema.methods.toPublic = function toPublic() {
  return {
    id: String(this._id),
    role: 'guest',
    full_name: this.full_name,
    email: this.email,
    email_confirmed: Boolean(this.email_confirmed),
    phone_number: this.phone_number ?? '',
    status: this.status,
    created_at: this.created_at,
  };
};

export const GuestAccount = mongoose.models.GuestAccount
  ?? mongoose.model('GuestAccount', guestAccountSchema);
