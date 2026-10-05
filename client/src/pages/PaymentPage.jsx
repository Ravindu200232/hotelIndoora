import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, formatDate } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import { Alert, LoadingBlock, Panel, Steps } from '../components/index.jsx';
import { AmountBreakdown } from '../components/bookings/AmountBreakdown.jsx';
import { PayPalPanel } from '../components/bookings/PayPalPanel.jsx';
import { PaymentStatus } from '../components/bookings/PaymentStatus.jsx';

const clock = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/**
 * Payment: the full amount for the stay — the nightly rate for every night, with
 * nothing added — taken through PayPal in one payment. The booking is confirmed
 * the moment PayPal reports the payment completed, with no review or approval
 * step, and the room is held while the guest pays.
 *
 * The button hands the guest to PayPal and brings them back here, where the
 * payment is verified with PayPal before anything is treated as paid.
 */
export function PaymentPage() {
  const [params] = useSearchParams();
  const bookingId = params.get('booking_id');
  const orderFromPayPal = params.get('order');
  const cancelledAtPayPal = params.get('cancelled');

  const booking = useAsync(
    () => (bookingId ? api.booking(bookingId) : Promise.resolve({ booking: null })),
    [bookingId],
  );
  const [state, setState] = useState({ status: 'idle', message: null, checkedAt: null, amount: null, reference: null });

  const data = booking.data?.booking ?? null;
  const roomType = useAsync(
    () => (data?.room_type_id ? api.roomType(data.room_type_id) : Promise.resolve({ room_type: null })),
    [data?.room_type_id],
  );

  useEffect(() => {
    if (!data) return;
    if (data.status === 'confirmed') {
      setState({
        status: 'completed',
        message: null,
        checkedAt: clock(),
        amount: data.total_price,
        reference: data.booking_reference,
      });
      return;
    }
    if (cancelledAtPayPal) {
      setState({
        status: 'failed',
        message: 'The PayPal window was closed before you finished.',
        checkedAt: clock(),
        amount: null,
        reference: null,
      });
    }
  }, [data, cancelledAtPayPal]);

  // Coming back from PayPal: verify the payment with PayPal before believing it.
  useEffect(() => {
    if (!bookingId || !orderFromPayPal || !data || data.status === 'confirmed') return;
    let live = true;
    setState((current) => ({ ...current, status: 'capturing', message: null }));
    api.capturePayment(bookingId, orderFromPayPal)
      .then((payload) => {
        if (!live) return;
        const fresh = payload.booking;
        setState({
          status: 'completed',
          message: null,
          checkedAt: clock(),
          amount: fresh?.total_price ?? data.total_price,
          reference: fresh?.booking_reference ?? null,
        });
        booking.reload();
      })
      .catch((error) => {
        if (!live) return;
        setState({
          status: 'failed',
          message: error.message,
          checkedAt: clock(),
          amount: null,
          reference: null,
        });
      });
    return () => { live = false; };
  }, [bookingId, orderFromPayPal, data, booking]);

  const pay = async () => {
    setState((current) => ({ ...current, status: 'paying', message: null }));
    try {
      const order = await api.openPayPalOrder(bookingId);
      if (order?.approve_url) {
        // Hand the guest to PayPal; they come back to this page.
        window.location.assign(order.approve_url);
        return;
      }
      setState({
        status: 'failed',
        message: 'PayPal did not return a payment address for this booking.',
        checkedAt: clock(),
        amount: null,
        reference: null,
      });
    } catch (error) {
      setState({
        status: 'failed',
        message: error.message,
        checkedAt: clock(),
        amount: null,
        reference: null,
      });
    }
  };

  if (!bookingId) {
    return (
      <main id="main">
        <div className="wrap section">
          <h1>Pay for your stay</h1>
          <p className="lead">Choose your room and dates first — then the amount to pay appears here.</p>
          <Panel tint>
            <div className="row">
              <Link className="btn btn--primary btn--sm" to="/rooms">See the rooms</Link>
              <Link className="btn btn--ghost btn--sm" to="/my-bookings">My Bookings</Link>
            </div>
          </Panel>
        </div>
      </main>
    );
  }

  if (booking.loading) {
    return (
      <main id="main">
        <div className="wrap section">
          <LoadingBlock label="Loading your booking and the amount to pay…" lines={3} />
        </div>
      </main>
    );
  }

  if (booking.failed || !data) {
    return (
      <main id="main">
        <div className="wrap section">
          <h1>Pay for your stay</h1>
          <Alert kind="error" title="We could not load this booking">
            {booking.error?.message} — nothing has been charged. Open your bookings to find the stay, or choose the room
            again.
            <div className="row" style={{ marginTop: 'var(--space-3)' }}>
              <button className="btn btn--ghost btn--sm" type="button" onClick={booking.reload}>Try again</button>
              <Link className="btn btn--primary btn--sm" to="/my-bookings">My Bookings</Link>
            </div>
          </Alert>
        </div>
      </main>
    );
  }

  const minutesLeft = data.hold_expires_at
    ? Math.max(0, Math.round((new Date(data.hold_expires_at).getTime() - Date.now()) / 60000))
    : null;

  return (
    <main id="main">
      <div className="wrap page-head">
        <Steps steps={['Booking details', 'Payment', 'Confirmed']} current={1} />
        <h1>Pay for your stay</h1>
        <p className="lead">
          {roomType.data?.room_type?.name ?? 'Your room'}, {formatDate(data.check_in_date)} to {formatDate(data.check_out_date)}.
          {minutesLeft !== null && minutesLeft > 0
            ? ` Your room is held until ${new Date(data.hold_expires_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} today, then it goes back on sale.`
            : ' The room is held while you pay.'}
        </p>
      </div>

      <section className="section" style={{ paddingTop: 'var(--space-4)' }}>
        <div className="wrap split">
          <div>
            <AmountBreakdown booking={data} />
            <PaymentStatus
              state={state}
              checkedAt={state.checkedAt}
              booking={data}
              onRetry={pay}
              retryLabel={state.status === 'paying' ? 'Opening PayPal…' : 'Try again'}
            />
            <Panel style={{ marginTop: 'var(--space-5)' }}>
              <h4>How the payment works</h4>
              <ul>
                <li>PayPal takes the total shown above in one payment.</li>
                <li>Nothing is charged on this page, and no card or bank details are kept on the site.</li>
                <li>The booking confirms the moment PayPal reports the payment completed, with no review or approval step.</li>
                <li>If you do not finish the payment within 30 minutes, the room goes back on sale and nothing is charged.</li>
              </ul>
            </Panel>
          </div>

          <PayPalPanel
            booking={data}
            roomType={roomType.data?.room_type ?? null}
            onPay={pay}
            paying={state.status === 'paying'}
            minutesLeft={minutesLeft}
            error={state.status === 'failed' ? state.message : null}
          />
        </div>
      </section>
    </main>
  );
}
