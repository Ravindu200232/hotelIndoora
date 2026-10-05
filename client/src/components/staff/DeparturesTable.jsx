import { Link } from 'react-router-dom';
import { Badge, Caption, Panel, Table, TableWrap, Tbody, Td, Thead, Tr } from '../index.jsx';

/** Who is leaving today, in the room type they stayed in. */
export function DeparturesTable({ bookings = [], roomTypeName }) {
  return (
    <Panel>
      <div className="row row--between">
        <h3 style={{ margin: 0 }}>Departures <Badge kind="neutral">{bookings.length}</Badge></h3>
        <Link className="link-arrow" to="/staff/bookings">Open Bookings</Link>
      </div>

      {bookings.length === 0 ? (
        <p className="small muted" style={{ marginTop: 'var(--space-4)' }}>No guests are leaving today.</p>
      ) : (
        <TableWrap style={{ marginTop: 'var(--space-4)' }}>
          <Table>
            <Caption hidden>Guests leaving today</Caption>
            <Thead columns={['Lead guest', 'Room type', 'Status']} />
            <Tbody>
              {bookings.map((booking) => (
                <Tr key={booking.id}>
                  <Td label="Lead guest">
                    <Link to={`/staff/bookings/${booking.id}`}>{booking.lead_guest_name}</Link>
                  </Td>
                  <Td label="Room type">{roomTypeName(booking.room_type_id)}</Td>
                  <Td label="Status"><Badge kind="confirmed">Confirmed</Badge></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      )}
    </Panel>
  );
}
