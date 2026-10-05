const PHONE = /^[+0-9][0-9\s\-()]{5,29}$/;
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * The stay details captured for every booking, whichever side takes it: the
 * lead guest's full name, a contact phone number, the number of guests, the
 * expected arrival time and any special requests.
 */
export function bookingProblems(body = {}, { maxGuests, stay } = {}) {
  const errors = {};

  const name = String(body.lead_guest_name ?? '').trim();
  if (!name) errors.lead_guest_name = "Enter the lead guest's full name.";
  else if (name.length < 2 || name.length > 120) errors.lead_guest_name = 'Enter between 2 and 120 characters.';

  if (!PHONE.test(String(body.contact_phone ?? '').trim())) {
    errors.contact_phone = 'Enter a phone number with digits, spaces, hyphens or a leading plus.';
  }

  const guests = Number(body.guest_count);
  if (!Number.isInteger(guests) || guests < 1) {
    errors.guest_count = 'Enter how many guests are staying.';
  } else if (maxGuests && guests > Number(maxGuests)) {
    errors.guest_count = `This room type sleeps up to ${maxGuests} guests. Enter ${maxGuests} or fewer, or pick another room type.`;
  }

  const arrival = String(body.expected_arrival_time ?? '').trim();
  if (!arrival) errors.expected_arrival_time = 'Choose the time you expect to arrive.';
  else if (TIME.test(arrival) && stay?.check_in_time && arrival < stay.check_in_time) {
    errors.expected_arrival_time = `Rooms are ready from ${stay.check_in_time}. Choose that time or later.`;
  }

  const requests = String(body.special_requests ?? '');
  if (requests.length > 1000) errors.special_requests = 'Keep notes to 1,000 characters or fewer.';

  return errors;
}

/** The dates of a stay, from a guest choosing them or staff entering them. */
export function stayProblems(body = {}) {
  const errors = {};
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const from = body.check_in_date ? new Date(body.check_in_date) : null;
  const to = body.check_out_date ? new Date(body.check_out_date) : null;

  if (!from || Number.isNaN(from.getTime())) errors.check_in_date = 'Choose a check-in date.';
  else if (from < today) errors.check_in_date = 'Choose a check-in date from today onwards.';
  if (!to || Number.isNaN(to.getTime())) errors.check_out_date = 'Choose a check-out date.';
  else if (from && to <= from) errors.check_out_date = 'Choose a check-out date later than the check-in date.';
  return errors;
}

export function emailProblem(value) {
  const text = String(value ?? '').trim();
  if (!text) return 'Enter the guest’s email address, so the payment link and the confirmation can reach them.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)) {
    return 'Enter an email address in the correct format, like name@example.com.';
  }
  return null;
}
