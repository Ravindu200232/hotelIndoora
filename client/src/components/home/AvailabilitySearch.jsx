import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../ui/feedback.jsx';

/**
 * The dates-and-guests search that starts every booking: check-in, check-out and
 * how many are coming. A refused search marks the field that failed rather than
 * sending the person to a results page that cannot answer.
 *
 * The dates default to the prototype's own stay when that is still ahead, and to
 * a stay a fortnight out otherwise, so the page always opens on a usable search.
 */
export function defaultStay() {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const prototype = { checkIn: '2026-06-12', checkOut: '2026-06-15' };
  const ahead = new Date(`${prototype.checkIn}T00:00:00.000Z`) > today;
  const from = ahead ? prototype.checkIn : new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10);
  const to = ahead ? prototype.checkOut : new Date(today.getTime() + 17 * 86400000).toISOString().slice(0, 10);
  return { checkIn: from, checkOut: to, guests: 2 };
}

export function stayProblems({ checkIn, checkOut, guests }) {
  const errors = {};
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const from = checkIn ? new Date(`${checkIn}T00:00:00.000Z`) : null;
  const to = checkOut ? new Date(`${checkOut}T00:00:00.000Z`) : null;
  if (!from || Number.isNaN(from.getTime())) errors.checkIn = 'Choose the night you arrive.';
  else if (from < today) errors.checkIn = 'Choose a check-in date from today onwards.';
  if (!to || Number.isNaN(to.getTime())) errors.checkOut = 'Choose the night you leave.';
  else if (from && to <= from) errors.checkOut = 'Choose a check-out date later than the check-in date.';
  const party = Number(guests);
  if (!Number.isInteger(party) || party < 1) errors.guests = 'Enter how many guests are coming.';
  return errors;
}

export function AvailabilitySearch({ initial, note, title = 'Check availability', submitLabel = 'Search availability' }) {
  const navigate = useNavigate();
  const [values, setValues] = useState(initial ?? defaultStay());
  const [errors, setErrors] = useState({});
  const [refused, setRefused] = useState(false);

  const set = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setRefused(false);
  };

  const submit = (event) => {
    event.preventDefault();
    const problems = stayProblems(values);
    setErrors(problems);
    if (Object.keys(problems).length) {
      setRefused(true);
      return;
    }
    navigate(`/rooms?check_in=${values.checkIn}&check_out=${values.checkOut}&guests=${values.guests}`);
  };

  return (
    <>
      <form className="search-bar" id="home-search" onSubmit={submit} noValidate>
        <h3 id="search-title">{title}</h3>
        <div className="search-bar__row">
          <div className={`field${errors.checkIn ? ' field--invalid' : ''}`}>
            <label htmlFor="checkin">Check-in date</label>
            <input
              type="date"
              id="checkin"
              name="check_in"
              value={values.checkIn}
              aria-invalid={errors.checkIn ? 'true' : undefined}
              onChange={set('checkIn')}
            />
            {errors.checkIn ? <span className="field__error">{errors.checkIn}</span> : null}
          </div>
          <div className={`field${errors.checkOut ? ' field--invalid' : ''}`}>
            <label htmlFor="checkout">Check-out date</label>
            <input
              type="date"
              id="checkout"
              name="check_out"
              value={values.checkOut}
              aria-invalid={errors.checkOut ? 'true' : undefined}
              onChange={set('checkOut')}
            />
            {errors.checkOut ? <span className="field__error">{errors.checkOut}</span> : null}
          </div>
          <div className={`field${errors.guests ? ' field--invalid' : ''}`}>
            <label htmlFor="guests">Number of guests</label>
            <input
              type="number"
              id="guests"
              name="guests"
              min="1"
              max="20"
              value={values.guests}
              aria-invalid={errors.guests ? 'true' : undefined}
              onChange={set('guests')}
            />
            {errors.guests ? <span className="field__error">{errors.guests}</span> : null}
          </div>
          <div>
            <button className="btn btn--primary" type="submit">{submitLabel}</button>
          </div>
        </div>
        <p className="search-bar__note">
          {note ?? 'One room per booking. Two rooms means two bookings. Nothing is added to the nightly rate at checkout.'}
        </p>
      </form>

      <Alert kind="error" title="Check the dates before searching" hidden={!refused}>
        A stay is at least one night, and a check-in cannot be in the past. The field that needs changing is marked
        above.
      </Alert>
    </>
  );
}
