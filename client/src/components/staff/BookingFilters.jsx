import { Button, Field, Input, Panel, Select } from '../index.jsx';

const STATUSES = [
  ['any', 'Any status'],
  ['confirmed', 'Confirmed'],
  ['waiting', 'Waiting for payment'],
  ['cancelled', 'Cancelled'],
];

/**
 * Finding a booking: by the nights it covers, by any part of the guest's name, by
 * room type or by status.
 *
 * The form holds what is typed until Apply is pressed, so the results underneath
 * change once and not on every keystroke, and Clear puts every field back to
 * "any" in one go.
 */
export function BookingFilters({ draft, onChange, onApply, onClear, applied, roomTypes = [], matchCount, perPage }) {
  const changed = Object.keys(draft).some((key) => String(draft[key] ?? '') !== String(applied[key] ?? ''));
  const anyFilter = Object.values(applied).some((value) => value && value !== 'any');

  return (
    <Panel as="section" aria-labelledby="filters-title" style={{ marginTop: 'var(--space-6)' }}>
      <h2 id="filters-title">Find a booking</h2>
      <form
        className="form-grid form-grid--3"
        onSubmit={(event) => {
          event.preventDefault();
          onApply();
        }}
      >
        <Field label="Check-in date" htmlFor="f-in">
          <Input type="date" id="f-in" value={draft.check_in} onChange={(event) => onChange('check_in', event.target.value)} />
        </Field>
        <Field label="Check-out date" htmlFor="f-out">
          <Input type="date" id="f-out" value={draft.check_out} onChange={(event) => onChange('check_out', event.target.value)} />
        </Field>
        <Field label="Guest name" htmlFor="f-name">
          <Input
            type="text"
            id="f-name"
            placeholder="Any part of the name"
            value={draft.guest}
            onChange={(event) => onChange('guest', event.target.value)}
          />
        </Field>
        <Field label="Room type" htmlFor="f-room">
          <Select id="f-room" value={draft.room_type_id} onChange={(event) => onChange('room_type_id', event.target.value)}>
            <option value="any">Any room type</option>
            {roomTypes.map((roomType) => (
              <option key={roomType.id} value={roomType.id}>
                {roomType.name}{roomType.on_sale ? '' : ' (off sale)'}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="f-status">
          <Select id="f-status" value={draft.status} onChange={(event) => onChange('status', event.target.value)}>
            {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
        <div className="field">
          <span className="label">Filters</span>
          <div className="row">
            <Button kind="primary" size="sm" type="submit" disabled={!changed}>Apply filters</Button>
            <Button kind="ghost" size="sm" type="button" onClick={onClear} disabled={!anyFilter && !changed}>Clear filters</Button>
          </div>
        </div>
      </form>
      <p className="small muted">
        {matchCount} {matchCount === 1 ? 'booking matches' : 'bookings match'} these filters. {perPage} rows per page.
      </p>
    </Panel>
  );
}
