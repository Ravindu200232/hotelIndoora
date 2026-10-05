import { Caption, Panel, Table, Tbody, Th, Tr, Td } from '../index.jsx';

/** The guest the desk rings, as the booking holds them. */
export function GuestDetailsTable({ booking }) {
  const rows = [
    ['Lead guest', booking.lead_guest_name],
    ['Contact phone number', booking.contact_phone],
    ['Email address', booking.guest_email],
    ['Number of guests staying', booking.guest_count],
    ['Expected arrival time', booking.expected_arrival_time],
    ['Special requests', booking.special_requests || 'None'],
  ];
  return (
    <Panel as="section" aria-labelledby="guest-title">
      <h2 id="guest-title">Guest details</h2>
      <Table>
        <Caption hidden>The guest's own details for this booking</Caption>
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
