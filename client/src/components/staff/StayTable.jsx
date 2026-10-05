import { Caption, Panel, Table, Tbody, Td, Th, Tr } from '../index.jsx';
import { formatDate, money } from '../../api.js';

/**
 * What the booking covers: the room type, the nights and the rate that was
 * applied when it was made.
 *
 * The nightly rate sits on the booking itself, so a later change to the room
 * type's price never rewrites what a guest already agreed to pay.
 */
export function StayTable({ booking, roomTypeName }) {
  const rows = [
    ['Room type', roomTypeName],
    ['Check-in date', formatDate(booking.check_in_date)],
    ['Check-out date', formatDate(booking.check_out_date)],
    ['Nights', booking.nights],
    ['Nightly rate at the time of booking', money(booking.nightly_rate)],
    ['Total', money(booking.total_price)],
    [
      'Booked by',
      booking.booked_by === 'staff'
        ? `Staff${booking.booked_by_staff_name ? ` · ${booking.booked_by_staff_name}` : ''}`
        : 'The guest, online',
    ],
  ];
  return (
    <Panel as="section" aria-labelledby="stay-title" style={{ marginTop: 'var(--space-5)' }}>
      <h2 id="stay-title">Stay</h2>
      <Table>
        <Caption hidden>What this booking covers</Caption>
        <Tbody>
          {rows.map(([label, value]) => (
            <Tr key={label}>
              <Th scope="row">{label}</Th>
              <Td>{value}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Panel>
  );
}
