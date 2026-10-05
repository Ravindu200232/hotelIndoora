import mongoose from 'mongoose';

/**
 * Staff Account: a hotel staff account created from inside the site by an
 * already signed-in staff member, with a full name and email address, an
 * emailed link to set its own password, and one single level of access.
 *
 * The specification keeps staff accounts for good: there is no way to delete or
 * deactivate one, and every account has exactly the same access.
 */
const staffAccountSchema = new mongoose.Schema({
  full_name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  password_hash: { type: String, select: false },
  invite_token: { type: String, index: { sparse: true } },
  invite_expires_at: { type: Date },
  added_by_staff_account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffAccount' },
  added_at: { type: Date, required: true, default: Date.now },
  status: { type: String, required: true, enum: ['invited', 'active'], default: 'invited' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

staffAccountSchema.methods.toPublic = function toPublic(addedBy) {
  return {
    id: String(this._id),
    role: 'hotel_staff',
    full_name: this.full_name,
    email: this.email,
    status: this.status,
    added_by: addedBy ?? null,
    added_at: this.added_at,
  };
};

export const StaffAccount = mongoose.models.StaffAccount
  ?? mongoose.model('StaffAccount', staffAccountSchema);
