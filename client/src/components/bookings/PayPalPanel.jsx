import { Link } from 'react-router-dom';
import { Button, Img, KvList, Panel } from '../index.jsx';
import { photoAt, firstSentence } from '../ui/media.jsx';
import { formatRange } from '../../api.js';

/**
 * What the guest is paying for, and the one action that takes the money: PayPal,
 * for the full amount, with the room held meanwhile.
 *
 * The button hands the guest to PayPal; if PayPal has not been connected yet the
 * page says exactly that instead of pretending to charge.
 */
export function PayPalPanel({ booking, roomType, onPay, paying, minutesLeft, error }) {
  return (
    <Panel accent aria-labelledby="paying-for-title">
      <p className="small muted" style={{ margin: 0 }}>You are paying for</p>
      <h3 id="paying-for-title">{roomType?.name ?? 'Your room'}</h3>
      {roomType?.photos?.[0] ? (
        <Img
          src={photoAt(roomType.photos[0], 800)}
          alt={`${roomType.name}: ${firstSentence(roomType.description) || 'a room at hotelIndoora'}`}
          width={800}
          height={550}
          style={{ borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}
        />
      ) : null}
      <KvList rows={[
        ['Stay', formatRange(booking.check_in_date, booking.check_out_date)],
        ['Nights', booking.nights],
        ['Guests', booking.guest_count],
        ['Expected arrival', booking.expected_arrival_time],
        ['Total', `€${Number(booking.total_price).toFixed(2)}`],
        ['Booking reference', booking.booking_reference ?? 'Issued when your payment completes'],
      ]} />
      {typeof minutesLeft === 'number' && minutesLeft > 0 ? (
        <p className="small muted">
          Room held until {new Date(booking.hold_expires_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} today · {minutesLeft} minutes left.
        </p>
      ) : null}

      <Button kind="secondary" block type="button" onClick={onPay} disabled={paying} aria-busy={paying}>
        {paying ? 'Opening PayPal…' : 'Pay with PayPal'}
      </Button>
      {error ? (
        <div className="alert alert--error" role="alert" style={{ marginTop: 'var(--space-3)' }}>
          <span className="alert__icon" aria-hidden="true">!</span>
          <div className="alert__body">
            <span className="alert__title">PayPal is not ready</span>
            {error}
          </div>
        </div>
      ) : null}
      <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
        PayPal is the only way to pay. There is no deposit and no payment on arrival.
      </p>
      <hr />
      <p className="small muted" style={{ margin: 0 }}>
        Check-in from 15:00 · Check-out by 11:00 · Breakfast in the courtyard 07:30 – 10:00.
      </p>
      <div className="row" style={{ marginTop: 'var(--space-4)' }}>
        <Link className="btn btn--ghost btn--sm" to="/bookings/new">Back to booking details</Link>
        <Link className="btn btn--quiet btn--sm" to="/my-bookings">My Bookings</Link>
      </div>
    </Panel>
  );
}
