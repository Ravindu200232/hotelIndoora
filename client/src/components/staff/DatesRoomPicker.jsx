import { Alert, Button, Field, Input, Panel } from '../index.jsx';
import { formatDate, money } from '../../api.js';
import { AvailabilityChooser } from './AvailabilityChooser.jsx';

const iso = (value) => String(value ?? '').slice(0, 10);

/** The dates and the party, held to the same rules the service holds them to. */
export function validateStay(values = {}) {
  const errors = {};
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const from = values.check_in_date ? new Date(`${iso(values.check_in_date)}T00:00:00.000Z`) : null;
  const to = values.check_out_date ? new Date(`${iso(values.check_out_date)}T00:00:00.000Z`) : null;

  if (!from || Number.isNaN(from.getTime())) errors.check_in_date = 'Choose the night the guest arrives.';
  else if (from < today) errors.check_in_date = 'Choose a check-in date from today onwards.';

  if (!to || Number.isNaN(to.getTime())) errors.check_out_date = 'Choose the morning the guest leaves.';
  else if (from && to <= from) {
    errors.check_out_date = `Enter a check-out date later than the check-in date, ${formatDate(from)}.`;
  }

  const guests = Number(values.guest_count);
  if (values.guest_count === '' || values.guest_count == null || !Number.isInteger(guests) || guests < 1 || guests > 20) {
    errors.guest_count = 'Enter between 1 and 20 guests.';
  }
  return errors;
}

/**
 * The first step of taking a booking for a guest: the nights and the party.
 *
 * The room types that follow come from the hotel's own availability for those
 * nights, so the desk sees what can actually be sold — and anything that cannot is
 * shown with its reason rather than left out silently.
 */
export function DatesRoomPicker({
  values,
  onChange,
  errors = {},
  onCheck,
  checking,
  nights,
  allRoomTypes = [],
  freeRoomTypes = [],
  selectedId,
  onSelect,
  noneFree,
}) {
  return (
    <Panel as="section" aria-labelledby="dates-title">
      <h2 id="dates-title">Dates and room type</h2>
      <p className="small muted">One booking covers one room of one room type — two rooms means two bookings.</p>

      <form
        className="form-grid form-grid--3"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onCheck();
        }}
      >
        <Field
          label="Check-in date"
          htmlFor="check_in_date"
          hint="The night the guest arrives. Check-in opens at 15:00."
          error={errors.check_in_date}
        >
          <Input
            type="date"
            id="check_in_date"
            value={values.check_in_date}
            error={errors.check_in_date}
            onChange={(event) => onChange('check_in_date', event.target.value)}
          />
        </Field>
        <Field
          label="Check-out date"
          htmlFor="check_out_date"
          hint="The morning the guest leaves. Check-out is by 11:00."
          error={errors.check_out_date}
        >
          <Input
            type="date"
            id="check_out_date"
            value={values.check_out_date}
            error={errors.check_out_date}
            onChange={(event) => onChange('check_out_date', event.target.value)}
          />
        </Field>
        <Field
          label="Number of guests"
          htmlFor="guest_count"
          hint="Room types that take fewer guests are left out."
          error={errors.guest_count}
        >
          <Input
            type="number"
            id="guest_count"
            min={1}
            max={20}
            value={values.guest_count}
            error={errors.guest_count}
            onChange={(event) => onChange('guest_count', event.target.value)}
          />
        </Field>
      </form>

      <Button kind="ghost" size="sm" type="button" onClick={onCheck} disabled={checking} style={{ marginTop: 'var(--space-4)' }}>
        {checking ? 'Checking availability…' : 'Check availability'}
      </Button>

      <div className="section__head" style={{ marginTop: 'var(--space-5)' }}>
        <div>
          <h3>
            Free for {formatDate(values.check_in_date)} → {formatDate(values.check_out_date)} · {nights}{' '}
            {nights === 1 ? 'night' : 'nights'} · {values.guest_count} {Number(values.guest_count) === 1 ? 'guest' : 'guests'}
          </h3>
          <p>Nightly rate · total for the stay</p>
        </div>
      </div>

      {checking ? (
        <Alert kind="info" title="Working out what is free">
          Working out what is free for {formatDate(values.check_in_date)} → {formatDate(values.check_out_date)}…
        </Alert>
      ) : null}

      {!checking && noneFree ? (
        <Alert kind="error" title={`No room type is free for ${formatDate(values.check_in_date)} → ${formatDate(values.check_out_date)}`}>
          Every room of every room type is taken or out of service for these nights. Change the dates and check again.
        </Alert>
      ) : null}

      {!checking && !noneFree ? (
        <AvailabilityChooser
          allRoomTypes={allRoomTypes}
          freeRoomTypes={freeRoomTypes}
          selectedId={selectedId}
          onSelect={onSelect}
          nights={nights}
          guests={values.guest_count}
          loading={false}
          idPrefix="nb-rt"
        />
      ) : null}

      {!checking && freeRoomTypes.length && selectedId ? (
        (() => {
          const row = freeRoomTypes.find((one) => String(one.room_type_id) === String(selectedId));
          if (!row) return null;
          return (
            <Alert kind="success" title={`${row.name} is free`} style={{ marginTop: 'var(--space-4)' }}>
              {row.free_rooms} of {row.room_count} rooms free for {formatDate(values.check_in_date)} →{' '}
              {formatDate(values.check_out_date)} · {money(row.nightly_rate)} a night · {money(row.total)} total for the
              stay.
            </Alert>
          );
        })()
      ) : null}
    </Panel>
  );
}
