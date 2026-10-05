import mongoose from 'mongoose';

/**
 * Room Block: a range of nights on which one room type's rooms are taken out of
 * service and stop being sold. Blocking stops new bookings only - a booking
 * already made for one of those nights is left exactly as it is.
 */
const roomBlockSchema = new mongoose.Schema({
  room_type_id: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true },
  first_night: { type: Date, required: true },
  last_night: { type: Date, required: true },
  reason: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
  blocked_by_staff_account_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  // The desk's own name at the moment the block was made, so the list can show
  // who blocked it without asking the auth service for a label.
  blocked_by_name: { type: String, default: '' },
  blocked_at: { type: Date, required: true, default: Date.now },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// A range is looked up per room type, ordered by its first night.
roomBlockSchema.index({ room_type_id: 1, first_night: 1 });

roomBlockSchema.methods.toPublic = function toPublic(blockedBy) {
  const nights = Math.round((this.last_night - this.first_night) / 86400000) + 1;
  return {
    id: String(this._id),
    room_type_id: String(this.room_type_id),
    first_night: this.first_night,
    last_night: this.last_night,
    nights,
    reason: this.reason,
    blocked_by: this.blocked_by_name || blockedBy || null,
    blocked_at: this.blocked_at,
  };
};

export const RoomBlock = mongoose.models.RoomBlock ?? mongoose.model('RoomBlock', roomBlockSchema);
