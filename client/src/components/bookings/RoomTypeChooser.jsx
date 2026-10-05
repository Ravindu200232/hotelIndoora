import { money } from '../../api.js';
import { OptionCard, Skeleton } from '../index.jsx';

/**
 * The room types free for the new dates, each with its rate, the total for the
 * stay and how many rooms are left — the room type on the booking now marked as
 * such, and anything that cannot be taken disabled with the reason why.
 *
 * A room type with no room free for those nights, or one that sleeps fewer
 * guests than are staying, is shown rather than hidden: the guest can see what is
 * unavailable and why, and pick something that works.
 */
export function RoomTypeChooser({
  roomTypes = [],
  allRoomTypes = [],
  selectedId,
  onSelect,
  nights,
  guests,
  currentRoomTypeId,
  loading,
}) {
  const freeById = new Map(roomTypes.map((roomType) => [String(roomType.room_type_id ?? roomType.id), roomType]));
  const rows = new Map();
  for (const roomType of allRoomTypes) {
    const free = freeById.get(String(roomType.id));
    rows.set(String(roomType.id), {
      roomType,
      freeRooms: free?.free_rooms ?? 0,
      rate: Number(free?.nightly_rate ?? roomType.nightly_rate),
      total: Number(free?.total ?? Number(roomType.nightly_rate) * nights),
    });
  }
  // A room type that is on sale but sold out for those nights still belongs in
  // the list, so use whatever the availability answer called free as well.
  for (const roomType of roomTypes) {
    const id = String(roomType.room_type_id ?? roomType.id);
    if (!rows.has(id)) {
      rows.set(id, { roomType, freeRooms: roomType.free_rooms ?? 0, rate: Number(roomType.nightly_rate), total: Number(roomType.total) });
    }
  }

  if (loading) {
    return (
      <>
        <Skeleton style={{ display: 'block', width: '70%' }} />
        <Skeleton style={{ display: 'block', width: '45%', marginTop: 'var(--space-3)' }} />
      </>
    );
  }

  return (
    <>
      {[...rows.values()].map(({ roomType, freeRooms, rate, total }, index) => {
        const id = String(roomType.id);
        const tooManyGuests = Number(roomType.max_guests) < Number(guests);
        const notFree = freeRooms < 1;
        const disabled = tooManyGuests || notFree;
        const reason = tooManyGuests
          ? `This room type sleeps up to ${roomType.max_guests} guests and ${guests} are staying — it cannot take this booking.`
          : notFree
            ? `No room of ${roomType.name} is free for these nights.`
            : null;
        return (
          <OptionCard
            key={id}
            id={`rt-${id}`}
            name="roomtype"
            value={id}
            checked={String(selectedId) === id && !disabled}
            disabled={disabled}
            onChange={() => onSelect(id)}
            style={{ marginTop: index > 0 ? 'var(--space-3)' : undefined }}
            title={id === String(currentRoomTypeId) ? `${roomType.name} — your room type now` : roomType.name}
            note={[roomType.bed_type_and_size, roomType.room_size_sqm ? `${roomType.room_size_sqm} m²` : null,
              roomType.max_guests ? `up to ${roomType.max_guests} guests` : null].filter(Boolean).join(' · ')}
            detail={disabled
              ? `${money(rate)} a night · ${reason}`
              : `${money(rate)} a night · ${nights} nights · ${money(total)}`}
            price={disabled ? 'Not free' : (freeRooms === 1 ? '1 room free' : `${freeRooms} rooms free`)}
          />
        );
      })}
    </>
  );
}
