import { Link, useSearchParams } from 'react-router-dom';
import { api, formatDate, nightsBetween } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import { useHotel } from '../hotel.jsx';
import { useSession } from '../session.jsx';
import { Alert, LoadingBlock, Panel, Steps } from '../components/index.jsx';
import { BookingDetailsForm } from '../components/bookings/BookingDetailsForm.jsx';
import { ChosenRoomPanel } from '../components/bookings/ChosenRoomPanel.jsx';

/**
 * Booking Details: who is staying and when to expect them, for the room type and
 * dates already chosen. The room is checked once more before the form is sent —
 * the last one can always go while someone is typing — and a guest whose email
 * address is not confirmed is told to confirm it first, which is also what the
 * server enforces.
 */
export function BookingDetailsPage() {
  const [params] = useSearchParams();
  const { account, signedIn } = useSession();
  const { hotel } = useHotel();

  const roomTypeId = params.get('room_type_id');
  const checkIn = params.get('check_in');
  const checkOut = params.get('check_out');
  const guests = params.get('guests') ?? '2';
  const chosen = Boolean(roomTypeId && checkIn && checkOut);

  const roomType = useAsync(
    () => (chosen ? api.roomType(roomTypeId) : Promise.resolve({ room_type: null })),
    [roomTypeId, chosen],
  );
  const availability = useAsync(
    () => (chosen ? api.availability({ checkIn, checkOut, guests }) : Promise.resolve({ room_types: [] })),
    [chosen, checkIn, checkOut, guests],
  );

  if (!chosen) {
    return (
      <main id="main">
        <div className="wrap section">
          <h1>Booking details</h1>
          <p className="lead">
            Choose your dates and the room type you want first — then the details of who is staying come next.
          </p>
          <Panel tint>
            <h4>Nothing chosen yet</h4>
            <p className="small muted">
              A booking is one room of one room type for your dates. Pick the nights and the room type, and this page
              fills itself in.
            </p>
            <div className="row">
              <Link className="btn btn--primary btn--sm" to="/">Search your dates</Link>
              <Link className="btn btn--ghost btn--sm" to="/rooms">See the rooms</Link>
            </div>
          </Panel>
        </div>
      </main>
    );
  }

  const nights = nightsBetween(checkIn, checkOut);
  const details = roomType.data?.room_type ?? null;
  const row = (availability.data?.room_types ?? [])
    .find((candidate) => String(candidate.room_type_id ?? candidate.id) === String(roomTypeId));
  const freeRooms = row?.free_rooms;
  const unconfirmed = Boolean(signedIn && account && !account.email_confirmed);

  const stay = {
    checkIn,
    checkOut,
    guests: Number(guests),
    nights,
    checkInLabel: `${formatDate(checkIn)} · from 15:00`,
    checkOutLabel: `${formatDate(checkOut)} · by 11:00`,
  };

  return (
    <main id="main">
      <div className="wrap page-head">
        <h1>Booking details</h1>
        <p className="lead">Tell us who is staying and when to expect you. Your room type and dates are already chosen.</p>
        <Steps steps={['Booking details', 'Payment', 'Confirmed']} current={0} />
      </div>

      <section className="section" style={{ paddingTop: 'var(--space-4)' }}>
        <div className="wrap split">
          <div>
            {roomType.loading || availability.loading ? (
              <LoadingBlock label="Checking that the room is still free for your nights…" lines={2} />
            ) : null}

            {roomType.failed ? (
              <Alert kind="error" title="We could not load this room type">
                {roomType.error.message} — nothing has been booked. Pick another room type to carry on.
                <div className="row" style={{ marginTop: 'var(--space-3)' }}>
                  <Link className="btn btn--primary btn--sm" to="/rooms">See other rooms</Link>
                  <button className="btn btn--ghost btn--sm" type="button" onClick={roomType.reload}>Try again</button>
                </div>
              </Alert>
            ) : null}

            {unconfirmed ? (
              <Alert kind="warn" title="Your email address is not confirmed yet">
                Open the link we emailed to {account?.email} before you book.
                <div className="row" style={{ marginTop: 'var(--space-3)' }}>
                  <Link className="btn btn--primary btn--sm" to="/confirm-email">Confirm your email</Link>
                </div>
              </Alert>
            ) : null}

            {availability.failed ? (
              <Alert kind="error" title="We could not check what is free">
                {availability.error.message} — the room may still be free, but the booking is not sent until that is
                known.
                <div className="row" style={{ marginTop: 'var(--space-3)' }}>
                  <button className="btn btn--ghost btn--sm" type="button" onClick={availability.reload}>Try again</button>
                </div>
              </Alert>
            ) : null}

            {availability.ready && typeof freeRooms === 'number' && freeRooms < 1 ? (
              <Alert kind="error" title={`The last ${details?.name ?? 'room'} for these nights has just gone`}>
                Nothing has been charged. Pick another room type or other dates to carry on.
                <div className="row" style={{ marginTop: 'var(--space-3)' }}>
                  <Link className="btn btn--primary btn--sm" to="/rooms">See other rooms</Link>
                </div>
              </Alert>
            ) : null}

            {availability.ready && typeof freeRooms === 'number' && freeRooms > 0 ? (
              <Alert kind="success" title="Still free">
                A {details?.name} is available for every one of your {nights} nights.
                <Link to={`/rooms/${roomTypeId}`}> See the room type</Link>
              </Alert>
            ) : null}

            {details ? (
              <BookingDetailsForm roomType={details} stay={stay} account={account} />
            ) : null}

            <Panel style={{ marginTop: 'var(--space-5)' }}>
              <h4>{hotel?.hotel_name ?? 'hotelIndoora'}</h4>
              <p><b>{hotel?.address ?? ''}</b><br />{hotel?.phone_number ?? ''} · {hotel?.email_address ?? ''}</p>
              <p>Check-in from {hotel?.check_in_time ?? '15:00'} · Check-out by {hotel?.check_out_time ?? '11:00'}</p>
              <p className="small muted">House rules: {hotel?.house_rules}</p>
            </Panel>
          </div>

          {details ? <ChosenRoomPanel roomType={details} stay={stay} /> : null}
        </div>
      </section>
    </main>
  );
}
