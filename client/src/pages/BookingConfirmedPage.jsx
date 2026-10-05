import { Link, useParams } from 'react-router-dom';
import { api, formatDate } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import { useHotel } from '../hotel.jsx';
import { useToast } from '../components/ui/feedback.jsx';
import { Badge, Button, KvList, LoadingBlock, Panel, Ref, Skeleton } from '../components/index.jsx';

/**
 * Booking Confirmed: the booking the moment its payment succeeds, with the
 * reference to quote, the stay, every payment against it and what happens at
 * check-in. It is a guest's own page, so it is found by reference only for the
 * account that made it.
 */
export function BookingConfirmedPage() {
  const { reference } = useParams();
  const { show } = useToast();
  const { hotel } = useHotel();
  const booking = useAsync(() => api.ownBookingByReference(reference), [reference]);
  const data = booking.data?.booking ?? null;
  const roomType = useAsync(
    () => (data?.room_type_id ? api.roomType(data.room_type_id) : Promise.resolve({ room_type: null })),
    [data?.room_type_id],
  );

  const copy = async () => {
    try { await navigator.clipboard.writeText(reference); } catch { /* the reference is on screen */ }
    show(`Reference ${reference} copied.`);
  };

  if (booking.loading) {
    return (
      <main id="main">
        <div className="wrap section">
          <Panel>
            <h2>Confirming your payment with PayPal</h2>
            <p className="small muted">This usually takes a few seconds. Please keep this page open until your confirmation appears.</p>
            <Skeleton variant="lg" style={{ display: 'block', width: '35%' }} />
            <Skeleton />
          </Panel>
        </div>
      </main>
    );
  }

  if (booking.failed || !data) {
    return (
      <main id="main">
        <div className="wrap section">
          <h1>Your booking</h1>
          <div className="alert alert--error" role="alert">
            <span className="alert__icon" aria-hidden="true">!</span>
            <div className="alert__body">
              <span className="alert__title">
                {booking.error?.status === 404 ? 'We can\'t show this booking' : 'We could not confirm your payment'}
              </span>
              {booking.error?.status === 404
                ? 'This booking does not belong to your account. Open your own bookings, or sign in with the account that made it.'
                : `${booking.error?.message} — nothing is taken twice. If PayPal shows a charge for ${reference}, it belongs to this booking and will not be repeated.`}
              <div className="row" style={{ marginTop: 'var(--space-3)' }}>
                <button className="btn btn--ghost btn--sm" type="button" onClick={booking.reload}>Check again</button>
                <Link className="btn btn--primary btn--sm" to="/my-bookings">My Bookings</Link>
                <Link className="btn btn--quiet btn--sm" to="/">Back to Home</Link>
              </div>
              <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
                If it still does not confirm, call {hotel?.phone_number ?? '+353 21 477 0128'} or email{' '}
                {hotel?.email_address ?? 'stay@hotelindoora.com'} and quote {reference}.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const room = roomType.data?.room_type ?? null;
  const charge = data.payments?.find((payment) => payment.type === 'charge');
  const refunds = (data.payments ?? []).filter((payment) => payment.type === 'refund');
  const refunded = refunds.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const paid = charge ? Number(charge.amount) - refunded : Number(data.total_price);

  return (
    <main id="main">
      <section className="hero" style={{ paddingBottom: 'var(--space-5)' }}>
        <div className="wrap">
          <div className="row" style={{ gap: 'var(--space-4)' }}>
            <span
              className="stat--accent"
              style={{ width: 56, height: 56, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 'var(--text-xl)', color: 'var(--color-success)' }}
              aria-hidden="true"
            >
              ✓
            </span>
            <div>
              <h1>Your stay is booked</h1>
              <p className="lead" style={{ margin: 0 }}>
                Your payment went through and the room is yours — nothing more is due. We have emailed these details and
                your reference to {data.guest_email}.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 'var(--space-5)' }}>
        <div className="wrap">
          <Panel accent>
            <div className="row row--between">
              <div>
                <h4 style={{ marginBottom: 'var(--space-1)' }}>Booking reference</h4>
                <p style={{ margin: 0 }}><Ref style={{ fontSize: 'var(--text-lg)' }}>{data.booking_reference}</Ref></p>
                <p className="small muted" style={{ margin: 'var(--space-2) 0 0' }}>
                  Quote this reference when you call the hotel, email us, or arrive at reception.
                </p>
              </div>
              <div className="row">
                <Badge kind="confirmed">Confirmed</Badge>
                <Button kind="ghost" size="sm" type="button" onClick={copy}>Copy reference</Button>
              </div>
            </div>
          </Panel>

          <div className="split" style={{ marginTop: 'var(--space-6)' }}>
            <Panel as="section" aria-labelledby="stay-title">
              <h2 id="stay-title">Your stay</h2>
              <KvList rows={[
                ['Room type', room?.name ?? '—'],
                ['Check-in', `${formatDate(data.check_in_date)}, from 15:00`],
                ['Check-out', `${formatDate(data.check_out_date)}, by 11:00`],
                ['Nights', data.nights],
                ['Guests', data.guest_count],
                ['Expected arrival time', data.expected_arrival_time],
                ['Special requests', data.special_requests || '—'],
              ]} />

              <h2 style={{ marginTop: 'var(--space-5)' }}>Total paid</h2>
              <p className="price" style={{ margin: 0 }}>€{paid.toFixed(2)}</p>
              <p className="small muted">
                €{Number(data.nightly_rate).toFixed(2)} per night × {data.nights} nights. Nothing added at checkout.
              </p>
              <div className="table-wrap">
                <table className="receipt">
                  <thead><tr><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    <tr>
                      <td>Charge</td>
                      <td>€{Number(charge?.amount ?? data.total_price).toFixed(2)}</td>
                      <td><Badge kind={charge?.status === 'completed' ? 'confirmed' : 'pending'}>{charge?.status === 'completed' ? 'Completed' : 'Waiting'}</Badge></td>
                    </tr>
                    {refunds.map((refund) => (
                      <tr key={refund.id}>
                        <td>Refund</td>
                        <td>−€{Number(refund.amount).toFixed(2)}</td>
                        <td><Badge kind={refund.status === 'completed' ? 'confirmed' : 'pending'}>{refund.status === 'completed' ? 'Completed' : 'Waiting'}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {charge?.paypal_transaction_id ? (
                <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
                  PayPal transaction ID {charge.paypal_transaction_id}
                  {charge.created_at ? ` · ${new Date(charge.created_at).toDateString()}` : ''}
                </p>
              ) : null}

              <div className="row" style={{ marginTop: 'var(--space-5)' }}>
                <Link className="btn btn--primary" to="/my-bookings">My Bookings</Link>
                <Link className="btn btn--ghost" to="/rooms">Book another room</Link>
                <Link className="btn btn--quiet" to="/">Back to Home</Link>
              </div>
            </Panel>

            <aside className="stack">
              <Panel tint>
                <h4>{hotel?.hotel_name ?? 'hotelIndoora'}</h4>
                <p>{hotel?.address ?? ''}</p>
                <p>{hotel?.phone_number ?? ''} · {hotel?.email_address ?? ''}</p>
                <p>Check-in from {hotel?.check_in_time ?? '15:00'} · Check-out by {hotel?.check_out_time ?? '11:00'}</p>
                <p className="small muted">{hotel?.house_rules}</p>
              </Panel>

              <Panel>
                <h4>What happens at check-in</h4>
                <ol>
                  <li>Come to reception any time from {hotel?.check_in_time ?? '15:00'} and give the reference <b>{data.booking_reference}</b>.</li>
                  <li>Show photo ID in the name of the lead guest, {data.lead_guest_name}.</li>
                  <li>Pay nothing on arrival — the full amount is already paid.</li>
                  <li>Breakfast is in the courtyard between 07:30 and 10:00.</li>
                  <li>Leave your key at reception by {hotel?.check_out_time ?? '11:00'} on {formatDate(data.check_out_date)}.</li>
                </ol>
              </Panel>

              <Panel>
                <h4>Change or cancel later</h4>
                <p className="small muted">
                  You can move this stay to other dates or another room type yourself, with any difference charged or
                  refunded through PayPal, or cancel it and have the whole amount refunded — arrival day included.
                </p>
                <Link className="btn btn--ghost btn--sm" to={`/my-bookings/${data.id}`}>Open this booking</Link>
              </Panel>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
