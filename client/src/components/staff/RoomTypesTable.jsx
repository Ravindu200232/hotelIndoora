import { Link } from 'react-router-dom';
import { Badge, Caption, CellMain, CellSub, Table, TableWrap, Tbody, Td, Thead, Tr } from '../index.jsx';
import { formatShortDate, money } from '../../api.js';

/** `Queen bed · 24 m² · up to 3 guests` — the line under a room type's name. */
export function roomTypeSummary(roomType) {
  return [
    roomType.bed_type_and_size,
    roomType.room_size_sqm ? `${roomType.room_size_sqm} m²` : null,
    roomType.max_guests ? `up to ${roomType.max_guests} guests` : null,
  ].filter(Boolean).join(' · ');
}

/**
 * Every room type the hotel runs, with what it sells for, how many rooms it has,
 * whether guests can book it and what is out of service ahead.
 *
 * A room type is never deleted - taking it off sale keeps it and its bookings
 * while stopping new ones - so the on-sale column is the switch the desk uses.
 */
export function RoomTypesTable({ roomTypes = [] }) {
  return (
    <TableWrap>
      <Table>
        <Caption hidden>
          Every room type with its rate, room count, on-sale state and the nights blocked ahead.
        </Caption>
        <Thead columns={['Room type', 'Nightly rate', 'Rooms', 'On sale', 'Dates blocked ahead']} />
        <Tbody>
          {roomTypes.map((roomType) => (
            <Tr key={roomType.id}>
              <Td label="Room type">
                <CellMain><Link to={`/staff/room-types/${roomType.id}`}>{roomType.name}</Link></CellMain>
                <CellSub>{roomTypeSummary(roomType)}</CellSub>
              </Td>
              <Td label="Nightly rate"><span className="nowrap">{money(roomType.nightly_rate)}</span></Td>
              <Td label="Rooms">{roomType.room_count}</Td>
              <Td label="On sale">
                <Badge kind={roomType.on_sale ? 'sale' : 'off'}>{roomType.on_sale ? 'On sale' : 'Off sale'}</Badge>
              </Td>
              <Td label="Dates blocked ahead">
                <CellSub>
                  {roomType.nights_blocked_ahead > 0
                    ? `${roomType.nights_blocked_ahead} ${roomType.nights_blocked_ahead === 1 ? 'night' : 'nights'} · from ${formatShortDate(roomType.next_blocked_night)}${roomType.next_blocked_reason ? ` · ${roomType.next_blocked_reason}` : ''}`
                    : 'None ahead'}
                </CellSub>
                <Link to={`/staff/room-types/${roomType.id}/blocks`}>Blocked dates</Link>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableWrap>
  );
}
