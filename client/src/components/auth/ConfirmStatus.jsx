import { Badge, Button, Panel } from '../index.jsx';

/**
 * Whether the address is confirmed yet, and the way to ask again.
 *
 * A guest can check as often as they like: the answer comes from the server's
 * own record of the account, not from what the page remembers.
 */
export function ConfirmStatus({ confirmed, email, lastCheckedAt, onCheck, checking }) {
  return (
    <Panel>
      <h4 id="status-title">Confirmation status</h4>
      <p>
        <Badge kind={confirmed ? 'confirmed' : 'pending'}>
          {confirmed ? 'Confirmed' : 'Not yet confirmed'}
        </Badge>
      </p>
      <p className="small muted">
        {lastCheckedAt ? `Last checked at ${lastCheckedAt}. ` : ''}
        Your dates and the room type you chose are still kept for your booking.
      </p>
      <Button
        kind="ghost"
        size="sm"
        type="button"
        onClick={onCheck}
        disabled={checking}
      >
        {checking ? 'Checking…' : 'Check the status'}
      </Button>
      {email ? <p className="visually-hidden">{`Status for ${email}`}</p> : null}
    </Panel>
  );
}

/**
 * Send the confirmation email again, with the cap the specification sets: five
 * in any hour for one account. When the cap is reached the page says when
 * another request will be accepted rather than failing silently.
 */
export function ResendPanel({ email, state, remaining, retryAt, onResend }) {
  const capReached = state.status === 'limit';
  return (
    <section aria-labelledby="resend-title" style={{ marginTop: 'var(--space-5)' }}>
      <h4 id="resend-title">Send it again</h4>
      <Button kind="secondary" type="button" onClick={onResend} disabled={state.status === 'sending' || capReached}>
        {state.status === 'sending' ? 'Sending…' : 'Resend confirmation email'}
      </Button>
      <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
        {typeof remaining === 'number'
          ? `You can send five confirmation emails in any hour. ${remaining} are left.`
          : 'You can send five confirmation emails in any hour.'}
      </p>
      {state.status === 'sent' ? (
        <div className="alert alert--success" role="status">
          <span className="alert__icon" aria-hidden="true">✓</span>
          <div className="alert__body">
            <span className="alert__title">Confirmation email sent</span>
            We sent another confirmation link to {email} at {state.at}. It can take a minute or two to arrive.
          </div>
        </div>
      ) : null}
      {state.status === 'failed' ? (
        <div className="alert alert--error" role="alert">
          <span className="alert__icon" aria-hidden="true">!</span>
          <div className="alert__body">
            <span className="alert__title">We could not send the confirmation email</span>
            {state.message} — nothing has changed: your address is still waiting to be confirmed, and the link in your
            earlier email still works.
          </div>
        </div>
      ) : null}
      {capReached ? (
        <div className="alert alert--warn" role="alert">
          <span className="alert__icon" aria-hidden="true">!</span>
          <div className="alert__body">
            <span className="alert__title">You have reached the limit for now</span>
            Five confirmation emails have been sent to {email} in the last hour. You can send another after {retryAt}, or
            open the link in the email you already have.
          </div>
        </div>
      ) : null}
    </section>
  );
}
