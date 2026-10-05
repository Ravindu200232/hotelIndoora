import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Dialog, Panel, PlainList } from '../index.jsx';
import { formatDate, formatShortDate, money } from '../../api.js';

const STATUS = {
  confirmed: { kind: 'confirmed', label: 'Confirmed' },
  pending_payment: { kind: 'pending', label: 'Waiting for payment' },
  cancelled: { kind: 'cancelled', label: 'Cancelled' },
};

/** The booking's own status, as the desk reads it. */
export function BookingStatus({ status }) {
  const shape = STATUS[status] ?? { kind: 'neutral', label: status ?? 'Unknown' };
  return <Badge kind={shape.kind}>{shape.label}</Badge>;
}

/** The money at a glance, and the nights it covers. */
export function AmountPaidPanel({ booking, payments, roomTypeName }) {
  const paid = payments
    .filter((payment) => payment.status === 'completed')
    .reduce((sum, payment) => sum + (payment.type === 'refund' ? -Number(payment.amount) : Number(payment.amount)), 0);

  return (
    <Panel accent>
      <h4>{paid > 0 ? 'Amount paid' : 'Amount due'}</h4>
      <p className="price" style={{ margin: 0 }}>{money(paid > 0 ? paid : booking.total_price)}</p>
      <p className="small muted">
        {paid > 0
          ? `${booking.nights} ${booking.nights === 1 ? 'night' : 'nights'} × ${money(booking.nightly_rate)} per night. Nothing added at checkout.`
          : `Not paid yet — ${booking.nights} ${booking.nights === 1 ? 'night' : 'nights'} × ${money(booking.nightly_rate)} per night, and the room is held while the guest pays.`}
      </p>
      <div className="stay-band" style={{ gridTemplateColumns: '1fr', marginTop: 'var(--space-3)' }}>
        <div>
          <b>{formatShortDate(booking.check_in_date)} → {formatDate(booking.check_out_date)}</b>
          <span className="stay-band__line" aria-hidden="true" />
        </div>
      </div>
      <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
        {roomTypeName} · booking {booking.booking_reference ?? 'without a reference yet'}
      </p>
    </Panel>
  );
}

/**
 * What the desk can do with this booking.
 *
 * Cancelling a paid booking refunds the whole amount through PayPal with no fee
 * kept back; cancelling one that was never paid frees the room with nothing to
 * refund. A booking waiting for payment can have its PayPal link sent again.
 */
export function RecordActions({
  booking,
  paid,
  sending,
  sent,
  sendError,
  onCancelPaid,
  onCancelUnpaid,
  onSendLink,
}) {
  const cancelled = booking.status === 'cancelled';
  const unpaid = booking.status === 'pending_payment';

  return (
    <Panel>
      <h4>Actions</h4>
      {cancelled ? (
        <p className="small muted" style={{ margin: 0 }}>
          This booking is cancelled, so there is nothing left to cancel, refund or move. Its record stays for accounting.
        </p>
      ) : (
        <>
          <Link className="btn btn--primary btn--block" to={`/staff/bookings/${booking.id}/edit`}>
            Edit booking
          </Link>
          <p style={{ marginTop: 'var(--space-3)' }}>
            {paid > 0 ? (
              <Button kind="danger" block type="button" onClick={onCancelPaid}>
                Cancel and refund {money(paid)}
              </Button>
            ) : (
              <Button kind="danger" block type="button" onClick={onCancelUnpaid}>
                Cancel unpaid booking
              </Button>
            )}
          </p>
        </>
      )}

      {unpaid ? (
        <p>
          <Button kind="ghost" block type="button" onClick={onSendLink} disabled={sending} aria-busy={sending}>
            {sending ? 'Sending…' : sent ? 'Send the link again' : 'Send payment link'}
          </Button>
        </p>
      ) : null}

      {sent ? (
        <Alert kind="success" title="The PayPal link is on its way">
          Sent to {booking.guest_email}. The room stays held while the booking waits for payment.
        </Alert>
      ) : null}

      {sendError ? (
        <Alert kind="error" title="The payment link could not be emailed">
          {sendError.message}
          {sendError.link ? (
            <>
              {' '}The link itself was created, so it can be passed to the guest directly:{' '}
              <a href={sendError.link}>open the PayPal link</a>.
            </>
          ) : null}
        </Alert>
      ) : null}

      <p className="small muted">
        Moving this stay to other dates or another room type settles the difference through PayPal, and the booking keeps
        its reference {booking.booking_reference ?? 'from now on'}.
      </p>
    </Panel>
  );
}

/**
 * The states this record can be in, shown when they are true of this booking, and
 * the two the desk can still reach from here.
 */
export function OtherStatesPanel({ booking, paid, state, onRetryRefund }) {
  const shape = STATUS[booking.status] ?? { kind: 'neutral', label: booking.status };
  const nights = `${formatShortDate(booking.check_in_date).slice(4)} to ${formatShortDate(booking.check_out_date).slice(4)}`;

  if (booking.status === 'cancelled') {
    return (
      <Panel as="section" tint aria-labelledby="record-states" style={{ marginTop: 'var(--space-5)' }}>
        <h3 id="record-states">This booking is cancelled</h3>
        <p><Badge kind="cancelled">Cancelled</Badge></p>
        <p className="small muted">
          {paid > 0
            ? `${money(paid)} went back through PayPal, the guest was emailed and the room is back on sale for ${nights}.`
            : `The guest never paid, so there was nothing to refund and the room is back on sale for ${nights}.`}
        </p>
      </Panel>
    );
  }

  if (booking.status === 'pending_payment') {
    return (
      <Panel as="section" aria-labelledby="unpaid-title" style={{ marginTop: 'var(--space-5)' }}>
        <h2 id="unpaid-title">No payment received yet</h2>
        <p><Badge kind={shape.kind}>{shape.label}</Badge></p>
        <p className="small muted">
          The guest has not paid through the PayPal link yet. The room stays held while the booking waits for payment,
          and the link can be sent again to the same address.
        </p>
        {state.status === 'refund_failed' ? (
          <Alert kind="error" title="The booking was not cancelled">
            {state.message} The booking still holds its room.
          </Alert>
        ) : null}
      </Panel>
    );
  }

  return (
    <Panel as="section" tint aria-labelledby="record-states" style={{ marginTop: 'var(--space-5)' }}>
      <h3 id="record-states">Other states of this booking</h3>
      <p className="small muted">
        This booking is confirmed and paid in full. These are the other states the same record can be in, and what the
        desk sees in each one.
      </p>
      <PlainList>
        <li>
          <span><b>Cancelled and refunded</b> — the whole amount goes back through PayPal, the guest is emailed and the room returns to sale.</span>
          <span className="badge badge--cancelled">Cancelled</span>
        </li>
        <li>
          <span><b>Cancelled unpaid</b> — the guest never paid, so there is nothing to refund and the room is freed straight away.</span>
          <span className="badge badge--neutral">No refund</span>
        </li>
        <li>
          <span><b>Refund failed</b> — PayPal refused the refund, so the booking and the room stay exactly as they are until it succeeds.</span>
          <span className="badge badge--pending">Retry</span>
        </li>
      </PlainList>

      {state.status === 'refund_failed' ? (
        <Alert kind="error" title="The refund did not go through">
          {state.message} Nothing has been refunded, the booking stays confirmed and the room stays held. The guest is not
          emailed until the refund succeeds.
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Button kind="ghost" size="sm" type="button" onClick={onRetryRefund}>Retry the refund</Button>
            <Link className="btn btn--quiet btn--sm" to="/staff/bookings">Back to Bookings</Link>
          </div>
        </Alert>
      ) : null}
    </Panel>
  );
}

/**
 * The confirmation before a booking is cancelled, in the two cases the desk meets:
 * one that was paid for, whose whole amount goes back through PayPal, and one that
 * was never paid, where there is nothing to refund and the room is freed at once.
 */
export function CancelBookingDialog({ open, booking, paid, cancelling, failed, onClose, onConfirm }) {
  const paidBooking = paid > 0;
  const nights = `${formatShortDate(booking.check_in_date).slice(4)} to ${formatShortDate(booking.check_out_date).slice(4)}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={paidBooking
        ? `Cancel this booking and refund ${money(paid)}?`
        : 'Cancel this unpaid booking?'}
      footer={(
        <>
          <Button kind="ghost" size="sm" type="button" onClick={onClose} disabled={cancelling}>Keep the booking</Button>
          <Button
            kind={paidBooking ? 'danger' : 'primary'}
            size="sm"
            type="button"
            onClick={onConfirm}
            disabled={cancelling}
            aria-busy={cancelling}
          >
            {cancelling ? 'Cancelling…' : paidBooking ? `Cancel and refund ${money(paid)}` : 'Cancel unpaid booking'}
          </Button>
        </>
      )}
    >
      {paidBooking ? (
        <p>
          The whole amount paid goes back through PayPal, with no fee kept back. The guest is emailed, the booking is
          marked cancelled and the room goes back on sale for {nights} straight away.
        </p>
      ) : (
        <p>
          The guest never paid, so there is nothing to refund. Cancelling frees the room for {nights} immediately, and
          the booking stays on the record.
        </p>
      )}
      {failed ? (
        <p className="field__error" role="alert">
          {failed} Nothing has been changed — the booking is exactly as it was.
        </p>
      ) : null}
    </Dialog>
  );
}
