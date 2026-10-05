import { Link } from 'react-router-dom';
import { Alert, Button, KvList, Panel, ProgressTrack } from '../index.jsx';
import { formatDate, money } from '../../api.js';

/**
 * What moving a booking costs, settled to the euro before the desk confirms.
 *
 * The new total less what the guest has already paid is the difference: a charge
 * through PayPal, a refund of the whole difference with nothing kept back, or
 * nothing at all. A charge needs the guest's approval at PayPal, so when that is
 * the case the panel says so and the desk can email the guest the link for it —
 * nothing is claimed to be paid before PayPal has reported it.
 */
export function ChangeCostPanel({
  booking,
  roomTypeName,
  fromRoomTypeName,
  checkIn,
  checkOut,
  nights,
  guests,
  newTotal,
  alreadyPaid,
  difference,
  confirming,
  onConfirm,
  onSendDifference,
  sending,
  differenceSent,
  state,
  canConfirm,
}) {
  const settled = difference.direction === 'charge'
    ? `Charge ${money(difference.amount)}`
    : difference.direction === 'refund'
      ? `Refund ${money(difference.amount)}`
      : 'Nothing to settle';

  return (
    <Panel as="aside" accent aria-labelledby="cost-title">
      <h3 id="cost-title">What this change costs</h3>
      <KvList rows={[
        ['Room type', `${fromRoomTypeName} → ${roomTypeName}`],
        ['New stay', `${formatDate(checkIn)} → ${formatDate(checkOut)}`],
        ['Nights', nights],
        ['Nightly rate', money(difference.rate ?? newTotal / (nights || 1))],
        ['Guests staying', guests],
        ['New total', money(newTotal)],
        ['Already paid', money(alreadyPaid)],
        [difference.direction === 'refund' ? 'Refund through PayPal' : 'Charge through PayPal', <b key="d">{difference.direction === 'none' ? '—' : money(difference.amount)}</b>],
      ]} />
      <p className="small muted">
        {difference.direction === 'charge'
          ? `Taken through PayPal once the guest approves it, and the booking keeps its reference ${booking.booking_reference ?? 'from now on'}.`
          : difference.direction === 'refund'
            ? `A lower new total is refunded through PayPal, with no fee kept back, and the booking keeps its reference ${booking.booking_reference ?? 'from now on'}.`
            : `The new total is what has already been paid, so nothing is charged or refunded and the booking keeps its reference ${booking.booking_reference ?? 'from now on'}.`}
      </p>
      <p className="small muted">{booking.lead_guest_name} is emailed the new stay details once the change is done.</p>

      <div className="row">
        <Button kind="primary" type="button" onClick={onConfirm} disabled={confirming || !canConfirm} aria-busy={confirming}>
          {confirming ? 'Settling with PayPal…' : state.status === 'paypal_failed' ? 'Try the change again' : 'Confirm change'}
        </Button>
        <Link className="btn btn--ghost" to={`/staff/bookings/${booking.id}`}>Back without changing</Link>
      </div>

      {confirming ? (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <ProgressTrack percent={60} announce label="Settling the difference with PayPal" />
        </div>
      ) : null}

      {state.status === 'paypal_failed' ? (
        <Alert kind="error" title="PayPal did not complete the difference" style={{ marginTop: 'var(--space-4)' }}>
          {state.message} Nothing has been charged and the stay is still{' '}
          {formatDate(booking.check_in_date)} → {formatDate(booking.check_out_date)} on {fromRoomTypeName}.
        </Alert>
      ) : null}

      {state.status === 'not_free' ? (
        <Alert kind="error" title="No room of that room type is free" style={{ marginTop: 'var(--space-4)' }}>
          {state.message} Nothing has changed on the booking — choose another room type or other dates.
        </Alert>
      ) : null}

      {state.status === 'refused' ? (
        <Alert kind="error" title="Those dates cannot be used" style={{ marginTop: 'var(--space-4)' }}>
          {state.message} Nothing has changed on the booking.
        </Alert>
      ) : null}

      {state.status === 'done' ? (
        <Alert kind="success" title="Booking changed" style={{ marginTop: 'var(--space-4)' }}>
          {roomTypeName}, {formatDate(state.checkIn)} → {formatDate(state.checkOut)}, {state.nights}{' '}
          {state.nights === 1 ? 'night' : 'nights'}.{' '}
          {state.difference?.direction === 'charge'
            ? state.difference.pending
              ? `${money(state.difference.amount)} is waiting to be approved at PayPal.`
              : `${money(state.difference.amount)} charged through PayPal.`
            : state.difference?.direction === 'refund'
              ? `${money(state.difference.amount)} refunded through PayPal.`
              : 'Nothing further was due.'}{' '}
          The guest has been emailed.
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Link className="btn btn--primary btn--sm" to={`/staff/bookings/${booking.id}`}>Open the Booking Record</Link>
          </div>
        </Alert>
      ) : null}

      {state.status === 'done' && state.difference?.approve_url ? (
        <Alert kind="info" title={`${money(state.difference.amount)} is still to be paid`} style={{ marginTop: 'var(--space-4)' }}>
          The guest approves it at PayPal, and the amount is recorded against the booking the moment PayPal reports it.
          {differenceSent ? (
            <p className="small muted" style={{ margin: 'var(--space-3) 0 0' }}>
              The link is on its way to {booking.guest_email}.
            </p>
          ) : (
            <div className="row" style={{ marginTop: 'var(--space-3)' }}>
              <Button kind="primary" size="sm" type="button" onClick={onSendDifference} disabled={sending} aria-busy={sending}>
                {sending ? 'Sending…' : 'Email the guest the link'}
              </Button>
              <a className="btn btn--ghost btn--sm" href={state.difference.approve_url}>Open the PayPal link</a>
            </div>
          )}
          {state.differenceMail?.status === 'failed' ? (
            <p className="field__error" role="alert" style={{ marginTop: 'var(--space-3)' }}>
              {state.differenceMail.error} The link above still works.
            </p>
          ) : null}
        </Alert>
      ) : null}
    </Panel>
  );
}
