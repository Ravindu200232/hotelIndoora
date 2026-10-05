import mongoose from 'mongoose';

/**
 * Room Type: the sellable unit of the hotel. Several identical physical rooms
 * share one room type, and availability is counted from `room_count`.
 *
 * The bounds are the specification's: name 2 to 120 characters and unique, a
 * nightly rate above zero and at most 99,999.99 with two decimals, a room count
 * of 1 to 500, a maximum of 1 to 20 guests, room size above zero with one
 * decimal place, and a description of at most 2,000 characters.
 */
const roomTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120, unique: true },
  nightly_rate: {
    type: Number,
    required: true,
    min: 0.01,
    max: 99999.99,
    validate: {
      validator: (value) => Math.round(Number(value) * 100) === Number(value) * 100,
      message: 'Give a price with at most two decimal places, such as 180.00.',
    },
  },
  room_count: { type: Number, required: true, min: 1, max: 500 },
  description: { type: String, default: '', maxlength: 2000 },
  bed_type_and_size: { type: String, default: '', trim: true },
  // Each entry is a storage object path in the photographs bucket.
  photos: { type: [String], default: [] },
  amenities: { type: [String], default: [] },
  max_guests: { type: Number, required: true, min: 1, max: 20 },
  room_size_sqm: {
    type: Number,
    min: 0.1,
    validate: {
      validator: (value) => value === undefined || value === null
        || Math.round(Number(value) * 10) === Number(value) * 10,
      message: 'Give a size with at most one decimal place, such as 24.0.',
    },
  },
  on_sale: { type: Boolean, required: true, default: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Availability filters on the on-sale flag, so it is indexed with the name.
roomTypeSchema.index({ on_sale: 1, name: 1 });

roomTypeSchema.methods.toPublic = function toPublic({ photoUrls = [] } = {}) {
  return {
    id: String(this._id),
    name: this.name,
    nightly_rate: this.nightly_rate,
    room_count: this.room_count,
    description: this.description ?? '',
    bed_type_and_size: this.bed_type_and_size ?? '',
    photos: photoUrls.length ? photoUrls : this.photos,
    amenities: this.amenities ?? [],
    max_guests: this.max_guests,
    room_size_sqm: this.room_size_sqm ?? null,
    on_sale: Boolean(this.on_sale),
    // When the room type was last changed, for the desk's own page.
    updated_at: this.updated_at ?? null,
  };
};

export const RoomType = mongoose.models.RoomType ?? mongoose.model('RoomType', roomTypeSchema);
