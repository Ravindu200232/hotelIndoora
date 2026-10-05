import { Link } from 'react-router-dom';
import { Button, Panel } from '../index.jsx';
import { money } from '../../api.js';

/**
 * What is happening while the change is being settled, and what happened after:
 * the check, a difference still waiting at PayPal, a refusal with its reason,
 * PayPal unable to settle, or the change done with the amount that moved.
 */
export function DifferencePanel({ state, bookingId, onRetry, roomType, dates, outstanding }) {
  const settled = state.status === 'changed' || state.status === 'changed_pending';

  return (
    <Panel as="section" aria-labelledby="change-messages" style={{ marginTop: 'var(--space-5)' }}>
      <h2 id="change-messages">Availability and messages</h2>

      {state.status === 'checking' ? (
        <p className="small muted">Checking which room types are free for {dates}…</p>
      ) : null}

      {state.status === 'capturing' ? (
        <p className="small muted">Collecting the difference you approved at PayPal…</p>
      ) : null}

      {!settled && state.status !== 'capturing' && outstanding ? (
        <div className="alert alert--warn" role="status">
          <span className="alert__icon" aria-hidden="true">!</span>
          <div className="alert__body">
            <span className="alert__title">{money(outstanding.amount)} is still waiting to be approved at PayPal</span>
            This booking has changed and that difference has not been paid yet. Approve it at PayPal and it is collected
            straight away — nothing else changes on your booking.
            <div className="row" style={{ marginTop: 'var(--space-3)' }}>
              <a className="btn btn--primary btn--sm" href={outstanding.approve_url}>Approve {money(outstanding.amount)} at PayPal</a>
              <Link className="btn btn--ghost btn--sm" to={`/my-bookings/${bookingId}`}>Open my booking</Link>
            </div>
          </div>
        </div>
      ) : null}

      {state.status === 'not_free' ? (
        <div className="alert alert--error" role="alert">
          <span className="alert__icon" aria-hidden="true">!</span>
          <div className="alert__body">
            <span className="alert__title">No room of that room type is free for {dates}</span>
            Every room of that type is booked or out of service for those nights. Choose another room type or different
            dates.
          </div>
        </div>
      ) : null}

      {state.status === 'refused_date' ? (
        <div className="alert alert--error" role="alert">
          <span className="alert__icon" aria-hidden="true">!</span>
          <div className="alert__body">
            <span className="alert__title">Those dates cannot be used</span>
            {state.message} We have left your booking as it is — pick a new check-in date and the room types are checked
            again.
          </div>
        </div>
      ) : null}

      {state.status === 'paypal_failed' ? (
        <div className="alert alert--error" role="alert">
          <span className="alert__icon" aria-hidden="true">!</span>
          <div className="alert__body">
            <span className="alert__title">PayPal did not settle the difference</span>
            {state.message} Nothing has changed on your booking — your stay and the amount you have paid are exactly as
            they were.
            <div className="row" style={{ marginTop: 'var(--space-3)' }}>
              <Button kind="ghost" size="sm" type="button" onClick={onRetry}>Retry</Button>
            </div>
          </div>
        </div>
      ) : null}

      {settled ? (
        <div className="alert alert--success" role="status">
          <span className="alert__icon" aria-hidden="true">✓</span>
          <div className="alert__body">
            <span className="alert__title">Your booking is changed</span>
            {roomType?.name}, {dates}, {state.nights} nights, {state.guests} guests.{' '}
            {state.difference?.direction === 'charge'
              ? state.difference.pending || state.approveUrl
                ? `${money(state.difference.amount)} is waiting to be approved at PayPal.`
                : `${money(state.difference.amount)} charged through PayPal.`
              : state.difference?.direction === 'refund'
                ? `${money(state.difference.amount)} refunded through PayPal.`
                : 'Nothing further was due.'}{' '}
            A confirmation of the change is on its way to your email address.
            <div className="row" style={{ marginTop: 'var(--space-3)' }}>
              {state.approveUrl ? (
                <a className="btn btn--primary btn--sm" href={state.approveUrl}>
                  Approve {money(state.difference?.amount ?? 0)} at PayPal
                </a>
              ) : null}
              <Link className="btn btn--ghost btn--sm" to={`/my-bookings/${bookingId}`}>Open my booking</Link>
            </div>
          </div>
        </div>
      ) : null}

      <p className="small muted">
        Moving a stay on the check-in day itself is allowed. Nothing is refunded or charged until you confirm the change.
      </p>
    </Panel>
  );
}
