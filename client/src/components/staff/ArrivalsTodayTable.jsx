import { Link } from 'react-router-dom';
import { Badge, Caption, Panel, Table, TableWrap, Tbody, Td, Thead, Tr } from '../index.jsx';

/** Guests arriving today, as the desk needs them: who, which room, when, and the number. */
export function ArrivalsTodayTable({ bookings = [], roomTypeName }) {
  return (
    <Panel as="section" aria-labelledby="arrivals-title">
      <div className="row row--between">
        <h2 id="arrivals-title" style={{ margin: 0 }}>Arrivals today</h2>
        <Badge kind="sale">{bookings.length} {bookings.length === 1 ? 'guest' : 'guests'}</Badge>
      </div>

      {bookings.length === 0 ? (
        <p className="small muted" style={{ marginTop: 'var(--space-4)' }}>No guests are arriving today.</p>
      ) : (
        <TableWrap style={{ marginTop: 'var(--space-4)' }}>
          <Table>
            <Caption hidden>Guests arriving today</Caption>
            <Thead columns={['Guest', 'Room type', 'Expected', 'Phone']} />
            <Tbody>
              {bookings.map((booking) => (
                <Tr key={booking.id}>
                  <Td label="Guest"><Link to={`/staff/bookings/${booking.id}`}>{booking.lead_guest_name}</Link></Td>
                  <Td label="Room type">{roomTypeName(booking.room_type_id)}</Td>
                  <Td label="Expected">{booking.expected_arrival_time}</Td>
                  <Td label="Phone">{booking.contact_phone}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      )}
    </Panel>
  );
}
