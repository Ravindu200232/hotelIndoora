import { Link, useLocation, useParams } from 'react-router-dom';
import { api, formatDate, money } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import { useHotel } from '../hotel.jsx';
import { useToast } from '../components/ui/feedback.jsx';
import {
  Alert, Badge, Button, Grid, KvList, LoadingBlock, Panel, Ref, StayBand,
  TableWrap, Table, Caption, Thead, Tbody, Tfoot, Tr, Td,
} from '../components/index.jsx';

/**
 * My Booking: one booking in full — the stay, the guest details given at
 * booking, the total and every payment and refund against it — with the two
 * things a guest can do to it themselves: change the dates or the room type, or
 * cancel and have the whole amount refunded.
 *
 * A booking that is not theirs is not shown at all; the server refuses it, and
 * the page says so instead of pretending.
 */
export function MyBookingPage() {
  const { bookingId } = useParams();
  const { show } = useToast();
  const { hotel } = useHotel();
  const location = useLocation();
  const booking = useAsync(() => api.booking(bookingId), [bookingId]);
  const data = booking.data?.booking ?? null;
  const roomType = useAsync(
    () => (data?.room_type_id ? api.roomType(data.room_type_id) : Promise.resolve({ room_type: null })),
    [data?.room_type_id],
  );

  const copy = async () => {
    if (!data?.booking_reference) return;
    try { await navigator.clipboard.writeText(data.booking_reference); } catch { /* on screen anyway */ }
    show(`Reference ${data.booking_reference} copied.`);
  };

  if (booking.loading) {
    return (
      <main id="main">
        <div className="wrap section">
          <LoadingBlock label="Loading your booking…" lines={3} />
        </div>
      </main>
    );
  }

  if (booking.failed || !data) {
    const notMine = booking.error?.status === 404;
    return (
      <main id="main">
        <div className="wrap section">
          <h1>Your booking</h1>
          <Alert kind="error" title={notMine ? "We can't show this booking" : 'We could not load this booking'}>
            {notMine
              ? 'This booking does not belong to your account. Open your own bookings, or sign in with the account that made it.'
              : `${booking.error?.message} — nothing has changed on your stay.`}
            <div className="row" style={{ marginTop: 'var(--space-3)' }}>
              <Link className="btn btn--primary btn--sm" to="/my-bookings">Back to My Bookings</Link>
              <Link className="btn btn--ghost btn--sm" to="/login">Sign in</Link>
            </div>
          </Alert>
        </div>
      </main>
    );
  }

  const payments = data.payments ?? [];
  const charge = payments.find((payment) => payment.type === 'charge');
  const refunds = payments.filter((payment) => payment.type === 'refund');
  const refunded = refunds.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const paid = charge ? Number(charge.amount) - refunded : 0;
  const cancelled = data.status === 'cancelled';
  const changed = location.state?.changed;

  return (
    <main id="main">
      <div className="wrap page-head">
        <div className="page-head__grid">
          <div>
            <Link className="link-arrow" to="/my-bookings" style={{ textDecoration: 'none' }}>← Back to My Bookings</Link>
          </div>
          <div className="row">
            <Link className="btn btn--ghost btn--sm" to="/rooms">Book another room</Link>
          </div>
        </div>
      </div>

      <section className="section" style={{ paddingTop: 'var(--space-3)' }}>
        <div className="wrap">
          {changed ? (
            <Alert kind="success" title="Booking changed">
              Your stay is now {changed.nights} nights, checking out on {changed.checkOut}.{' '}
              {changed.refund ? `We have sent ${money(changed.refund)} back to your PayPal account — the refund is listed with your payments below.` : 'Nothing further was due.'}
            </Alert>
          ) : null}

          <Panel>
            <div className="row row--between">
              <div>
                <h4 style={{ marginBottom: 'var(--space-1)' }}>Booking reference</h4>
                <h1 style={{ margin: 0 }}>
                  <Ref style={{ fontSize: 'var(--text-2xl)' }}>{data.booking_reference ?? 'Not issued yet'}</Ref>
                </h1>
              </div>
              <div className="row">
                <Badge kind={cancelled ? 'cancelled' : data.status === 'confirmed' ? 'confirmed' : 'pending'}>
                  {cancelled ? 'Cancelled' : data.status === 'confirmed' ? 'Confirmed' : 'Waiting for payment'}
                </Badge>
                {data.booking_reference ? (
                  <Button kind="ghost" size="sm" type="button" onClick={copy}>Copy reference</Button>
                ) : null}
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-5)' }}>
              <StayBand
                from={new Date(data.check_in_date).toDateString().slice(0, 10)}
                nights={data.nights}
                rate={money(data.nightly_rate)}
                to={new Date(data.check_out_date).toDateString().slice(0, 10)}
              />
            </div>

            <div className="split" style={{ marginTop: 'var(--space-6)' }}>
              <Panel tint as="section" aria-labelledby="stay-title">
                <h4 id="stay-title">Stay details</h4>
                <KvList stacked rows={[
                  ['Room type', roomType.data?.room_type?.name ?? '—'],
                  ['Nights', data.nights],
                  ['Number of guests', data.guest_count],
                  ['Expected arrival time', data.expected_arrival_time],
                  ['Nightly rate', money(data.nightly_rate)],
                  ['Booked', `${new Date(data.booked_at).toDateString()} by ${data.booked_by === 'staff' ? 'the hotel' : 'you'}`],
                ]} />
              </Panel>

              <Panel as="section" aria-labelledby="guest-title">
                <h4 id="guest-title">Guest details given at booking</h4>
                <KvList stacked rows={[
                  ['Lead guest', data.lead_guest_name],
                  ['Contact phone', data.contact_phone],
                  ['Email address', data.guest_email],
                  ['Special requests', data.special_requests || '—'],
                ]} />
              </Panel>
            </div>
          </Panel>

          <Panel as="section" aria-labelledby="payments-title" style={{ marginTop: 'var(--space-5)' }}>
            <div className="row row--between">
              <div>
                <h4 id="payments-title">Total for the stay</h4>
                <p className="price" style={{ margin: 0 }}>{money(data.total_price)}</p>
              </div>
              <p className="small muted" style={{ margin: 0 }}>
                {data.nights} nights × {money(data.nightly_rate)} a night · nothing added at checkout
              </p>
            </div>
            <div className="table-wrap" style={{ marginTop: 'var(--space-4)' }}>
              <table className="receipt">
                <caption>Every payment and refund against this booking.</caption>
                <thead>
                  <tr>
                    <th>Type</th><th>What it is for</th><th>Amount</th>
                    <th>PayPal transaction ID</th><th>Status</th><th>Date and time</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr><td data-label="Type" colSpan={6}>No payment has been taken for this booking yet.</td></tr>
                  ) : null}
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td data-label="Type">{payment.type === 'refund' ? 'Refund' : 'Charge'}</td>
                      <td data-label="What it is for">{payment.note || (payment.type === 'refund' ? 'Refund' : 'Booking payment')}</td>
                      <td data-label="Amount">
                        {payment.type === 'refund' ? '−' : ''}{money(payment.amount)}
                      </td>
                      <td data-label="PayPal transaction ID">{payment.paypal_transaction_id ?? '—'}</td>
                      <td data-label="Status">
                        <Badge kind={payment.status === 'completed' ? 'confirmed' : payment.status === 'failed' ? 'cancelled' : 'pending'}>
                          {payment.status === 'completed' ? 'Completed' : payment.status === 'failed' ? 'Failed' : 'Waiting'}
                        </Badge>
                      </td>
                      <td data-label="Date and time">{new Date(payment.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    </tr>
                  ))}
                  {charge ? (
                    <tr>
                      <td data-label="Paid in total">Paid in total</td>
                      <td data-label="">Charged {money(charge.amount)}{refunded > 0 ? `, refunded ${money(refunded)}` : ''}</td>
                      <td data-label="">{money(paid)}</td>
                      <td data-label="" colSpan={3}>Settled through PayPal</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Panel>

          {cancelled ? (
            <Panel as="section" style={{ marginTop: 'var(--space-5)' }}>
              <div className="row row--between">
                <div>
                  <Badge kind="cancelled">Cancelled</Badge>
                  <h3 style={{ marginTop: 'var(--space-3)' }}>{data.booking_reference ?? 'This booking'}</h3>
                  <p>{formatDate(data.check_in_date)} – {formatDate(data.check_out_date)} · {roomType.data?.room_type?.name ?? '—'}</p>
                </div>
              </div>
              <p>
                {refunded > 0
                  ? `The whole amount, ${money(refunded)}, was refunded through PayPal${refunds[0]?.paypal_transaction_id ? ` — transaction ${refunds[0].paypal_transaction_id}` : ''}. Nothing further is due.`
                  : 'This booking was cancelled and nothing further is due.'}
              </p>
              <Link className="btn btn--primary btn--sm" to="/rooms">Book another room</Link>
            </Panel>
          ) : (
            <Grid columns={2} style={{ marginTop: 'var(--space-5)' }}>
              <Panel as={Link} to={`/my-bookings/${data.id}/change`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <h3>Change booking</h3>
                <p className="small muted">
                  Pick new dates or a different room type and see exactly what will be charged or refunded through
                  PayPal. This works on the check-in day itself.
                </p>
                <span className="link-arrow">Change this booking</span>
              </Panel>
              <Panel>
                <h3>Cancel booking</h3>
                <p className="small muted">
                  You get the whole amount back through PayPal whenever you cancel — today, next month, or on the arrival
                  day itself. No fee is kept back.
                </p>
                <Link className="btn btn--danger btn--sm" to={`/my-bookings/${data.id}/cancel`}>Cancel booking</Link>
              </Panel>
            </Grid>
          )}

          <p className="small muted" style={{ marginTop: 'var(--space-5)' }}>
            Questions about this stay? Call {hotel?.phone_number ?? '+353 21 477 0128'} or email{' '}
            {hotel?.email_address ?? 'stay@hotelindoora.com'} and quote {data.booking_reference ?? 'your reference'}.
          </p>
        </div>
      </section>
    </main>
  );
}
