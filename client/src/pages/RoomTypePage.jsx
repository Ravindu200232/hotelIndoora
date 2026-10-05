import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, formatDate, nightsBetween } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import { useHotel } from '../hotel.jsx';
import { useSession } from '../session.jsx';
import { Alert, LoadingBlock, Panel, Skeleton } from '../components/index.jsx';
import { defaultStay } from '../components/home/AvailabilitySearch.jsx';
import { RoomGallery } from '../components/rooms/RoomGallery.jsx';
import { RoomFacts, StaySummary, BookingSteps } from '../components/rooms/StaySummary.jsx';

/**
 * Room Type: one room type in full — its photographs, its description, the bed,
 * the size, the amenities and the maximum number of guests — with the price for
 * the chosen dates and the way to book it.
 *
 * The room type, its rate and how many rooms are free for those nights are the
 * real ones; a room type that has been taken off sale says so and offers the way
 * back to the rooms that are on sale.
 */
export function RoomTypePage() {
  const { roomTypeId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { signedIn } = useSession();
  const { hotel } = useHotel();

  const fallback = defaultStay();
  const [stay, setStay] = useState({
    checkIn: params.get('check_in') ?? fallback.checkIn,
    checkOut: params.get('check_out') ?? fallback.checkOut,
    guests: params.get('guests') ?? String(fallback.guests),
  });

  // The dates live in the address so the page can be shared and refreshed.
  useEffect(() => {
    const query = new URLSearchParams({ check_in: stay.checkIn, check_out: stay.checkOut, guests: String(stay.guests) });
    navigate(`?${query.toString()}`, { replace: true });
  }, [stay.checkIn, stay.checkOut, stay.guests, navigate]);

  const roomType = useAsync(() => api.roomType(roomTypeId), [roomTypeId]);
  const availability = useAsync(
    () => api.availability({ checkIn: stay.checkIn, checkOut: stay.checkOut, guests: stay.guests }),
    [stay.checkIn, stay.checkOut, stay.guests],
  );

  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const row = (availability.data?.room_types ?? [])
    .find((candidate) => String(candidate.room_type_id ?? candidate.id) === String(roomTypeId));
  const freeRooms = row?.free_rooms;
  const offSale = roomType.failed && roomType.error?.code === 'off_sale';
  const details = roomType.data?.room_type;
  const name = details?.name ?? 'this room type';

  if (roomType.loading) {
    return (
      <main id="main">
        <div className="wrap page-head">
          <p className="breadcrumb"><Link to="/">Home</Link> / <Link to="/rooms">Rooms</Link> / …</p>
        </div>
        <div className="wrap section" style={{ paddingTop: 0 }}>
          <LoadingBlock label="Loading this room type…" lines={3} />
        </div>
      </main>
    );
  }

  if (roomType.failed) {
    return (
      <main id="main">
        <div className="wrap page-head">
          <p className="breadcrumb"><Link to="/">Home</Link> / <Link to="/rooms">Rooms</Link></p>
          <h1>Room type</h1>
        </div>
        <div className="wrap section" style={{ paddingTop: 0 }}>
          {offSale ? (
            <Alert kind="warn" title="This room type is not on sale">
              We are not taking bookings for {roomType.error?.room_type?.name ?? 'this room type'} at the moment.
              <div className="row" style={{ marginTop: 'var(--space-3)' }}>
                <Link className="btn btn--primary btn--sm" to="/rooms">See rooms available for your dates</Link>
              </div>
            </Alert>
          ) : (
            <Alert kind="error" title="We could not load this room type">
              {roomType.error.message} — it may have been taken off sale, or the connection dropped. Nothing has changed
              on your booking.
              <div className="row" style={{ marginTop: 'var(--space-3)' }}>
                <button className="btn btn--ghost btn--sm" type="button" onClick={roomType.reload}>Try again</button>
                <Link className="btn btn--quiet btn--sm" to="/rooms">Back to results</Link>
              </div>
            </Alert>
          )}
        </div>
      </main>
    );
  }

  return (
    <main id="main">
      <div className="wrap page-head">
        <p className="breadcrumb">
          <Link to="/">Home</Link> / <Link to="/rooms">Rooms</Link> / {name}
        </p>
        <Link className="btn btn--ghost btn--sm" to="/rooms">Back to results</Link>
      </div>

      <section className="section" style={{ paddingTop: 'var(--space-4)' }} aria-labelledby="room-title">
        <div className="wrap split">
          <div>
            <RoomGallery name={name} photos={details.photos ?? []} />
            <div style={{ marginTop: 'var(--space-5)' }}>
              <RoomFacts roomType={details} freeRooms={freeRooms} nights={nights} />
            </div>
            {availability.failed ? (
              <Alert kind="warn" title="We could not work out what is free" style={{ marginTop: 'var(--space-4)' }}>
                {availability.error.message} — the room type itself is still shown, and the price appears as soon as the
                service answers.
                <div className="row" style={{ marginTop: 'var(--space-3)' }}>
                  <button className="btn btn--ghost btn--sm" type="button" onClick={availability.reload}>Try again</button>
                </div>
              </Alert>
            ) : null}
          </div>

          <StaySummary
            roomType={details}
            stay={{
              checkIn: stay.checkIn,
              checkOut: stay.checkOut,
              guests: stay.guests,
              nights,
              checkInLabel: `${formatDate(stay.checkIn)} · from 15:00`,
              checkOutLabel: `${formatDate(stay.checkOut)} · by 11:00`,
              setCheckIn: (value) => setStay((current) => ({ ...current, checkIn: value })),
              setCheckOut: (value) => setStay((current) => ({ ...current, checkOut: value })),
              setGuests: (value) => setStay((current) => ({ ...current, guests: value })),
            }}
            freeRooms={freeRooms}
            signedIn={signedIn}
            onSearch={() => navigate(`/rooms?check_in=${stay.checkIn}&check_out=${stay.checkOut}&guests=${stay.guests}`)}
          />
        </div>

        <div className="wrap section" aria-labelledby="rt-hotel-title">
          <h2 id="rt-hotel-title" className="visually-hidden">Hotel details</h2>
          <div className="grid grid--3">
            <Panel>
              <h4>{hotel?.hotel_name ?? 'hotelIndoora'}</h4>
              <p>{hotel?.address ?? '—'}</p>
              <p>{hotel ? `${hotel.phone_number}` : ''}<br />{hotel?.email_address ?? ''}</p>
            </Panel>
            <Panel>
              <h4>Check-in and check-out times</h4>
              <p>Check-in from {hotel?.check_in_time ?? '15:00'}</p>
              <p>Check-out by {hotel?.check_out_time ?? '11:00'}</p>
              <p>Late check-out on request.</p>
            </Panel>
            <Panel>
              <h4>House rules</h4>
              {String(hotel?.house_rules ?? '')
                .split(/(?<=\.)\s+/)
                .filter(Boolean)
                .map((rule) => <p key={rule}>{rule}</p>)}
              {!hotel ? <Skeleton /> : null}
            </Panel>
          </div>
        </div>

        <BookingSteps roomType={details} />
      </section>
    </main>
  );
}
