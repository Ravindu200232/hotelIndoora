import { Link } from 'react-router-dom';
import { Button, Panel } from '../index.jsx';
import { money } from '../../api.js';

/**
 * The new stay being chosen, and exactly what PayPal will do when it is
 * confirmed: charge the difference, refund it, or nothing at all.
 *
 * A guest sees the figure before they commit — the new total less what they have
 * already paid, with no fee kept back in either direction.
 */
export function NewStaySummary({
  roomType,
  checkIn,
  checkOut,
  nights,
  guests,
  newTotal,
  alreadyPaid,
  difference,
  onConfirm,
  confirming,
  bookingId,
}) {
  const settled = difference.direction === 'charge'
    ? `Charge ${money(difference.amount)}`
    : difference.direction === 'refund'
      ? `Refund ${money(difference.amount)}`
      : 'Nothing to settle';

  return (
    <Panel accent aria-labelledby="new-stay-summary">
      <h3 id="new-stay-summary">New stay</h3>
      <table style={{ marginBottom: 'var(--space-4)' }}>
        <caption className="visually-hidden">The new stay you are choosing</caption>
        <tbody>
          <tr><td>Room type</td><td>{roomType?.name ?? '—'}</td></tr>
          <tr><td>Check-in</td><td>{checkIn}</td></tr>
          <tr><td>Check-out</td><td>{checkOut}</td></tr>
          <tr><td>Nights</td><td>{nights}</td></tr>
          <tr><td>Guests staying</td><td>{guests}</td></tr>
          <tr><td>Nightly rate</td><td>{roomType ? money(roomType.nightly_rate) : '—'}</td></tr>
          <tr><td>New total</td><td>{money(newTotal)}</td></tr>
        </tbody>
      </table>

      <div className="panel panel--tint">
        <h4>Through PayPal</h4>
        <p className="price" style={{ margin: 0 }}>{settled}</p>
        <p className="small muted">
          {difference.direction === 'charge'
            ? `${money(newTotal)} new total less the ${money(alreadyPaid)} already paid.`
            : difference.direction === 'refund'
              ? `${money(alreadyPaid)} already paid, less the ${money(newTotal)} new total — the difference comes straight back to you.`
              : `${money(newTotal)} new total, the same as you have already paid.`}{' '}
          If your new stay costs less than you have paid, the difference is refunded to you through PayPal instead, with
          no fee kept back.
        </p>
      </div>

      <Button
        kind="primary"
        block
        type="button"
        onClick={onConfirm}
        disabled={confirming || !roomType}
        aria-busy={confirming}
        style={{ marginTop: 'var(--space-4)' }}
      >
        {confirming ? 'Settling with PayPal…' : 'Confirm change'}
      </Button>
      <p style={{ marginTop: 'var(--space-3)' }}>
        <Link className="btn btn--ghost btn--block" to={`/my-bookings/${bookingId}`}>Back without changing</Link>
      </p>
      <p className="small muted">
        Rather not travel at all? <Link to={`/my-bookings/${bookingId}/cancel`}>Cancel booking instead</Link> — the whole
        amount goes back through PayPal.
      </p>
    </Panel>
  );
}
