import { Link } from 'react-router-dom';
import { Badge, List, ListItem, Panel } from '../index.jsx';
import { formatDaySpan, money } from '../../api.js';

/**
 * The bookings holding a room that nobody has paid for yet, each saying whether
 * the desk took it or the guest booked it online — which decides how long the
 * room is held.
 */
export function WaitingPaymentPanel({ bookings = [], roomTypeName }) {
  return (
    <Panel as="section" aria-labelledby="waiting-title">
      <div className="row row--between">
        <h2 id="waiting-title" style={{ margin: 0 }}>Waiting for payment</h2>
        <Badge kind="pending">{bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'}</Badge>
      </div>

      {bookings.length === 0 ? (
        <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
          Every booking is paid for. Nothing is holding a room.
        </p>
      ) : (
        <List style={{ marginTop: 'var(--space-3)' }}>
          {bookings.map((booking) => (
            <ListItem
              key={booking.id}
              title={`${booking.booking_reference ?? 'Not issued yet'} · ${booking.lead_guest_name}`}
              to={`/staff/bookings/${booking.id}`}
              sub={`${roomTypeName(booking.room_type_id)} · ${formatDaySpan(booking.check_in_date, booking.check_out_date)} · ${booking.nights} ${booking.nights === 1 ? 'night' : 'nights'} · ${money(booking.total_price)}`}
              side={(
                <>
                  <Badge kind="neutral">{booking.booked_by === 'staff' ? 'Taken by staff' : 'Booked online'}</Badge>
                  <Badge kind="pending">Waiting for payment</Badge>
                </>
              )}
            />
          ))}
        </List>
      )}

      <p className="small muted">
        A booking taken by staff holds its room until the guest pays the emailed link. A booking made online releases
        its room 30 minutes after it was made.
      </p>
    </Panel>
  );
}
