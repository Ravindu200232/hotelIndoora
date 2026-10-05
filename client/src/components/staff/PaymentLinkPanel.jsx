import { Link } from 'react-router-dom';
import { Alert, Button, Field, Input, Panel, ProgressTrack } from '../index.jsx';
import { money } from '../../api.js';

/**
 * Sending the guest the PayPal link for the whole amount.
 *
 * The address is the one on the booking, and the desk may correct it as it sends —
 * the link and the confirmation both go there. Nothing is charged from this page:
 * the guest pays at PayPal, and the booking confirms with its reference the moment
 * PayPal reports the payment.
 */
export function PaymentLinkPanel({
  booking,
  email,
  onEmailChange,
  emailError,
  onSend,
  sending,
  failed,
  sent,
}) {
  return (
    <Panel as="aside" accent aria-labelledby="link-title">
      <h4>Payment link</h4>
      <h3 id="link-title">Send the PayPal link</h3>

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <Field
          label="Email address the PayPal link will be sent to"
          htmlFor="link-email"
          hint={`Taken from the booking you just took. The guest pays the full ${money(booking.total_price)} through PayPal, and the confirmation with its reference goes to this same address.`}
          error={emailError}
        >
          <Input
            type="email"
            id="link-email"
            value={email}
            error={emailError}
            onChange={(event) => onEmailChange(event.target.value)}
          />
        </Field>

        <p className="small muted">
          PayPal is the only way to pay. The hotel stores no card or bank details, and nothing is charged from this page.
        </p>

        <Button kind="primary" block type="submit" disabled={sending} aria-busy={sending}>
          {sending ? 'Sending…' : sent ? 'Send the link again' : 'Send payment link'}
        </Button>
      </form>

      {sending ? (
        <Alert kind="info" title="Sending the link" style={{ marginTop: 'var(--space-4)' }}>
          The email is on its way to {email}. Keep this page open while it sends.
          <ProgressTrack percent={55} announce label="Sending the payment link" />
        </Alert>
      ) : null}

      {failed ? (
        <Alert kind="error" title="The payment link could not be sent" style={{ marginTop: 'var(--space-4)' }}>
          {failed.message} Nothing was emailed, so the guest has no link to pay yet — the room is still held.
          {failed.link ? (
            <>
              {' '}The link itself was created, so it can be passed to the guest directly:{' '}
              <a href={failed.link}>open the PayPal link</a>.
            </>
          ) : null}
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Button kind="primary" size="sm" type="button" onClick={onSend}>Send payment link again</Button>
            <Link className="btn btn--ghost btn--sm" to="/staff/bookings">Back to Bookings</Link>
          </div>
        </Alert>
      ) : null}

      {sent ? (
        <Alert kind="success" title="Payment link sent" style={{ marginTop: 'var(--space-4)' }}>
          {email} has a PayPal link for {money(booking.total_price)}.
          <p style={{ marginTop: 'var(--space-3)' }}><span className="badge badge--pending">Waiting for payment</span></p>
          <p className="small muted" style={{ margin: 0 }}>Booking reference</p>
          <p><span className="ref" style={{ fontSize: 'var(--text-lg)' }}>{booking.booking_reference ?? 'Not issued yet'}</span></p>
          <p className="small muted">
            The room is held for the nights of the booking, and it shows on Bookings as waiting for payment beside the
            bookings guests made online. It confirms with its reference the moment the guest pays.
          </p>
          <div className="row">
            <Link className="btn btn--primary btn--sm" to={`/staff/bookings/${booking.id}`}>Open the booking record</Link>
            <Link className="btn btn--ghost btn--sm" to="/staff/bookings">Back to Bookings</Link>
            {booking.booking_reference ? (
              <Link className="btn btn--quiet btn--sm" to={`/bookings/${booking.booking_reference}/paid`}>
                See what the guest sees
              </Link>
            ) : null}
          </div>
        </Alert>
      ) : null}

      <p style={{ marginTop: 'var(--space-3)' }}>
        <Link className="link-arrow" to="/staff/bookings/new" style={{ textDecoration: 'none' }}>
          ← Back to the booking form
        </Link>
      </p>
    </Panel>
  );
}
