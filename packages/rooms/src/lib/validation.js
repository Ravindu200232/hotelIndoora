const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+0-9][0-9\s\-()]{5,29}$/;
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

const minutes = (time) => {
  const [hours, mins] = String(time).split(':').map(Number);
  return hours * 60 + mins;
};

/**
 * The specification's rules for a room type, in one place, so the form, the
 * route and a test all refuse the same input for the same reason. Every bound
 * has a lower and an upper end: oversized input is refused, not stored.
 */
export function roomTypeProblems(body = {}) {
  const errors = {};
  const name = String(body.name ?? '').trim();
  if (!name) errors.name = 'Enter the name guests see.';
  else if (name.length < 2 || name.length > 120) errors.name = 'Enter between 2 and 120 characters.';

  const description = String(body.description ?? '');
  if (description.length > 2000) errors.description = 'Keep the description to 2,000 characters or fewer.';

  const rate = Number(body.nightly_rate);
  if (!Number.isFinite(rate) || rate <= 0) errors.nightly_rate = 'Enter a rate above 0.00 and up to 99,999.99.';
  else if (rate > 99999.99) errors.nightly_rate = 'Enter a rate above 0.00 and up to 99,999.99.';
  else if (Math.round(rate * 100) !== rate * 100) errors.nightly_rate = 'Give a price with at most two decimal places.';

  const rooms = Number(body.room_count);
  if (!Number.isInteger(rooms) || rooms < 1 || rooms > 500) {
    errors.room_count = 'Enter between 1 and 500 rooms.';
  }

  const guests = Number(body.max_guests);
  if (!Number.isInteger(guests) || guests < 1 || guests > 20) {
    errors.max_guests = 'Enter between 1 and 20 guests.';
  }

  if (body.room_size_sqm !== undefined && body.room_size_sqm !== null && body.room_size_sqm !== '') {
    const size = Number(body.room_size_sqm);
    if (!Number.isFinite(size) || size <= 0) errors.room_size_sqm = 'Enter a size above zero.';
    else if (Math.round(size * 10) !== size * 10) errors.room_size_sqm = 'Give a size with at most one decimal place.';
  }

  if (body.photos !== undefined && (!Array.isArray(body.photos) || body.photos.length > 10)) {
    errors.photos = 'Keep at most 10 photographs on a room type.';
  }

  return errors;
}

export function hotelDetailsProblems(body = {}) {
  const errors = {};
  const name = String(body.hotel_name ?? '').trim();
  if (!name) errors.hotel_name = 'Enter the hotel name.';
  else if (name.length < 2 || name.length > 120) errors.hotel_name = 'Enter between 2 and 120 characters.';

  const address = String(body.address ?? '').trim();
  if (address.length < 10 || address.length > 300) errors.address = 'Enter the address, between 10 and 300 characters.';

  if (!PHONE.test(String(body.phone_number ?? '').trim())) {
    errors.phone_number = 'Enter a phone number with digits, spaces, hyphens or a leading plus.';
  }
  if (!EMAIL.test(String(body.email_address ?? '').trim())) {
    errors.email_address = 'Enter an email address in the correct format, like stay@hotelindoora.com.';
  }
  if (!TIME.test(String(body.check_in_time ?? '').trim())) {
    errors.check_in_time = 'Enter the check-in time as HH:MM, for example 15:00.';
  }
  if (!TIME.test(String(body.check_out_time ?? '').trim())) {
    errors.check_out_time = 'Enter the check-out time as HH:MM, for example 11:00.';
  } else if (TIME.test(String(body.check_in_time ?? '').trim())
    && minutes(body.check_out_time) <= minutes(body.check_in_time)) {
    errors.check_out_time = 'Check-out time must be later than the check-in time.';
  }
  return errors;
}

export function blockProblems(body = {}) {
  const errors = {};
  const first = body.first_night ? new Date(body.first_night) : null;
  const last = body.last_night ? new Date(body.last_night) : null;
  if (!first || Number.isNaN(first.getTime())) errors.first_night = 'Choose the first night out of service.';
  if (!last || Number.isNaN(last.getTime())) errors.last_night = 'Choose the last night out of service.';
  else if (first && last < first) errors.last_night = 'The last night must be on or after the first night.';
  const reason = String(body.reason ?? '').trim();
  if (reason.length < 3 || reason.length > 200) {
    errors.reason = 'Give a reason between 3 and 200 characters, for example repairs, painting or a long let.';
  }
  return errors;
}

export function stayProblems({ check_in: checkIn, check_out: checkOut, guests }) {
  const errors = {};
  const from = checkIn ? new Date(checkIn) : null;
  const to = checkOut ? new Date(checkOut) : null;
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
  if (!from || Number.isNaN(from.getTime())) errors.check_in = 'Choose your check-in date.';
  else if (from < today) errors.check_in = 'Choose a check-in date from today onwards.';
  if (!to || Number.isNaN(to.getTime())) errors.check_out = 'Choose your check-out date.';
  else if (from && to <= from) errors.check_out = 'Choose a check-out date later than the check-in date.';
  const party = Number(guests);
  if (!Number.isInteger(party) || party < 1) errors.guests = 'Enter how many guests are coming.';
  return errors;
}
