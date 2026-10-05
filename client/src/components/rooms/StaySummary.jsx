import { Link } from 'react-router-dom';
import { Alert, AmenityList, KvList, Panel, Row, Stat, Steps } from '../index.jsx';

/**
 * The facts of one room type: what a night costs, how big it is, what the bed is
 * and how many people it takes, then the description and the list of what is in
 * the room — the same order and wording as the approved prototype.
 */
export function RoomFacts({ roomType, freeRooms, nights }) {
  const rate = `€${Number(roomType.nightly_rate).toFixed(2)}`;
  const sentences = String(roomType.description ?? '')
    .split(/(?<=\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const [bedSize, bedType] = String(roomType.bed_type_and_size ?? '').split(',').map((part) => part?.trim());

  return (
    <Panel>
      <h1 id="room-title" className="font-drop">{roomType.name}</h1>
      <div className="grid grid--4" style={{ gap: 'var(--space-3)' }}>
        <Stat label="Nightly rate" value={rate} foot="the whole price" />
        <Stat label="Room size" value={roomType.room_size_sqm ? `${roomType.room_size_sqm} m²` : '—'} />
        <Stat
          label="Bed type and size"
          value={<span style={{ fontSize: 'var(--text-md)' }}>{roomType.bed_type_and_size || '—'}</span>}
        />
        <Stat label="Maximum guests" value={roomType.max_guests} />
      </div>

      <h2 style={{ marginTop: 'var(--space-5)' }}>About this room</h2>
      {sentences.map((sentence) => <p key={sentence}>{sentence}</p>)}

      <h4>What is in the room</h4>
      <AmenityList items={roomType.amenities ?? []} />

      <Row style={{ marginTop: 'var(--space-5)' }}>
        <span className="badge badge--sale">On sale</span>
        <span className="chip">{roomType.room_count} rooms of this type</span>
        {typeof freeRooms === 'number' ? (
          <span className="chip">
            {freeRooms} free for {nights} nights
          </span>
        ) : null}
      </Row>
      {bedType && bedSize ? <p className="visually-hidden">{`${bedType} ${bedSize}`}</p> : null}
    </Panel>
  );
}

/**
 * The stay as it stands: the dates, the nights, the guests, the rate for every
 * night and the total, with the way to book (sign in first for a visitor) and a
 * small form to change the dates.
 */
export function StaySummary({ roomType, stay, freeRooms, signedIn, onSearch }) {
  const rate = Number(roomType.nightly_rate);
  const nights = stay?.nights ?? 0;
  const total = Number((rate * nights).toFixed(2));

  return (
    <aside className="panel panel--accent" aria-labelledby="stay-title">
      <h3 id="stay-title">Your stay</h3>
      {stay?.checkIn && stay?.checkOut ? (
        <KvList rows={[
          ['Check-in', stay.checkInLabel],
          ['Check-out', stay.checkOutLabel],
          ['Nights', nights],
          ['Guests', stay.guests],
          ['Nightly rate', `€${rate.toFixed(2)} × ${nights}`],
          ['Total', `€${total.toFixed(2)}`],
        ]} />
      ) : (
        <Alert kind="info" title="No dates chosen yet">
          Choose your check-in and check-out dates to see the price of this room for your stay.
        </Alert>
      )}
      <p className="small muted">
        The nightly rate is the final price. Nothing is added at checkout, and you pay the full amount through PayPal
        when you book.
      </p>

      {signedIn ? (
        <>
          <Link
            className="btn btn--primary btn--block"
            to={`/bookings/new?room_type_id=${roomType.id}&check_in=${stay?.checkIn ?? ''}&check_out=${stay?.checkOut ?? ''}&guests=${stay?.guests ?? 2}`}
          >
            Book
          </Link>
          <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
            {nights} nights for {stay?.guests ?? 2} guests in the {roomType.name}. One room of one room type per booking.
          </p>
        </>
      ) : (
        <>
          <Link
            className="btn btn--primary btn--block"
            to="/login"
            state={{ from: `/rooms/${roomType.id}` }}
          >
            Sign in to book
          </Link>
          <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
            No account yet? <Link to="/register">Create account</Link> — your dates and this room type are kept while
            you set it up.
          </p>
        </>
      )}

      <hr />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSearch?.();
        }}
      >
        <h4>Change your dates</h4>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="rt-checkin">Check-in date</label>
            <input
              type="date"
              id="rt-checkin"
              value={stay?.checkIn ?? ''}
              onChange={(event) => stay?.setCheckIn?.(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="rt-checkout">Check-out date</label>
            <input
              type="date"
              id="rt-checkout"
              value={stay?.checkOut ?? ''}
              onChange={(event) => stay?.setCheckOut?.(event.target.value)}
            />
          </div>
          <div className="field field--full">
            <label htmlFor="rt-guests">Number of guests</label>
            <input
              type="number"
              id="rt-guests"
              min="1"
              max="20"
              value={stay?.guests ?? 2}
              onChange={(event) => stay?.setGuests?.(event.target.value)}
            />
          </div>
        </div>
        <p style={{ marginTop: 'var(--space-3)' }}>
          <button className="btn btn--ghost btn--sm btn--block" type="submit">Search availability</button>
        </p>
      </form>
      {typeof freeRooms === 'number' && freeRooms > 0 ? (
        <p className="small muted">
          {freeRooms === 1 ? '1 room is free' : `${freeRooms} rooms are free`} for every one of your {nights} nights.
        </p>
      ) : null}
    </aside>
  );
}

/** The three steps of a booking, with the page each one opens. */
export function BookingSteps({ roomType }) {
  const steps = [
    ['Booking details', 'Lead guest’s full name, phone number, guests, arrival time and requests', '/bookings/new'],
    ['Payment', 'The nightly rate for every night, paid through PayPal', '/bookings/new/payment'],
    ['Booking confirmed', 'The reference and the stay, the moment payment succeeds', '/bookings/:reference/confirmed'],
    ['My bookings', 'Every stay you hold, upcoming and past, with its status and total', '/my-bookings'],
  ];
  const manage = [
    ['My booking', 'The stay, the guest details and every payment and refund', '/my-bookings/:bookingId'],
    ['Change booking', 'New dates or another room type, with the difference settled through PayPal', '/my-bookings/:bookingId/change'],
    ['Cancel booking', 'Cancel and have the whole amount refunded through PayPal', '/my-bookings/:bookingId/cancel'],
    ['My account', 'Your name, phone number and password', '/account'],
    ['Delete my account', 'Delete your account and personal details', '/account/delete'],
  ];
  return (
    <section className="section" aria-labelledby="rt-guest-title">
      <div className="wrap">
        <h2 id="rt-guest-title">Booking and managing your stay</h2>
        <p className="small muted">
          One booking covers one room of one room type, and the nightly rate is the final price. Sign in to book, or
          open any step of a booking and of a stay you already hold here.
        </p>
        <div className="grid grid--2">
          <Panel tint>
            <h4>Booking a stay</h4>
            <ul className="plain-list">
              {steps.map(([label, note, to]) => (
                <li key={label}>
                  <span>{note}</span>
                  <Link className="btn btn--ghost btn--sm" to={to.replace(':reference', 'HID-0000')}>{label}</Link>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel tint>
            <h4>Managing a stay you have booked</h4>
            <ul className="plain-list">
              {manage.map(([label, note, to]) => (
                <li key={label}>
                  <span>{note}</span>
                  <Link className="btn btn--ghost btn--sm" to={to}>{label}</Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <p className="visually-hidden">{`Steps for ${roomType?.name ?? 'this room type'}`}</p>
      </div>
    </section>
  );
}
