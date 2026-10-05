import { Alert, Button, Field, FormGrid, FormSummary, Input, Panel, ProgressTrack, Textarea } from '../index.jsx';
import { formatShortDate } from '../../api.js';

/** The nights a range covers: the first and last night both count. */
export function nightsInRange(first, last) {
  const start = new Date(`${String(first).slice(0, 10)}T00:00:00.000Z`);
  const end = new Date(`${String(last).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.round((end - start) / 86400000) + 1;
}

/** The same rules the service holds a block to, checked before it is sent. */
export function validateBlock(values = {}) {
  const errors = {};
  if (!values.first_night) errors.first_night = 'Choose the first night out of service.';
  if (!values.last_night) errors.last_night = 'Choose the last night out of service.';
  else if (values.first_night && values.last_night < values.first_night) {
    errors.last_night = `Enter a night on or after ${formatShortDate(values.first_night).slice(4)}.`;
  }
  const reason = String(values.reason ?? '').trim();
  if (reason.length < 3 || reason.length > 200) {
    errors.reason = 'Give a reason between 3 and 200 characters, for example repairs, painting or a long let.';
  }
  return errors;
}

/**
 * Taking a range of nights out of service, with the reason the team reads later.
 *
 * Saving stops new bookings for those nights only: every room of the room type
 * comes off sale for them, and a stay already booked keeps its room, its dates and
 * its price. Nothing is refunded and no booking is moved by blocking.
 */
export function BlockForm({
  values,
  onChange,
  errors = {},
  nights,
  roomTypeName,
  roomCount,
  saving,
  onSave,
}) {
  return (
    <Panel as="section" aria-labelledby="block-form-title">
      {Object.keys(errors).length ? (
        <FormSummary
          title={`Check ${Object.keys(errors).length} ${Object.keys(errors).length === 1 ? 'field' : 'fields'} before you save this block`}
          fields={errors}
        />
      ) : null}

      <h2 id="block-form-title">Nights out of service</h2>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <FormGrid>
          <Field
            label="First night out of service"
            htmlFor="first_night"
            hint="The first night these rooms are off sale."
            error={errors.first_night}
          >
            <Input
              type="date"
              id="first_night"
              name="first_night"
              value={values.first_night}
              error={errors.first_night}
              onChange={(event) => onChange('first_night', event.target.value)}
            />
          </Field>
          <Field
            label="Last night out of service"
            htmlFor="last_night"
            hint={values.first_night
              ? `The last night must be on or after the first night, ${formatShortDate(values.first_night).slice(4)}.`
              : 'The last night must be on or after the first night.'}
            error={errors.last_night}
          >
            <Input
              type="date"
              id="last_night"
              name="last_night"
              value={values.last_night}
              error={errors.last_night}
              onChange={(event) => onChange('last_night', event.target.value)}
            />
          </Field>
        </FormGrid>

        <h3 style={{ marginTop: 'var(--space-5)' }}>Reason</h3>
        <Field
          label="Why these rooms are out of service"
          htmlFor="reason"
          hint="For example repairs, painting or a long let. The team reads this on the blocked dates list."
          error={errors.reason}
        >
          <Textarea
            id="reason"
            name="reason"
            value={values.reason}
            maxLength={200}
            error={errors.reason}
            onChange={(event) => onChange('reason', event.target.value)}
          />
        </Field>

        <p className="small muted">
          {nights > 0
            ? `Saving takes one of the ${roomCount} ${roomCount === 1 ? 'room' : 'rooms'} of ${roomTypeName} out of service for ${nights} ${nights === 1 ? 'night' : 'nights'}, so those nights have one fewer room to sell.`
            : `Saving takes a room of ${roomTypeName} out of service for the nights you give, so those nights have one fewer room to sell.`}{' '}
          Bookings already made keep their room, their dates and their price.
        </p>

        <div className="row">
          <Button kind="primary" type="submit" disabled={saving} aria-busy={saving}>
            {saving ? 'Saving…' : 'Save block'}
          </Button>
          <a className="btn btn--ghost" href={`/staff/room-types/${values.roomTypeId}/blocks`}>Cancel</a>
        </div>
      </form>

      {saving ? (
        <Alert kind="info" title="Saving the block…" style={{ marginTop: 'var(--space-5)' }}>
          <ProgressTrack percent={60} />
        </Alert>
      ) : null}
    </Panel>
  );
}
