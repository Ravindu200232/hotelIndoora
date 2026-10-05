import { Field, FormGrid, FormSummary, Input, Panel, Textarea } from '../index.jsx';

/**
 * The rules a room type is held to, in the browser as well as on the server.
 *
 * The same bounds as the service: name 2 to 120 characters, a rate above 0.00 and
 * up to 99,999.99 with at most two decimal places, 1 to 500 rooms, 1 to 20
 * guests, a size above zero with at most one decimal place, and a description of
 * at most 2,000 characters. What the server refuses is shown beside the field and
 * listed at the top of the form, so nothing typed is lost.
 */
export function validateRoomType(values = {}) {
  const errors = {};

  const name = String(values.name ?? '').trim();
  if (!name) errors.name = 'Enter the name guests see.';
  else if (name.length < 2 || name.length > 120) errors.name = 'Enter between 2 and 120 characters.';

  if (String(values.description ?? '').length > 2000) {
    errors.description = 'Keep the description to 2,000 characters or fewer.';
  }

  const rate = Number(values.nightly_rate);
  if (values.nightly_rate === '' || values.nightly_rate == null || !Number.isFinite(rate) || rate <= 0 || rate > 99999.99) {
    errors.nightly_rate = 'Enter a rate above 0.00 and up to 99,999.99.';
  } else if (Math.round(rate * 100) !== rate * 100) {
    errors.nightly_rate = 'Give a price with at most two decimal places.';
  }

  const rooms = Number(values.room_count);
  if (values.room_count === '' || values.room_count == null || !Number.isInteger(rooms) || rooms < 1 || rooms > 500) {
    errors.room_count = 'Enter between 1 and 500 rooms.';
  }

  const guests = Number(values.max_guests);
  if (values.max_guests === '' || values.max_guests == null || !Number.isInteger(guests) || guests < 1 || guests > 20) {
    errors.max_guests = 'Enter between 1 and 20 guests.';
  }

  if (values.room_size_sqm !== '' && values.room_size_sqm != null) {
    const size = Number(values.room_size_sqm);
    if (!Number.isFinite(size) || size <= 0) errors.room_size_sqm = 'Enter a size above zero.';
    else if (Math.round(size * 10) !== size * 10) errors.room_size_sqm = 'Give a size with at most one decimal place.';
  }

  return errors;
}

/** The fields every room type form carries, laid out for the page it is on. */
function Fieldset({ values, onChange, errors }) {
  const field = (id, label, { hint, type = 'text', full, placeholder, min, max, step } = {}) => (
    <Field key={id} label={label} htmlFor={id} hint={hint} error={errors[id]} full={full}>
      <Input
        id={id}
        name={id}
        type={type}
        value={values[id] ?? ''}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        error={errors[id]}
        onChange={(event) => onChange(id, event.target.value)}
      />
    </Field>
  );

  const name = field('name', 'Name', {
    hint: '2 to 120 characters. The name guests see, for example Garden Deluxe Double.',
    full: true,
    placeholder: 'Garden Deluxe Double',
  });

  const description = (
    <Field
      key="description"
      label="Description"
      htmlFor="description"
      hint="Up to 2,000 characters. Shown in full on the room type page."
      error={errors.description}
      full
    >
      <Textarea
        id="description"
        name="description"
        value={values.description ?? ''}
        error={errors.description}
        onChange={(event) => onChange('description', event.target.value)}
      />
    </Field>
  );

  const rate = field('nightly_rate', 'Nightly rate', {
    hint: 'Per night, in euro, above 0.00 and up to 99,999.99 with at most two decimal places. This is the final price — nothing is added at checkout.',
    placeholder: '195.00',
  });
  const rooms = field('room_count', 'Number of rooms', {
    hint: '1 to 500. Rooms that are alike share one room type.',
    type: 'number',
    min: 1,
    max: 500,
    placeholder: '6',
  });
  const guests = field('max_guests', 'Maximum number of guests', {
    hint: 'Enter between 1 and 20 guests. A search for more guests than this leaves the room type out.',
    type: 'number',
    min: 1,
    max: 20,
    placeholder: '3',
  });
  const bed = field('bed_type_and_size', 'Bed type and size', {
    hint: 'Written as guests should read it.',
    placeholder: 'Queen bed, 160 × 200 cm',
  });
  const size = field('room_size_sqm', 'Room size in square metres', {
    hint: 'Above zero, with at most one decimal place.',
    placeholder: '24.0',
  });

  return { name, description, rate, rooms, guests, bed, size };
}

/**
 * The room type form, used for a new room type and for changing an existing one.
 *
 * The two pages group the same fields differently - a new room type is filled in
 * name-and-price first, while editing puts the name and description together and
 * keeps the rate beside them - so the layout follows the page it is on and the
 * rules, the error handling and the slots for photographs, amenities and the
 * on-sale switch are shared.
 */
export function RoomTypeForm({
  mode = 'create',
  values,
  onChange,
  errors = {},
  saving,
  onSubmit,
  summaryTitle = 'We could not save this room type',
  photos,
  amenities,
  onSale,
  extra,
  alerts,
  actions,
}) {
  const { name, description, rate, rooms, guests, bed, size } = Fieldset({ values, onChange, errors });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {Object.keys(errors).length ? (
        <FormSummary title={summaryTitle} fields={errors} />
      ) : null}

      {mode === 'create' ? (
        <>
          <Panel as="section" aria-labelledby="room-rate-title">
            <h2 id="room-rate-title">Room and rate</h2>
            <p className="small muted">The name guests see, what a night costs, and how many rooms of this type the hotel has.</p>
            <FormGrid>
              {name}
              {rate}
              {rooms}
            </FormGrid>
          </Panel>

          <Panel as="section" aria-labelledby="room-details-title" style={{ marginTop: 'var(--space-5)' }}>
            <h2 id="room-details-title">Description and details</h2>
            <p className="small muted">What the room is like, its bed, its size and how many guests it takes.</p>
            <FormGrid>
              {description}
              {bed}
              {size}
              {guests}
            </FormGrid>
          </Panel>
        </>
      ) : (
        <>
          <Panel as="section" aria-labelledby="edit-details">
            <h2 id="edit-details">Details</h2>
            <FormGrid>
              {name}
              {description}
            </FormGrid>
          </Panel>

          <Panel as="section" aria-labelledby="edit-rate" style={{ marginTop: 'var(--space-5)' }}>
            <h2 id="edit-rate">Rate</h2>
            <FormGrid>
              {rate}
              {rooms}
              {guests}
              {bed}
              {size}
            </FormGrid>
          </Panel>
        </>
      )}

      {photos ? (
        <Panel as="section" aria-labelledby="photos-title" style={{ marginTop: 'var(--space-5)' }}>
          {photos}
        </Panel>
      ) : null}

      {amenities ? (
        <Panel as="section" aria-labelledby="amenities-title" style={{ marginTop: 'var(--space-5)' }}>
          {amenities}
        </Panel>
      ) : null}

      {onSale ? (
        <Panel as="section" aria-labelledby="on-sale-title" style={{ marginTop: 'var(--space-5)' }}>
          <h2 id="on-sale-title">On sale</h2>
          {onSale}
        </Panel>
      ) : null}
      {extra}

      {alerts}

      <div className="row" style={{ marginTop: 'var(--space-5)' }}>
        {actions ?? (
          <button className="btn btn--primary" type="submit" disabled={saving} aria-busy={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        )}
      </div>
    </form>
  );
}
