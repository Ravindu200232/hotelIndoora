import { Badge, List, ListItem, Panel, Ref } from '../index.jsx';
import { formatStayRange, formatTime, money } from '../../api.js';

/**
 * The bookings that are holding a room but have not been paid for yet: who they
 * are for, what they cost, who took them and how long the room is held.
 *
 * A booking the desk took keeps its room until the guest pays the emailed link;
 * one made online releases its room half an hour after it was made.
 */
export function WaitingPaymentList({ bookings = [], roomTypeName }) {
  return (
    <Panel>
      <div className="row row--between">
        <h3 style={{ margin: 0 }}>Bookings waiting for payment</h3>
        <span className="chip">Room held while the guest pays</span>
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
              title={booking.lead_guest_name}
              to={`/staff/bookings/${booking.id}`}
              sub={`${roomTypeName(booking.room_type_id)} · ${formatStayRange(booking.check_in_date, booking.check_out_date, booking.nights)} · ${money(booking.total_price)}`}
              side={(
                <>
                  <Ref>{booking.booking_reference ?? 'Not issued yet'}</Ref>
                  <Badge kind="pending">Waiting for payment</Badge>
                </>
              )}
            >
              <span className="list__sub">
                {booking.booked_by === 'staff'
                  ? `Taken by staff${booking.booked_by_staff_name ? ` · ${booking.booked_by_staff_name}` : ''} · ${formatTime(booking.booked_at)}`
                  : booking.hold_expires_at
                    ? `Booked online · held until ${formatTime(booking.hold_expires_at)}`
                    : 'Booked online · held until the desk cancels it'}
              </span>
            </ListItem>
          ))}
        </List>
      )}

      <p className="small muted">
        A booking taken by staff holds its room until the guest pays the emailed link. A booking made online releases its
        room 30 minutes after it was made.
      </p>
    </Panel>
  );
}
