import { Link } from 'react-router-dom';
import { Badge, List, ListItem, Panel, Ref } from '../index.jsx';
import { formatShortDate, formatStayRange } from '../../api.js';

/**
 * What is booked ahead: who is coming, which room type they hold, the nights
 * they are staying and the reference the desk works from.
 *
 * The list is refreshed on its own, so a booking that arrives while the desk is
 * watching appears without a reload - and when a refresh does not come back the
 * page says so instead of quietly showing something stale.
 */
export function UpcomingList({ bookings = [], roomTypeName, staleAt, onRetry }) {
  return (
    <Panel>
      <div className="row row--between">
        <h3 id="waiting-title" style={{ margin: 0 }}>Upcoming bookings</h3>
        <Link className="link-arrow" to="/staff/bookings">View all {bookings.length}</Link>
      </div>

      {staleAt ? (
        <div className="alert alert--warn" role="status" style={{ marginTop: 'var(--space-3)' }}>
          <span className="alert__icon" aria-hidden="true">!</span>
          <div className="alert__body">
            <span className="alert__title">This list did not refresh</span>
            Showing the bookings loaded at {staleAt}.{' '}
            <button className="link-arrow" type="button" onClick={onRetry}>Retry</button>
          </div>
        </div>
      ) : null}

      {bookings.length === 0 ? (
        <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
          Nothing is booked ahead yet. A new booking appears here as soon as it is paid.
        </p>
      ) : (
        <List style={{ marginTop: 'var(--space-3)' }}>
          {bookings.map((booking) => (
            <ListItem
              key={booking.id}
              title={booking.lead_guest_name}
              to={`/staff/bookings/${booking.id}`}
              sub={`${roomTypeName(booking.room_type_id)} · ${formatStayRange(booking.check_in_date, booking.check_out_date, booking.nights)}`}
              side={(
                <>
                  <Ref>{booking.booking_reference ?? 'Not issued yet'}</Ref>
                  <Badge kind="confirmed">Confirmed</Badge>
                </>
              )}
            />
          ))}
        </List>
      )}

      {bookings.length ? (
        <p className="small muted">
          Next arrival {formatShortDate(bookings[0].check_in_date)} · {bookings.length} coming up.
        </p>
      ) : null}
    </Panel>
  );
}
