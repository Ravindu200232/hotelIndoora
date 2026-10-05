import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import { Alert, Button, EmptyState, Panel, SectionHead, Skeleton, Topbar } from '../components/index.jsx';
import { RoomTypesStats } from '../components/staff/RoomTypesStats.jsx';
import { RoomTypesTable } from '../components/staff/RoomTypesTable.jsx';

/**
 * Room Types: every room type the hotel runs, in one table.
 *
 * Rates are per night for one room of one room type and the nightly rate is the
 * whole price, so the table carries the four things the desk changes most often -
 * the rate, how many rooms there are, whether it is on sale, and what is out of
 * service ahead - with a way into each room type and into its blocked dates.
 */
export function RoomTypesPage() {
  const location = useLocation();
  const roomTypes = useAsync(() => api.staffRoomTypes(), []);
  const saved = location.state?.saved;
  const roomTypesList = roomTypes.data?.room_types ?? [];

  return (
    <>
      <Topbar
        title="Room types"
        note="Rates are per night, for one room of one room type. The nightly rate is the whole price."
        actions={(
          <>
            <Link className="btn btn--primary" to="/staff/room-types/new">New room type</Link>
            <Link className="btn btn--ghost" to="/staff">Dashboard</Link>
          </>
        )}
      />

      {saved ? (
        <Alert kind="success" title="Room type saved">
          {saved.name} is on sale and bookable for its free nights.
        </Alert>
      ) : null}

      {roomTypes.loading ? (
        <Panel style={{ marginTop: 'var(--space-5)' }}>
          <p className="small muted" style={{ margin: 0 }}>Loading room types…</p>
          <Skeleton variant="lg" style={{ display: 'block', width: '35%', marginTop: 'var(--space-3)' }} />
          <Skeleton style={{ display: 'block', width: '85%', marginTop: 'var(--space-3)' }} />
          <Skeleton style={{ display: 'block', width: '70%', marginTop: 'var(--space-3)' }} />
        </Panel>
      ) : null}

      {roomTypes.failed ? (
        <Alert kind="error" title="Room types could not be loaded" style={{ marginTop: 'var(--space-5)' }}>
          {roomTypes.error.message} — nothing has changed.
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Button kind="primary" size="sm" type="button" onClick={roomTypes.reload}>Try again</Button>
            <Link className="btn btn--ghost btn--sm" to="/staff">Dashboard</Link>
          </div>
        </Alert>
      ) : null}

      {roomTypes.ready && roomTypesList.length === 0 ? (
        <EmptyState
          title="No room types yet"
          action={<Link className="btn btn--primary" to="/staff/room-types/new">New room type</Link>}
        >
          Add the first room type to start taking bookings for the hotel.
        </EmptyState>
      ) : null}

      {roomTypes.ready && roomTypesList.length > 0 ? (
        <>
          <RoomTypesStats roomTypes={roomTypesList} />

          <section className="section" style={{ padding: 'var(--space-6) 0 0' }} aria-labelledby="every-title">
            <SectionHead
              title="Every room type"
              note="Open a room type to change its rate, rooms or details, or to reach the nights its rooms are out of service."
            />
            <RoomTypesTable roomTypes={roomTypesList} />
          </section>

          <Panel tint style={{ marginTop: 'var(--space-5)' }}>
            <h4>How availability is counted</h4>
            <p className="small muted">
              Free rooms on a night are the room type's number of rooms, less the rooms booked for that night and the
              rooms blocked for it. A room type never shows a free count below zero, and taking one off sale stops it
              appearing to guests while its existing bookings stay valid. A room type is never deleted.
            </p>
            <div className="row">
              <Link className="btn btn--ghost btn--sm" to="/staff/bookings">Bookings</Link>
              <Link className="btn btn--quiet btn--sm" to="/">View the guest site</Link>
            </div>
          </Panel>
        </>
      ) : null}
    </>
  );
}
