import { Field, FormGrid, FormSummary, Input, Panel, Textarea } from '../index.jsx';

const PHONE = /^[+0-9][0-9\s\-()]{5,29}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

const minutes = (time) => {
  const [hours, mins] = String(time).split(':').map(Number);
  return hours * 60 + mins;
};

/** The same rules the service holds the hotel's details to, checked here first. */
export function validateHotelDetails(values = {}) {
  const errors = {};

  const name = String(values.hotel_name ?? '').trim();
  if (!name) errors.hotel_name = 'Enter the hotel name.';
  else if (name.length < 2 || name.length > 120) errors.hotel_name = 'Enter between 2 and 120 characters.';

  const address = String(values.address ?? '').trim();
  if (address.length < 10 || address.length > 300) {
    errors.address = 'Enter the address, between 10 and 300 characters.';
  }

  if (!PHONE.test(String(values.phone_number ?? '').trim())) {
    errors.phone_number = 'Enter a phone number with digits, spaces, hyphens or a leading plus.';
  }
  if (!EMAIL.test(String(values.email_address ?? '').trim())) {
    errors.email_address = 'Enter an email address in the correct format, like stay@hotelindoora.com.';
  }
  if (!TIME.test(String(values.check_in_time ?? '').trim())) {
    errors.check_in_time = 'Enter the check-in time as HH:MM, for example 15:00.';
  }
  if (!TIME.test(String(values.check_out_time ?? '').trim())) {
    errors.check_out_time = 'Enter the check-out time as HH:MM, for example 11:00.';
  } else if (TIME.test(String(values.check_in_time ?? '').trim())
    && minutes(values.check_out_time) <= minutes(values.check_in_time)) {
    errors.check_out_time = 'Check-out time must be later than the check-in time.';
  }

  return errors;
}

/**
 * The one set of public details the hotel keeps.
 *
 * Everything here appears on the guest site and in the emails the hotel sends, so
 * the fields say where each one is read: the name at the top of every page, the
 * address on Home and every room type page, the phone number on the confirmation,
 * the times beside every stay, and the house rules where guests look for them.
 */
export function HotelDetailsForm({ values, onChange, errors = {} }) {
  const field = (id, label, hint, options = {}) => (
    <Field key={id} label={label} htmlFor={id} hint={hint} error={errors[id]} full={options.full}>
      <Input
        id={id}
        name={id}
        type={options.type ?? 'text'}
        value={values[id] ?? ''}
        error={errors[id]}
        onChange={(event) => onChange(id, event.target.value)}
      />
    </Field>
  );

  return (
    <form noValidate>
      {Object.keys(errors).length ? (
        <FormSummary title={`There is a problem with ${Object.keys(errors).length} ${Object.keys(errors).length === 1 ? 'field' : 'fields'}`} fields={errors} />
      ) : null}

      <Panel as="section" aria-labelledby="the-hotel-title">
        <h2 id="the-hotel-title">The hotel</h2>
        <FormGrid>
          {field('hotel_name', 'Hotel name', 'Shown at the top of every page and in every email we send.', { full: true })}
          <Field label="Address" htmlFor="address" hint="Shown on Home, on every room type page and in the confirmation email." error={errors.address} full>
            <Textarea
              id="address"
              name="address"
              rows={3}
              value={values.address ?? ''}
              error={errors.address}
              onChange={(event) => onChange('address', event.target.value)}
            />
          </Field>
        </FormGrid>
      </Panel>

      <Panel as="section" aria-labelledby="reach-title" style={{ marginTop: 'var(--space-5)' }}>
        <h2 id="reach-title">How guests reach you</h2>
        <FormGrid>
          {field('phone_number', 'Phone number', 'Printed on the booking confirmation.', { type: 'tel' })}
          {field('email_address', 'Email address', 'Guests reply to their confirmation here.', { type: 'email' })}
        </FormGrid>
      </Panel>

      <Panel as="section" aria-labelledby="times-title" style={{ marginTop: 'var(--space-5)' }}>
        <h2 id="times-title">Arrival and departure</h2>
        <FormGrid>
          {field('check_in_time', 'Check-in time', '24-hour clock, for example 15:00.')}
          {field('check_out_time', 'Check-out time', 'Must be later than the check-in time.')}
        </FormGrid>
      </Panel>

      <Panel as="section" aria-labelledby="rules-title" style={{ marginTop: 'var(--space-5)' }}>
        <h2 id="rules-title">House rules</h2>
        <Field
          label="House rules"
          htmlFor="house_rules"
          hint="Plain text. Guests read these on Home and on every room type page."
          error={errors.house_rules}
        >
          <Textarea
            id="house_rules"
            name="house_rules"
            rows={6}
            value={values.house_rules ?? ''}
            error={errors.house_rules}
            onChange={(event) => onChange('house_rules', event.target.value)}
          />
        </Field>
      </Panel>
    </form>
  );
}
