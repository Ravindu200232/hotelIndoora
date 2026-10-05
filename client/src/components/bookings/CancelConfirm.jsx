import { Link } from 'react-router-dom';
import { Button, Panel } from '../index.jsx';
import { money } from '../../api.js';

/**
 * The confirmation itself: cancel and have the whole amount refunded, keep the
 * booking as it is, or move it to other dates instead. Nothing is cancelled
 * until the guest presses the button.
 */
export function CancelConfirm({ booking, paid, onCancel, cancelling, disabled }) {
  return (
    <Panel as="aside" aria-labelledby="confirm-title">
      <h3 id="confirm-title">Cancel and refund {money(paid)}</h3>
      <p>Your room is released and these {booking.nights} nights go back on sale. We email you as soon as PayPal has the refund.</p>
      <Button
        kind="danger"
        block
        type="button"
        onClick={onCancel}
        disabled={cancelling || disabled}
        aria-busy={cancelling}
      >
        {cancelling ? 'Cancelling and refunding…' : 'Cancel booking and refund'}
      </Button>
      <p style={{ marginTop: 'var(--space-3)' }}>
        <Link className="btn btn--ghost btn--block" to={`/my-bookings/${booking.id}`}>Keep my booking</Link>
      </p>
      <p className="small muted"><Link to="/my-bookings">Back to My Bookings</Link></p>
      <hr />
      <h4>Rather move your stay?</h4>
      <p className="small muted">
        You can keep the booking and change its dates or room type instead, with the difference settled through PayPal.
      </p>
      <Link className="btn btn--quiet btn--sm btn--block" to={`/my-bookings/${booking.id}/change`}>Change booking instead</Link>
    </Panel>
  );
}
