import { OptionCard, Skeleton } from '../index.jsx';
import { money } from '../../api.js';

/**
 * The room types the desk can put a booking into, for the nights it is moving to.
 *
 * The free ones are radio rows carrying everything the desk says out loud on the
 * phone — the rate, how many rooms are left, how many guests the type sleeps and
 * the total for the stay. Anything that cannot be taken is shown rather than
 * hidden, with the reason: no room free for those nights, or a room type that
 * sleeps fewer people than are coming.
 */
export function AvailabilityChooser({
  allRoomTypes = [],
  freeRoomTypes = [],
  selectedId,
  onSelect,
  nights,
  guests,
  currentRoomTypeId,
  loading,
  idPrefix = 'rt',
}) {
  const freeById = new Map(freeRoomTypes.map((row) => [String(row.room_type_id ?? row.id), row]));

  if (loading) {
    return (
      <>
        <p className="small muted">Working out what is free…</p>
        <Skeleton style={{ display: 'block', width: '60%', marginTop: 'var(--space-3)' }} />
        <Skeleton style={{ display: 'block', width: '45%', marginTop: 'var(--space-3)' }} />
      </>
    );
  }

  const rows = new Map();
  for (const roomType of allRoomTypes) {
    const id = String(roomType.id);
    const free = freeById.get(id);
    rows.set(id, {
      roomType,
      free,
      freeRooms: Number(free?.free_rooms ?? 0),
      rate: Number(free?.nightly_rate ?? roomType.nightly_rate),
      total: Number(free?.total ?? Number(roomType.nightly_rate) * Number(nights || 0)),
    });
  }

  if (!rows.size) {
    return <p className="small muted">No room type is on sale at the moment, so there is nothing to book.</p>;
  }

  return (
    <>
      {[...rows.values()].map(({ roomType, free, freeRooms, rate, total }, index) => {
        const id = String(roomType.id);
        const tooManyGuests = Number(roomType.max_guests) < Number(guests || 1);
        const notFree = freeRooms < 1;
        const disabled = tooManyGuests || notFree;
        const isCurrent = currentRoomTypeId != null && id === String(currentRoomTypeId);
        const note = [
          `${money(rate)} a night`,
          notFree ? null : `${freeRooms} ${freeRooms === 1 ? 'room' : 'rooms'} free`,
          `sleeps ${roomType.max_guests}`,
          isCurrent ? 'the room type on this booking now' : null,
        ].filter(Boolean).join(' · ');

        return (
          <OptionCard
            key={id}
            id={`${idPrefix}-${id}`}
            name="roomtype"
            value={id}
            checked={String(selectedId) === id && !disabled}
            disabled={disabled}
            onChange={() => onSelect(id)}
            style={{ marginTop: index > 0 ? 'var(--space-3)' : undefined }}
            title={roomType.name}
            note={note}
            detail={tooManyGuests
              ? `Taken a guest too many — this booking has ${guests} ${Number(guests) === 1 ? 'person' : 'people'} staying.`
              : notFree
                ? 'No room of this type is free for these nights.'
                : null}
            price={notFree ? '—' : money(total)}
            priceNote={notFree ? 'not free' : `${nights} ${Number(nights) === 1 ? 'night' : 'nights'}`}
          />
        );
      })}
    </>
  );
}

/** The room types free for the nights being chosen, as the availability answer gives them. */
export function freeRoomTypesOf(answer) {
  return answer?.room_types ?? [];
}
