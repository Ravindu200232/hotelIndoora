import { Link } from 'react-router-dom';
import { Badge, Caption, Table, TableWrap, Tbody, Td, Thead, Tr } from '../index.jsx';
import { formatShortDate, money } from '../../api.js';

const STATUS = {
  confirmed: { kind: 'confirmed', label: 'Confirmed' },
  pending_payment: { kind: 'pending', label: 'Waiting for payment' },
  cancelled: { kind: 'cancelled', label: 'Cancelled' },
};

/** A booking's status, as the desk reads it. */
export function StatusBadge({ status }) {
  const shape = STATUS[status] ?? { kind: 'neutral', label: status ?? 'Unknown' };
  return <Badge kind={shape.kind}>{shape.label}</Badge>;
}

/**
 * Every booking that matches the filters, oldest stay first, with the reference
 * the desk works from and the amount the booking stands at.
 */
export function BookingsTable({ bookings = [], roomTypeName }) {
  return (
    <TableWrap>
      <Table>
        <Caption hidden>Bookings matching the filters</Caption>
        <Thead columns={[
          'Booking reference',
          'Guest',
          'Room type',
          'Check-in',
          'Check-out',
          'Status',
          'Total',
        ]} />
        <Tbody>
          {bookings.map((booking) => (
            <Tr key={booking.id}>
              <Td label="Booking reference">
                <Link to={`/staff/bookings/${booking.id}`}>{booking.booking_reference ?? 'Not issued yet'}</Link>
              </Td>
              <Td label="Guest">{booking.lead_guest_name}</Td>
              <Td label="Room type">{roomTypeName(booking.room_type_id)}</Td>
              <Td label="Check-in">{formatShortDate(booking.check_in_date).slice(4)}</Td>
              <Td label="Check-out">{formatShortDate(booking.check_out_date).slice(4)}</Td>
              <Td label="Status"><StatusBadge status={booking.status} /></Td>
              <Td label="Total">{money(booking.total_price)}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableWrap>
  );
}

/** Where the results come from, how many there are, and the pages they run over. */
export function BookingResultsHead({ total, page, perPage, roomsLabel }) {
  const first = total === 0 ? 0 : (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);
  return (
    <div className="section__head">
      <div>
        <h2 id="results-title">Results</h2>
        <p>
          {total} {total === 1 ? 'booking matches' : 'bookings match'} these filters
          {total ? ` · rows ${first} to ${last} of ${total} matches` : ''}
        </p>
      </div>
      <span className="chip">{roomsLabel}</span>
    </div>
  );
}
