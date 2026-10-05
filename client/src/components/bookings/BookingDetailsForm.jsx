import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../index.jsx';
import { api } from '../../api.js';

/**
 * Who is staying and when to expect them: the lead guest's full name, a contact
 * phone number, how many are staying, the expected arrival time and any special
 * requests — the details the hotel needs, and the same fields the approved
 * prototype asks for.
 *
 * A refused field keeps everything else that was typed and is marked where it
 * failed, whether the refusal comes from this form or from the server.
 */
const ARRIVAL_TIMES = ['Before 12:00', '12:00 – 15:00', '15:00 – 18:00', '18:00 – 21:00', 'After 21:00'];

export function BookingDetailsForm({ roomType, stay, account, onCreated }) {
  const navigate = useNavigate();
  const [values, setValues] = useState({
    lead_guest_name: account?.full_name ?? '',
    contact_phone: account?.phone_number ?? '',
    guest_count: String(stay.guests ?? 2),
    expected_arrival_time: '18:00 – 21:00',
    special_requests: '',
  });
  const [state, setState] = useState({ status: 'idle', errors: {}, code: null, message: null, booking: null });

  const set = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setState((current) => ({ ...current, errors: { ...current.errors, [field]: undefined }, code: null, message: null }));
  };

  const problems = () => {
    const errors = {};
    const name = values.lead_guest_name.trim();
    if (name.length < 2 || name.length > 120) errors.lead_guest_name = 'Enter between 2 and 120 characters.';
    if (!/^[+0-9][0-9\s\-()]{5,29}$/.test(values.contact_phone.trim())) {
      errors.contact_phone = 'Enter a phone number with digits, spaces, hyphens or a leading plus.';
    }
    const guests = Number(values.guest_count);
    if (!Number.isInteger(guests) || guests < 1) errors.guest_count = 'Enter how many guests are staying.';
    else if (roomType?.max_guests && guests > Number(roomType.max_guests)) {
      errors.guest_count = `${guests} guests is more than a ${roomType.name} sleeps. Enter 1 to ${roomType.max_guests}, or change room type.`;
    }
    return errors;
  };

  const submit = async (event) => {
    event.preventDefault();
    const errors = problems();
    if (Object.keys(errors).length) {
      setState({ status: 'refused', errors, code: 'validation', message: 'Check the form' });
      return;
    }
    setState({ status: 'working', errors: {}, code: null, message: null });
    try {
      const payload = await api.createBooking({
        room_type_id: roomType.id,
        check_in_date: stay.checkIn,
        check_out_date: stay.checkOut,
        lead_guest_name: values.lead_guest_name.trim(),
        contact_phone: values.contact_phone.trim(),
        guest_count: Number(values.guest_count),
        expected_arrival_time: values.expected_arrival_time,
        special_requests: values.special_requests,
      });
      setState({ status: 'created', errors: {}, code: null, message: null, booking: payload.booking });
      const id = payload.booking?.id;
      onCreated?.(payload);
      // The payment step is where the full amount is settled.
      navigate(`/bookings/new/payment?booking_id=${id}${payload.payments_unavailable ? '&payments=unavailable' : ''}`);
    } catch (error) {
      const code = error.code ?? 'failed';
      setState({
        status: 'refused',
        errors: error.errors ?? {},
        code,
        message: error.message,
      });
    }
  };

  const unconfirmed = state.code === 'email_unconfirmed';
  const gone = state.code === 'no_room_free';

  return (
    <>
      {state.status === 'working' ? (
        <div className="panel panel--tint" aria-busy="true">
          <p style={{ margin: 0 }}>
            <span className="skeleton" style={{ display: 'inline-block', width: '60%' }} /> Checking that a{' '}
            {roomType?.name} is still free for your nights…
          </p>
        </div>
      ) : null}

      {state.code === 'validation' ? (
        <Alert kind="error" title="Check one field before you go on">
          <ul>
            {Object.entries(state.errors).map(([field, message]) => (
              <li key={field}><a href={`#${field.replace(/_/g, '-')}`}>{message}</a></li>
            ))}
          </ul>
          Everything else you entered has been kept.
        </Alert>
      ) : null}

      <form className="panel" onSubmit={submit} noValidate>
        <h2>Who is staying</h2>
        <div className="form-grid">
          <div className={`field${state.errors.lead_guest_name ? ' field--invalid' : ''}`}>
            <label htmlFor="lead-guest-name">Lead guest's full name</label>
            <input
              type="text"
              id="lead-guest-name"
              name="lead_guest_name"
              autoComplete="name"
              value={values.lead_guest_name}
              aria-invalid={state.errors.lead_guest_name ? 'true' : undefined}
              onChange={set('lead_guest_name')}
            />
            <span className="field__hint">As it should read on the booking and at reception.</span>
            {state.errors.lead_guest_name ? <span className="field__error">{state.errors.lead_guest_name}</span> : null}
          </div>

          <div className={`field${state.errors.contact_phone ? ' field--invalid' : ''}`}>
            <label htmlFor="contact-phone">Contact phone number</label>
            <input
              type="tel"
              id="contact-phone"
              name="contact_phone"
              autoComplete="tel"
              value={values.contact_phone}
              aria-invalid={state.errors.contact_phone ? 'true' : undefined}
              onChange={set('contact_phone')}
            />
            <span className="field__hint">So the hotel can reach you on the day you arrive.</span>
            {state.errors.contact_phone ? <span className="field__error">{state.errors.contact_phone}</span> : null}
          </div>

          <div className={`field${state.errors.guest_count ? ' field--invalid' : ''}`}>
            <label htmlFor="guest-count">Number of guests staying</label>
            <input
              type="number"
              id="guest-count"
              name="guest_count"
              min="1"
              max="20"
              value={values.guest_count}
              aria-invalid={state.errors.guest_count ? 'true' : undefined}
              onChange={set('guest_count')}
            />
            <span className="field__hint">
              A {roomType?.name} sleeps up to {roomType?.max_guests} guests, so 1 to {roomType?.max_guests} can stay.
            </span>
            {state.errors.guest_count ? <span className="field__error">{state.errors.guest_count}</span> : null}
          </div>

          <div className="field">
            <label htmlFor="arrival">Expected arrival time</label>
            <select id="arrival" name="expected_arrival_time" value={values.expected_arrival_time} onChange={set('expected_arrival_time')}>
              {ARRIVAL_TIMES.map((slot) => <option key={slot}>{slot}</option>)}
            </select>
            <span className="field__hint">
              Rooms are ready from 15:00. After 22:00, call ahead and the key is left in the entrance box.
            </span>
          </div>

          <div className="field field--full">
            <label htmlFor="notes">Special requests or notes</label>
            <textarea id="notes" name="special_requests" value={values.special_requests} onChange={set('special_requests')} />
            <span className="field__hint">Optional. The hotel will do its best, but cannot promise every request.</span>
          </div>
        </div>

        {gone ? (
          <Alert kind="error" title={`The last ${roomType?.name} for these nights has just gone`}>
            Nothing has been charged. Pick another room type or other dates to carry on.
            <div className="row" style={{ marginTop: 'var(--space-3)' }}>
              <Link className="btn btn--primary btn--sm" to="/rooms">See other rooms</Link>
            </div>
          </Alert>
        ) : null}

        {unconfirmed ? (
          <Alert kind="warn" title="Your email address is not confirmed yet">
            Open the link we emailed to {account?.email} before you book.
            <div className="row" style={{ marginTop: 'var(--space-3)' }}>
              <Link className="btn btn--primary btn--sm" to="/confirm-email">Confirm your email</Link>
            </div>
          </Alert>
        ) : null}

        {state.code === 'failed' || state.code === 'availability_unavailable' ? (
          <Alert kind="error" title="We could not create the booking">
            {state.message} — nothing has been booked and nothing has been charged. Try again in a moment.
          </Alert>
        ) : null}

        <div className="row" style={{ marginTop: 'var(--space-5)' }}>
          <button className="btn btn--primary" type="submit" aria-busy={state.status === 'working'}>
            {state.status === 'working' ? 'Saving…' : 'Continue to payment'}
          </button>
          <Link className="btn btn--ghost" to="/rooms">Change dates or room type</Link>
        </div>
      </form>
    </>
  );
}
