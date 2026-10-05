import { Stat, Stats } from '../index.jsx';

/**
 * The hotel's rooms in four figures: how many room types there are, how many
 * rooms that adds up to, how many are on sale, and how many nights ahead are out
 * of service across how many ranges.
 */
export function RoomTypesStats({ roomTypes = [] }) {
  const rooms = roomTypes.reduce((sum, roomType) => sum + Number(roomType.room_count ?? 0), 0);
  const onSale = roomTypes.filter((roomType) => roomType.on_sale).length;
  const nights = roomTypes.reduce((sum, roomType) => sum + Number(roomType.nights_blocked_ahead ?? 0), 0);
  const ranges = roomTypes.reduce((sum, roomType) => sum + Number(roomType.blocked_ranges_ahead ?? 0), 0);

  return (
    <Stats>
      <Stat label="Room types" value={roomTypes.length} />
      <Stat label="Rooms in the hotel" value={rooms} />
      <Stat label="On sale" value={onSale} />
      <Stat
        accent
        label="Nights blocked ahead"
        value={nights}
        foot={ranges ? `across ${ranges} ${ranges === 1 ? 'range' : 'ranges'}` : 'nothing blocked'}
      />
    </Stats>
  );
}
