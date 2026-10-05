import { Checkline } from '../index.jsx';

/**
 * The one switch that decides whether guests can book a room type at all.
 *
 * Turning it off keeps the room type and every booking already made on it, and
 * only stops it appearing to guests for the nights it has free - which is why a
 * room type is never deleted.
 */
export function OnSaleToggle({ id = 'on_sale', checked, onChange, label, hint }) {
  return (
    <Checkline
      id={id}
      label={label ?? 'This room type is on sale'}
      hint={hint ?? 'Guests can book it for the nights it is free. Turn it off to keep it and its bookings but stop selling it.'}
      checked={Boolean(checked)}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}
