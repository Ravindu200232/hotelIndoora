import mongoose from 'mongoose';

/**
 * Hotel Details: the single record of the hotel's public name, address, phone
 * number, email address, check-in and check-out times and house rules.
 *
 * There is one record and no way to add a second or delete it - the shape of
 * the product, not a convenience.
 */
const hotelDetailsSchema = new mongoose.Schema({
  hotel_name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  address: { type: String, required: true, trim: true, minlength: 10, maxlength: 300 },
  phone_number: { type: String, required: true, trim: true },
  email_address: { type: String, required: true, trim: true, lowercase: true },
  check_in_time: { type: String, required: true, trim: true },
  check_out_time: { type: String, required: true, trim: true },
  house_rules: { type: String, default: '' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

hotelDetailsSchema.methods.toPublic = function toPublic() {
  return {
    id: String(this._id),
    hotel_name: this.hotel_name,
    address: this.address,
    phone_number: this.phone_number,
    email_address: this.email_address,
    check_in_time: this.check_in_time,
    check_out_time: this.check_out_time,
    house_rules: this.house_rules ?? '',
    updated_at: this.updated_at,
  };
};

export const HotelDetails = mongoose.models.HotelDetails
  ?? mongoose.model('HotelDetails', hotelDetailsSchema);
