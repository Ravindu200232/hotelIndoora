import { Link } from 'react-router-dom';
import { Panel } from '../index.jsx';

/**
 * Shortcuts to the rest of the desk's pages, each carrying the count that makes
 * it worth opening: how many room types there are, what the bookings page can do,
 * how many colleagues there are, and what the hotel's own page holds.
 */
export function ManageShortcuts({ roomTypeCount, roomCount, staffCount }) {
  return (
    <section className="section" style={{ padding: 'var(--space-6) 0 0' }} aria-labelledby="manage-title">
      <div className="section__head">
        <div>
          <h2 id="manage-title">Manage</h2>
          <p>Shortcuts to the rest of the hotel's pages.</p>
        </div>
      </div>
      <div className="grid grid--4">
        <Panel as={Link} to="/staff/room-types" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3>Room Types</h3>
          <p className="small muted">
            {roomTypeCount == null
              ? 'Rates, rooms and blocked dates'
              : `${roomTypeCount} room ${roomTypeCount === 1 ? 'type' : 'types'}${roomCount != null ? ` · ${roomCount} rooms` : ''} · rates, rooms and blocked dates`}
          </p>
        </Panel>
        <Panel as={Link} to="/staff/bookings" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3>Bookings</h3>
          <p className="small muted">Find any booking by date, guest, room type or status</p>
        </Panel>
        <Panel as={Link} to="/staff/team" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3>Team</h3>
          <p className="small muted">
            {staffCount == null
              ? 'One level of access for every staff account'
              : `${staffCount} staff ${staffCount === 1 ? 'account' : 'accounts'} · one level of access`}
          </p>
        </Panel>
        <Panel as={Link} to="/staff/hotel" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3>Hotel Details</h3>
          <p className="small muted">Name, address, phone, email, check-in and check-out times, house rules</p>
        </Panel>
      </div>
    </section>
  );
}
