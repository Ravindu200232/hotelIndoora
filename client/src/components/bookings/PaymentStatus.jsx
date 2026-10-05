import { Link } from 'react-router-dom';
import { Badge, Panel } from '../index.jsx';

/**
 * Where the payment stands: waiting for PayPal to report it, completed, or
 * refused. A refusal never costs the guest anything — the booking and the room
 * are left exactly as they were, and the same total can be tried again.
 */
export function PaymentStatus({ state, checkedAt, booking, onRetry, retryLabel = 'Try again' }) {
  const completed = state.status === 'completed';
  const failed = state.status === 'failed';

  return (
    <>
      <Panel as="section" aria-labelledby="status-title" style={{ marginTop: 'var(--space-5)' }}>
        <h2 id="status-title">Payment status</h2>
        <p>
          <Badge kind={completed ? 'confirmed' : failed ? 'cancelled' : 'pending'}>
            {completed ? 'Completed' : failed ? 'Not completed' : 'Waiting for payment'}
          </Badge>
        </p>
        {completed ? (
          <p>
            €{Number(state.amount ?? booking.total_price).toFixed(2)} paid through PayPal. Your booking is confirmed
            {state.reference ? <> with reference <b>{state.reference}</b></> : null}, and a confirmation email is on its
            way to {booking.guest_email}.
          </p>
        ) : (
          <p>
            PayPal has not reported this payment as completed yet. The booking stays unconfirmed and the room stays held
            until it does.
          </p>
        )}
        {checkedAt ? <p className="small muted">Checked with PayPal at {checkedAt}.</p> : null}
      </Panel>

      {failed ? (
        <div className="alert alert--error" role="alert">
          <span className="alert__icon" aria-hidden="true">!</span>
          <div className="alert__body">
            <span className="alert__title">Your payment wasn't completed</span>
            {state.message} Nothing has been charged, and your booking is still held and still waiting for payment.
            <div className="row" style={{ marginTop: 'var(--space-3)' }}>
              <button className="btn btn--primary btn--sm" type="button" onClick={onRetry}>{retryLabel}</button>
              <Link className="btn btn--ghost btn--sm" to="/my-bookings">My Bookings</Link>
            </div>
            <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
              Trying again opens PayPal with the same total and the same held booking. You will not be charged twice.
            </p>
          </div>
        </div>
      ) : null}

      {completed ? (
        <div className="alert alert--success" role="status">
          <span className="alert__icon" aria-hidden="true">✓</span>
          <div className="alert__body">
            <span className="alert__title">Payment completed</span>
            €{Number(state.amount ?? booking.total_price).toFixed(2)} paid through PayPal.
            <div className="row" style={{ marginTop: 'var(--space-3)' }}>
              {state.reference ? (
                <Link className="btn btn--primary btn--sm" to={`/bookings/${state.reference}/confirmed`}>See your confirmation</Link>
              ) : null}
              <Link className="btn btn--ghost btn--sm" to="/my-bookings">My Bookings</Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
