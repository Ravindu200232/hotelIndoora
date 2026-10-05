import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Panel, ProgressTrack } from '../index.jsx';
import { money } from '../../api.js';

/**
 * The password, and nothing else, confirms a deletion. A wrong password erases
 * nothing; a refund PayPal has not confirmed also erases nothing, and the guest
 * is told which booking is holding it up and why.
 */
export function DeleteConfirm({ onDelete, state, upcoming }) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);

  return (
    <Panel as="aside" accent aria-labelledby="confirm-title">
      <h2 id="confirm-title">Confirm deletion</h2>
      <p>Enter your password to delete this account. This cannot be undone.</p>

      {upcoming ? (
        <Alert kind="info" title={`Booking ${upcoming.booking_reference} is cancelled first`}>
          The whole amount is refunded through PayPal before anything is erased, and your details are erased only once
          PayPal reports that refund completed.
        </Alert>
      ) : (
        <Alert kind="info" title="No upcoming stay is affected">
          You have no upcoming confirmed booking, so nothing has to be cancelled or refunded before your details are
          erased.
        </Alert>
      )}

      <div className="field">
        <label htmlFor="pw">Your password</label>
        <div className="password-row">
          <input
            type={show ? 'text' : 'password'}
            id="pw"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            className="toggle"
            type="button"
            aria-label={show ? 'Hide password' : 'Show password'}
            onClick={() => setShow((value) => !value)}
          >
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {state.status === 'refused' ? (
        <Alert kind="error" title="That password is not correct">
          {state.message} Nothing has been erased.
        </Alert>
      ) : null}

      {state.status === 'working' ? (
        <Alert kind="info" title="Deleting your account">
          {upcoming
            ? `Cancelling booking ${upcoming.booking_reference} and asking PayPal for the ${money(upcoming.total_price)} refund. This usually takes a few seconds.`
            : 'Erasing your details now. This usually takes a few seconds.'}
          <ProgressTrack percent={55} />
          <Button kind="ghost" size="sm" type="button" aria-disabled="true" style={{ marginTop: 'var(--space-3)' }}>
            Deleting your account…
          </Button>
          <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
            Please hold on. When it finishes you are signed out everywhere and taken to Home.
          </p>
        </Alert>
      ) : null}

      {state.status === 'refund_unconfirmed' ? (
        <Alert kind="error" title="Your account was not deleted">
          {state.message} Nothing has been erased and you are still signed in.
          {state.outstanding?.length ? (
            <ul className="plain-list" style={{ marginTop: 'var(--space-3)' }}>
              {state.outstanding.map((item) => (
                <li key={item.reference}>
                  <span>Booking {item.reference}</span>
                  <span>
                    {item.amount ? `${money(item.amount)} — the refund is outstanding.` : item.reason}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Button kind="primary" size="sm" type="button" onClick={() => onDelete(password)}>Try again</Button>
            {upcoming ? (
              <Link className="btn btn--ghost btn--sm" to={`/my-bookings/${upcoming.id}`}>
                View booking {upcoming.booking_reference}
              </Link>
            ) : null}
          </div>
        </Alert>
      ) : null}

      <Button
        kind="danger"
        block
        type="button"
        onClick={() => onDelete(password)}
        disabled={state.status === 'working' || !password}
        aria-busy={state.status === 'working'}
        style={{ marginTop: 'var(--space-4)' }}
      >
        {state.status === 'working' ? 'Deleting…' : 'Delete my account'}
      </Button>
      <p style={{ marginTop: 'var(--space-3)' }}>
        <Link className="btn btn--ghost btn--block" to="/account">Keep my account</Link>
      </p>
      <p className="small muted"><Link to="/my-bookings">My Bookings</Link></p>
    </Panel>
  );
}

/** The one thing left to say after a deletion that went through. */
export function DeletedNotice({ email }) {
  return (
    <Panel as="section" accent>
      <Alert kind="success" title="Account deleted">
        Your full name, email address, phone number, password and sign-in sessions have been erased, and you are signed
        out. Past bookings are kept for accounting with the lead guest's name, contact phone number, email address and
        special requests removed.
      </Alert>
      {email ? <p className="small muted">{email} can no longer be used to sign in.</p> : null}
    </Panel>
  );
}

/** The next confirmed stay, which is cancelled and refunded first. */
export function nextUpcomingBooking(bookings) {
  const upcoming = (bookings?.upcoming ?? []).filter((booking) => booking.status === 'confirmed');
  if (!upcoming.length) return null;
  return [...upcoming].sort((a, b) => new Date(a.check_in_date) - new Date(b.check_in_date))[0];
}
