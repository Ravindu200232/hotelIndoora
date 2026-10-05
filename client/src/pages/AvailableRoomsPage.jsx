import { Link, useSearchParams } from 'react-router-dom';
import { api, nightsBetween, stayLabel } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import { Alert, Grid, Panel, Skeleton } from '../components/index.jsx';
import { AvailabilitySearch, defaultStay } from '../components/home/AvailabilitySearch.jsx';
import { RoomResultCard } from '../components/rooms/RoomResultCard.jsx';

/**
 * Available Rooms: every room type with at least one room free for the chosen
 * nights, with its nightly rate and the total for the whole stay — worked out on
 * the server from the room count, less what is booked and what is blocked.
 *
 * The dates live in the address, so a search can be shared, refreshed and gone
 * back to, and the page keeps its loading, empty and error state.
 */
export function AvailableRoomsPage() {
  const [params] = useSearchParams();
  const fallback = defaultStay();
  const checkIn = params.get('check_in') ?? fallback.checkIn;
  const checkOut = params.get('check_out') ?? fallback.checkOut;
  const guests = params.get('guests') ?? String(fallback.guests);
  const nights = nightsBetween(checkIn, checkOut);

  const availability = useAsync(
    () => api.availability({ checkIn, checkOut, guests }),
    [checkIn, checkOut, guests],
  );
  const allRoomTypes = useAsync(() => api.roomTypes(), []);

  const label = stayLabel(checkIn, checkOut, guests);
  const rows = availability.data?.room_types ?? [];

  return (
    <main id="main">
      <div className="wrap page-head">
        <div className="page-head__grid">
          <div>
            <p className="breadcrumb"><Link to="/">Home</Link> / Rooms</p>
            <h1>Available rooms</h1>
            <p className="lead">
              Every room type with at least one room free for your nights, with its nightly rate and the total for the
              stay.
            </p>
          </div>
          <Link className="btn btn--ghost btn--sm" to="/">Back to Home</Link>
        </div>
      </div>

      <section className="section" aria-labelledby="dates-title" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <AvailabilitySearch
            title="Your dates and guests"
            submitLabel="Search again"
            initial={{ checkIn, checkOut, guests }}
            note={`${label}. Room types that take fewer guests than this are left out.`}
          />
        </div>
      </section>

      <section className="section section--tint" aria-labelledby="results-title" style={{ paddingTop: 'var(--space-5)' }}>
        <div className="wrap">
          <div className="section__head">
            <div>
              <h2 id="results-title">Room types free for these nights</h2>
              <p>
                {label}
                {availability.ready ? ` · ${rows.length} ${rows.length === 1 ? 'room type' : 'room types'} free` : ''}
              </p>
            </div>
          </div>

          {availability.loading ? (
            <Panel tint aria-busy="true">
              <p><strong>Working out what is free for {label}…</strong></p>
              <Grid columns={3}>
                <Skeleton variant="card" />
                <Skeleton variant="card" />
                <Skeleton variant="card" />
              </Grid>
            </Panel>
          ) : null}

          {availability.failed ? (
            <Alert kind="error" title="Availability could not be worked out">
              Your dates and guests have been kept: {label}.
              <div className="row" style={{ marginTop: 'var(--space-3)' }}>
                <button className="btn btn--ghost btn--sm" type="button" onClick={availability.reload}>Retry</button>
              </div>
            </Alert>
          ) : null}

          {availability.ready && rows.length > 0 ? (
            <Grid columns={3}>
              {rows.map((roomType) => (
                <RoomResultCard key={roomType.room_type_id ?? roomType.id} roomType={roomType} nights={nights} />
              ))}
            </Grid>
          ) : null}

          {availability.ready && rows.length === 0 ? (
            <div className="empty">
              <h3>No room type is free for {label}</h3>
              <p>All of our rooms are taken or out of service for these nights. Try other dates, or fewer guests.</p>
              <div style={{ maxWidth: 760, margin: 'var(--space-5) auto 0', textAlign: 'left' }}>
                <AvailabilitySearch
                  title="Your dates and guests"
                  submitLabel="Search again"
                  initial={{ checkIn, checkOut, guests }}
                  note="One room per booking, and the nightly rate is the final price."
                />
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="section" aria-labelledby="rooms-help">
        <div className="wrap">
          <div className="split--even">
            <Panel>
              <h3 id="rooms-help">Booking straight with the hotel</h3>
              <ul>
                <li>One booking covers one room of one room type, so two rooms means two bookings.</li>
                <li>The nightly rate is the final price — no tax, cleaning or service fee is added.</li>
                <li>You pay the full amount through PayPal when you book, and the booking is confirmed straight away.</li>
                <li>You can change the dates or the room type yourself later, or cancel and be refunded in full.</li>
              </ul>
              <div className="row">
                <Link className="btn btn--primary btn--sm" to="/">Search other dates</Link>
                <Link className="btn btn--ghost btn--sm" to="/login">Sign in to book</Link>
              </div>
            </Panel>
            <Panel accent>
              <h3>How many rooms of each type the house has</h3>
              <dl className="kv">
                {(allRoomTypes.data?.room_types ?? []).map((roomType) => (
                  <div key={roomType.id}>
                    <dt>{roomType.name}</dt>
                    <dd>{roomType.room_count} rooms</dd>
                  </div>
                ))}
                {allRoomTypes.ready && (allRoomTypes.data?.room_types ?? []).length === 0 ? (
                  <div><dt>Nothing on sale</dt><dd>—</dd></div>
                ) : null}
              </dl>
              <p className="small muted" style={{ marginBottom: 0 }}>
                Room types the hotel has taken off sale are not offered to guests, so they are not listed here.
              </p>
            </Panel>
          </div>
        </div>
      </section>
    </main>
  );
}
