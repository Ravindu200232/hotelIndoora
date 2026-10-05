import { Alert, Img, KvList, Panel } from '../index.jsx';
import { formatDate, formatShortDate, formatTime, money } from '../../api.js';
import { photoAt, firstSentence } from '../ui/media.jsx';

/**
 * The stay the desk has just taken, in full, before the guest is sent a link to
 * pay for it: who it is for, how to reach them, the nights, the rate and the
 * total, with the requests the desk noted.
 */
export function StaySummary({ booking, roomType, bookedBy }) {
  return (
    <Panel as="section" aria-labelledby="summary-title">
      <h4>Stay summary</h4>

      {roomType?.photos?.[0] ? (
        <Img
          src={photoAt(roomType.photos[0], 800)}
          alt={`${roomType.name}: ${firstSentence(roomType.description) || 'a room at hotelIndoora'}`}
          width={800}
          height={550}
          style={{ borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}
        />
      ) : null}

      <h2 id="summary-title">{roomType?.name ?? 'Room type'}</h2>
      <p className="small muted">
        {[roomType?.bed_type_and_size, roomType?.max_guests ? `sleeps ${roomType.max_guests}` : null,
          roomType?.room_size_sqm ? `${roomType.room_size_sqm} m²` : null].filter(Boolean).join(' · ')}
      </p>

      <KvList rows={[
        ['Lead guest', booking.lead_guest_name],
        ['Contact phone number', booking.contact_phone],
        ['Email address', booking.guest_email],
        ['Check-in', `${formatDate(booking.check_in_date)} · from 15:00`],
        ['Check-out', `${formatDate(booking.check_out_date)} · by 11:00`],
        ['Nights', booking.nights],
        ['Guests staying', booking.guest_count],
        ['Expected arrival time', booking.expected_arrival_time],
        ['Nightly rate', money(booking.nightly_rate)],
        [`${booking.nights} ${booking.nights === 1 ? 'night' : 'nights'} × ${money(booking.nightly_rate)}`, money(booking.total_price)],
        ['Total · nothing added', money(booking.total_price)],
      ]} />

      <p className="small muted">Special requests: {booking.special_requests || 'none noted.'}</p>
      <p className="small muted">
        Booked by {bookedBy ?? 'you'} · {formatShortDate(booking.booked_at).slice(4)}, {formatTime(booking.booked_at)} ·
        reference {booking.booking_reference ?? 'not issued yet'}.
      </p>

      <Alert kind="info" title="The room is held from this moment">
        {roomType?.name ?? 'The room type'} is held for {formatShortDate(booking.check_in_date).slice(4)} to{' '}
        {formatShortDate(booking.check_out_date).slice(4)} while the link is unpaid, and shows on Bookings as waiting for
        payment until the guest pays.
      </Alert>
    </Panel>
  );
}
