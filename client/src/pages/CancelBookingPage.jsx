import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatDate, money } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import { Alert, LoadingBlock } from '../components/index.jsx';
import { RefundSummary, CancelStates } from '../components/bookings/RefundSummary.jsx';
import { CancelConfirm } from '../components/bookings/CancelConfirm.jsx';

/**
 * Cancel Booking: the whole amount comes back through PayPal, with no fee kept
 * back — the same whether the stay is months away or on the arrival day itself.
 *
 * The refund is requested when the guest confirms; if PayPal cannot complete it,
 * nothing is cancelled and the booking stays exactly as it was.
 */
export function CancelBookingPage() {
  const { bookingId } = useParams();
  const booking = useAsync(() => api.booking(bookingId), [bookingId]);
  const data = booking.data?.booking ?? null;
  const roomType = useAsync(
    () => (data?.room_type_id ? api.roomType(data.room_type_id) : Promise.resolve({ room_type: null })),
    [data?.room_type_id],
  );
  const [state, setState] = useState({ status: 'idle', message: null, amount: null, transactionId: null });

  if (booking.loading) {
    return <main id="main"><div className="wrap section"><LoadingBlock label="Loading your booking…" lines={3} /></div></main>;
  }

  if (booking.failed || !data) {
    return (
      <main id="main">
        <div className="wrap section">
          <h1>Cancel this booking?</h1>
          <Alert kind="error" title={booking.error?.status === 404 ? "We can't show this booking" : 'We could not load this booking'}>
            {booking.error?.status === 404
              ? 'This booking does not belong to your account, so it cannot be cancelled here.'
              : `${booking.error?.message} — nothing has changed, and nothing has been refunded.`}
            <div className="row" style={{ marginTop: 'var(--space-3)' }}>
              <Link className="btn btn--primary btn--sm" to="/my-bookings">Back to My Bookings</Link>
              <button className="btn btn--ghost btn--sm" type="button" onClick={booking.reload}>Try again</button>
            </div>
          </Alert>
        </div>
      </main>
    );
  }

  const payments = data.payments ?? [];
  const charge = payments.find((payment) => payment.type === 'charge' && payment.status === 'completed');
  const refunds = payments.filter((payment) => payment.type === 'refund');
  const refunded = refunds.filter((payment) => payment.status === 'completed')
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  // Everything paid on the booking comes back when it is cancelled, so the
  // figure is the completed charges less the completed refunds.
  const settledPayments = payments.filter((payment) => payment.status === 'completed')
    .reduce((sum, payment) => sum + (payment.type === 'refund' ? -Number(payment.amount) : Number(payment.amount)), 0);
  const paid = settledPayments || Number(data.total_price);
  const cancelledAlready = data.status === 'cancelled';

  const cancel = async () => {
    if (cancelledAlready) {
      setState({
        status: 'already',
        amount: refunded || paid,
        transactionId: refunds[0]?.paypal_transaction_id ?? null,
      });
      return;
    }
    setState({ status: 'requesting', amount: paid, message: null, transactionId: null });
    try {
      const payload = await api.cancelBooking(bookingId);
      setState({
        status: 'cancelled',
        amount: payload.refund?.amount ?? paid,
        transactionId: payload.refund?.id ?? null,
        refundStatus: payload.refund?.status ?? null,
        message: null,
      });
      booking.reload();
    } catch (error) {
      setState({ status: 'failed', amount: paid, transactionId: null, message: error.message });
    }
  };

  return (
    <main id="main">
      <div className="wrap page-head">
        <div className="page-head__grid">
          <div>
            <h1>Cancel this booking?</h1>
            <p className="lead">
              {roomType.data?.room_type?.name ?? 'Your room'} · {data.nights} nights from {formatDate(data.check_in_date)}
            </p>
          </div>
          <Link className="btn btn--ghost btn--sm" to={`/my-bookings/${data.id}`}>Back to the booking</Link>
        </div>
      </div>

      <section className="section" style={{ paddingTop: 'var(--space-3)' }}>
        <div className="wrap split">
          <div>
            <RefundSummary
              booking={data}
              roomType={roomType.data?.room_type ?? null}
              paid={paid}
              nights={data.nights}
              paidOn={charge?.created_at ? new Date(charge.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null}
              transactionId={charge?.paypal_transaction_id ?? null}
            />
            <CancelStates state={state} booking={data} paid={paid} onRetry={cancel} />
          </div>

          <CancelConfirm
            booking={data}
            paid={paid}
            onCancel={cancel}
            cancelling={state.status === 'requesting'}
            disabled={cancelledAlready}
          />
        </div>
      </section>
    </main>
  );
}
