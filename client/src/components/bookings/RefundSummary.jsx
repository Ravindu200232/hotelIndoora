import { Link } from 'react-router-dom';
import { Badge, Button, Img, KvList, Panel, PlainList, ProgressTrack } from '../index.jsx';
import { photoAt, firstSentence } from '../ui/media.jsx';
import { money } from '../../api.js';

/**
 * What cancelling returns: the whole amount, with no fee kept back — the same
 * whether the stay is months away or today. The figures are the guest's own:
 * what they paid, what is kept (nothing), the nights that go back on sale and
 * what comes back to them.
 */
export function RefundSummary({ booking, roomType, paid, nights, paidOn, transactionId }) {
  return (
    <>
      <Panel accent as="section" aria-labelledby="refund-title">
        <h3 id="refund-title">You are refunded the whole amount, through PayPal</h3>
        <p>Every euro you paid comes back to you. No cancellation fee is kept back and no part of the stay is charged.</p>
        <p className="price" style={{ fontSize: 'var(--text-3xl)', margin: 0 }}>{money(paid)}</p>
        {transactionId ? (
          <p className="small muted">Back to the PayPal account you paid with · transaction {transactionId}</p>
        ) : (
          <p className="small muted">Back to the PayPal account you paid with.</p>
        )}
        <PlainList>
          <li>
            <span>{paidOn ? `Total paid on ${paidOn}` : 'Total paid'}</span>
            <b>{money(paid)}</b>
          </li>
          <li><span>Cancellation fee kept back</span><b>{money(0)}</b></li>
          <li><span>Rooms released back on sale</span><b>{nights} {nights === 1 ? 'night' : 'nights'}</b></li>
          <li><span>Refunded to you</span><b>{money(paid)}</b></li>
        </PlainList>
        <p className="small muted" style={{ margin: 0 }}>
          The refund is the same full amount whenever you cancel — today, next month, or on the arrival day itself.
        </p>
      </Panel>

      <section aria-labelledby="stay-title" style={{ marginTop: 'var(--space-5)' }}>
        <h2 id="stay-title">Your stay</h2>
        <Panel>
          {roomType?.photos?.[0] ? (
            <div className="card__media" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 'var(--space-4)' }}>
              <Img
                src={photoAt(roomType.photos[0], 1000)}
                alt={`${roomType.name}: ${firstSentence(roomType.description) || 'a room at hotelIndoora'}`}
                width={1000}
                height={640}
              />
            </div>
          ) : null}
          <Badge kind={booking.status === 'cancelled' ? 'cancelled' : 'confirmed'}>
            {booking.status === 'cancelled' ? 'Cancelled' : 'Confirmed'}
          </Badge>
          <h3 style={{ marginTop: 'var(--space-3)' }}>{roomType?.name ?? '—'}</h3>
          <p className="small muted">
            {[roomType?.bed_type_and_size, roomType?.room_size_sqm ? `${roomType.room_size_sqm} m²` : null,
              roomType?.max_guests ? `up to ${roomType.max_guests} guests` : null].filter(Boolean).join(' · ')}
          </p>
          <KvList stacked rows={[
            ['Check-in', `${new Date(booking.check_in_date).toDateString()}, from 15:00`],
            ['Check-out', `${new Date(booking.check_out_date).toDateString()}, by 11:00`],
            ['Nights', booking.nights],
            ['Guests staying', booking.guest_count],
            ['Expected arrival', booking.expected_arrival_time],
            ['Nightly rate', money(booking.nightly_rate)],
            ['Total paid', money(paid)],
          ]} />
          <p className="small muted">Booking reference <span className="ref">{booking.booking_reference ?? 'not issued yet'}</span></p>
        </Panel>
      </section>
    </>
  );
}

/**
 * Every state of a cancellation: the refund being requested, a refund that did
 * not go through, the booking cancelled and refunded in full, and a booking
 * that was already cancelled — whose refund is left exactly as it was.
 */
export function CancelStates({ state, booking, paid, onRetry }) {
  return (
    <Panel as="section" aria-labelledby="cancel-states" style={{ marginTop: 'var(--space-5)' }}>
      <h2 id="cancel-states">What happens next</h2>

      {state.status === 'requesting' ? (
        <div>
          <h3>Requesting your refund</h3>
          <p>PayPal is sending {money(state.amount ?? paid)} back to the account you paid with.</p>
          <ProgressTrack percent={60} />
          <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>Keep this page open. This takes a moment.</p>
          <Button kind="ghost" size="sm" type="button" aria-disabled="true">Refunding {money(state.amount ?? paid)}…</Button>
        </div>
      ) : null}

      {state.status === 'failed' ? (
        <div className="alert alert--error" role="alert">
          <span className="alert__icon" aria-hidden="true">!</span>
          <div className="alert__body">
            <span className="alert__title">The refund did not go through</span>
            {state.message} Nothing has been refunded and your booking stays confirmed.
            <div className="row" style={{ marginTop: 'var(--space-3)' }}>
              <Button kind="primary" size="sm" type="button" onClick={onRetry}>Try the full refund again</Button>
              <Link className="btn btn--ghost btn--sm" to={`/my-bookings/${booking.id}`}>Back to the booking</Link>
            </div>
          </div>
        </div>
      ) : null}

      {state.status === 'cancelled' ? (
        <div className="alert alert--success" role="status">
          <span className="alert__icon" aria-hidden="true">✓</span>
          <div className="alert__body">
            <span className="alert__title">Booking cancelled and refunded in full</span>
            <Badge kind="cancelled">Cancelled</Badge>
            <p style={{ marginTop: 'var(--space-3)' }}>
              <b>{money(state.amount ?? paid)} refunded through PayPal.</b> The whole amount is on its way to the account
              you paid with, and we have emailed you a copy.
            </p>
            {state.transactionId ? (
              <p className="small muted">
                Transaction {state.transactionId} · {state.refundStatus === 'pending' ? 'in progress at PayPal' : 'completed'}
              </p>
            ) : null}
            <Link to={`/my-bookings/${booking.id}`}>View this booking</Link>
          </div>
        </div>
      ) : null}

      {state.status === 'already' ? (
        <div className="alert alert--info" role="status">
          <span className="alert__icon" aria-hidden="true">i</span>
          <div className="alert__body">
            <span className="alert__title">This booking is already cancelled</span>
            {booking.booking_reference ? `Booking ${booking.booking_reference} was cancelled` : 'This booking was cancelled'}{' '}
            and the full {money(state.amount ?? paid)} has been refunded through PayPal. That refund is unchanged.
            {state.transactionId ? <p className="small muted">Transaction {state.transactionId} · completed</p> : null}
            <Link to={`/my-bookings/${booking.id}`}>Open the booking</Link>
          </div>
        </div>
      ) : null}

      <p className="small muted">
        Cancelling releases your room straight away, so those {booking.nights} nights go back on sale, and you are
        emailed as soon as PayPal has the refund.
      </p>
    </Panel>
  );
}
