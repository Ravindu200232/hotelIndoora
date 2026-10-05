import { Link } from 'react-router-dom';
import { Badge, Caption, Panel, Table, TableWrap, Tbody, Td, Thead, Tr } from '../index.jsx';

/**
 * Who is arriving today: the lead guest, their room type, when they said they
 * would arrive and the number to ring them on.
 */
export function ArrivalsTable({ bookings = [], roomTypeName }) {
  return (
    <Panel>
      <div className="row row--between">
        <h3 style={{ margin: 0 }}>Arrivals <Badge kind="sale">{bookings.length}</Badge></h3>
        <Link className="link-arrow" to="/staff/bookings">Open Bookings</Link>
      </div>

      {bookings.length === 0 ? (
        <p className="small muted" style={{ marginTop: 'var(--space-4)' }}>No guests are arriving today.</p>
      ) : (
        <TableWrap style={{ marginTop: 'var(--space-4)' }}>
          <Table>
            <Caption hidden>Guests arriving today</Caption>
            <Thead columns={['Lead guest', 'Room type', 'Expected arrival', 'Contact phone']} />
            <Tbody>
              {bookings.map((booking) => (
                <Tr key={booking.id}>
                  <Td label="Lead guest">
                    <Link to={`/staff/bookings/${booking.id}`}>{booking.lead_guest_name}</Link>
                  </Td>
                  <Td label="Room type">{roomTypeName(booking.room_type_id)}</Td>
                  <Td label="Expected arrival">{booking.expected_arrival_time}</Td>
                  <Td label="Contact phone">{booking.contact_phone}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      )}
    </Panel>
  );
}
