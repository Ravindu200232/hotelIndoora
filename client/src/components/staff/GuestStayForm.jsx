import { Field, Input, Panel, Textarea } from '../index.jsx';

const PHONE = /^[+0-9][0-9\s\-()]{5,29}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** The guest's own details, held to the same rules the service holds them to. */
export function validateGuest(values = {}, { maxGuests, checkInTime } = {}) {
  const errors = {};

  const name = String(values.lead_guest_name ?? '').trim();
  if (!name) errors.lead_guest_name = "Enter the lead guest's full name.";
  else if (name.length < 2 || name.length > 120) errors.lead_guest_name = 'Enter between 2 and 120 characters.';

  const email = String(values.guest_email ?? '').trim();
  if (!email) errors.guest_email = 'Enter the guest’s email address, so the payment link and the confirmation can reach them.';
  else if (!EMAIL.test(email)) errors.guest_email = 'Enter an email address in the correct format, like name@example.com.';

  if (!PHONE.test(String(values.contact_phone ?? '').trim())) {
    errors.contact_phone = 'Enter a phone number with digits, spaces, hyphens or a leading plus.';
  }

  const guests = Number(values.guest_count);
  if (!Number.isInteger(guests) || guests < 1) {
    errors.guest_count = 'Enter how many guests are staying.';
  } else if (maxGuests && guests > Number(maxGuests)) {
    errors.guest_count = `This room type sleeps up to ${maxGuests} guests. Enter ${maxGuests} or fewer, or pick another room type.`;
  }

  const arrival = String(values.expected_arrival_time ?? '').trim();
  if (!arrival) errors.expected_arrival_time = 'Choose the time you expect to arrive.';
  else if (!TIME.test(arrival)) errors.expected_arrival_time = 'Give the time as HH:MM, for example 15:30.';
  else if (checkInTime && arrival < checkInTime) {
    errors.expected_arrival_time = `Rooms are ready from ${checkInTime}. Choose that time or later.`;
  }

  if (String(values.special_requests ?? '').length > 1000) {
    errors.special_requests = 'Keep notes to 1,000 characters or fewer.';
  }

  return errors;
}

/**
 * The guest the desk is taking the booking for, exactly as they gave it on the
 * phone — the address the payment link and the confirmation both go to, the number
 * the hotel rings on the day, and anything the guest asked for.
 */
export function GuestStayForm({ values, onChange, errors = {}, checkInTime, maxGuests }) {
  return (
    <Panel as="section" aria-labelledby="guest-title" style={{ marginTop: 'var(--space-5)' }}>
      <h2 id="guest-title">Guest and stay details</h2>
      <p className="small muted">The guest's own name, email address and phone number, as they gave them on the phone.</p>
      <div className="form-grid">
        <Field label="Guest's full name" htmlFor="lead_guest_name" error={errors.lead_guest_name}>
          <Input
            type="text"
            id="lead_guest_name"
            autoComplete="name"
            value={values.lead_guest_name}
            error={errors.lead_guest_name}
            onChange={(event) => onChange('lead_guest_name', event.target.value)}
          />
        </Field>
        <Field label="Email address" htmlFor="guest_email" hint="The PayPal payment link and the confirmation go here." error={errors.guest_email}>
          <Input
            type="email"
            id="guest_email"
            autoComplete="email"
            value={values.guest_email}
            error={errors.guest_email}
            onChange={(event) => onChange('guest_email', event.target.value)}
          />
        </Field>
        <Field label="Phone number" htmlFor="contact_phone" error={errors.contact_phone}>
          <Input
            type="tel"
            id="contact_phone"
            autoComplete="tel"
            value={values.contact_phone}
            error={errors.contact_phone}
            onChange={(event) => onChange('contact_phone', event.target.value)}
          />
        </Field>
        <Field
          label="Expected arrival time"
          htmlFor="expected_arrival_time"
          hint={checkInTime ? `Check-in opens at ${checkInTime}.` : 'The time the guest expects to arrive.'}
          error={errors.expected_arrival_time}
        >
          <Input
            type="text"
            id="expected_arrival_time"
            placeholder="15:30"
            value={values.expected_arrival_time}
            error={errors.expected_arrival_time}
            onChange={(event) => onChange('expected_arrival_time', event.target.value)}
          />
        </Field>
        <Field label="Notes" htmlFor="special_requests" error={errors.special_requests} full>
          <Textarea
            id="special_requests"
            rows={4}
            value={values.special_requests}
            error={errors.special_requests}
            onChange={(event) => onChange('special_requests', event.target.value)}
          />
        </Field>
      </div>
      {maxGuests ? (
        <p className="small muted" style={{ margin: 0 }}>
          This room type sleeps up to {maxGuests} {Number(maxGuests) === 1 ? 'guest' : 'guests'}.
        </p>
      ) : null}
    </Panel>
  );
}
