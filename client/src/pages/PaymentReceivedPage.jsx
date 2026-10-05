import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import { useHotel } from '../hotel.jsx';
import { useToast } from '../components/ui/feedback.jsx';
import { Badge, Button, KvList, Panel, Ref, Skeleton } from '../components/index.jsx';
import { PaidSummary, PaymentLines } from '../components/paid/PaidSummary.jsx';

/**
 * Payment Received: the page a guest lands on after paying the PayPal link the
 * hotel emailed. It is the one booking page that needs no sign-in, so it shows
 * the least it can — the reference, the stay, the amount paid and what happens
 * at check-in — and never a guest's name, phone number or email.
 */
export function PaymentReceivedPage() {
  const { reference } = useParams();
  const { show } = useToast();
  const { hotel } = useHotel();
  const lookup = useAsync(() => api.bookingByReference(reference), [reference]);
  const booking = lookup.data;
  const roomType = useAsync(
    () => (booking?.room_type_id ? api.roomType(booking.room_type_id) : Promise.resolve({ room_type: null })),
    [booking?.room_type_id],
  );

  const copy = async () => {
    try { await navigator.clipboard.writeText(reference); } catch { /* the reference is on screen either way */ }
    show(`Reference ${reference} copied.`);
  };

  if (lookup.loading) {
    return (
      <main id="main">
        <div className="wrap section">
          <Panel>
            <h3>Looking up your booking</h3>
            <Skeleton variant="lg" style={{ display: 'block', width: '40%' }} />
            <Skeleton />
            <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
              Checking reference {reference} and the PayPal payment with us.
            </p>
          </Panel>
        </div>
      </main>
    );
  }

  if (lookup.failed) {
    return (
      <main id="main">
        <div className="wrap section">
          <h1>Payment received</h1>
          <div className="alert alert--error" role="alert">
            <span className="alert__icon" aria-hidden="true">!</span>
            <div className="alert__body">
              <span className="alert__title">We can't find that booking</span>
              This reference is not one of ours, or the link in the email has been cut short. Check the whole link and
              open it again.
              <div className="row" style={{ marginTop: 'var(--space-3)' }}>
                <button className="btn btn--ghost btn--sm" type="button" onClick={lookup.reload}>Try again</button>
                <Link className="btn btn--quiet btn--sm" to="/">Back to home</Link>
              </div>
              <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
                Still stuck? Call the hotel on {hotel?.phone_number ?? '+353 21 477 0128'}.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const waiting = booking.status !== 'confirmed';
  const room = roomType.data?.room_type ?? null;

  const checkIn = new Date(booking.check_in_date);
  const checkOut = new Date(booking.check_out_date);

  return (
    <main id="main">
      {waiting ? (
        <>
          <section className="hero" style={{ paddingBottom: 'var(--space-5)' }}>
            <div className="wrap">
              <p className="eyebrow">Payment not completed yet</p>
              <h1>Still waiting for payment</h1>
              <p className="lead">
                The PayPal payment for this booking has not arrived yet, so the booking is not confirmed. The room is
                still held for you and the payment link in your email is still open.
              </p>
              <Panel accent aria-label="Booking reference" style={{ marginTop: 'var(--space-5)' }}>
                <div className="row row--between">
                  <div>
                    <p className="small muted" style={{ margin: 0 }}>Booking reference</p>
                    <p style={{ margin: 0 }}><Ref>{reference}</Ref></p>
                  </div>
                  <div className="row">
                    <Badge kind="pending">Waiting for payment</Badge>
                    <Button kind="ghost" size="sm" type="button" onClick={copy}>Copy reference</Button>
                  </div>
                </div>
              </Panel>
            </div>
          </section>

          <section className="section" style={{ paddingTop: 'var(--space-5)' }}>
            <div className="wrap split">
              <Panel>
                <h2>Your stay</h2>
                <KvList rows={[
                  ['Room type', room?.name ?? '—'],
                  ['Check-in', checkIn.toDateString()],
                  ['Check-out', checkOut.toDateString()],
                  ['Nights', booking.nights],
                  ['Guests staying', booking.guests],
                  ['Total to pay', `€${Number(booking.total_price).toFixed(2)}`],
                ]} />
                <div className="row" style={{ marginTop: 'var(--space-4)' }}>
                  <button className="btn btn--ghost btn--sm" type="button" onClick={lookup.reload}>Check again</button>
                  <Link className="btn btn--quiet btn--sm" to="/">Back to home</Link>
                </div>
                <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
                  Still stuck? Call the hotel on {hotel?.phone_number ?? '+353 21 477 0128'}.
                </p>
              </Panel>
              <aside className="stack">
                <Panel>
                  <h4>Where to find us</h4>
                  <p><b>{hotel?.hotel_name ?? 'hotelIndoora'}</b></p>
                  <p>{hotel?.address ?? ''}</p>
                  <p>{hotel?.phone_number ?? ''}<br />{hotel?.email_address ?? ''}</p>
                </Panel>
              </aside>
            </div>
          </section>
        </>
      ) : (
        <>
          <PaidSummary reference={reference} booking={booking} roomType={room} onCopy={copy} />
          <div className="wrap">
            <PaymentLines booking={booking} />
          </div>

          <section className="section">
            <div className="wrap split">
              <Panel tint>
                <h4>What happens at check-in</h4>
                <ol>
                  <li>Arrive any time after {hotel?.check_in_time ?? '15:00'} on {checkIn.toDateString()} and give your booking reference <b>{reference}</b> at reception.</li>
                  <li>Nothing to pay at the desk — all {booking.nights} nights are already settled.</li>
                  <li>Breakfast is served in the courtyard from 07:30 to 10:00.</li>
                  <li>Check out by {hotel?.check_out_time ?? '11:00'} on {checkOut.toDateString()} and hand the key card back at reception.</li>
                </ol>
              </Panel>
              <aside className="stack">
                <Panel>
                  <h4>Where to find us</h4>
                  <p><b>{hotel?.hotel_name ?? 'hotelIndoora'}</b></p>
                  <p>{hotel?.address ?? ''}</p>
                  <p>{hotel?.phone_number ?? ''}<br />{hotel?.email_address ?? ''}</p>
                  <div className="mini-map">The gate is the deep-green one opposite the old net store. There is a loading bay outside for dropping bags.</div>
                </Panel>
                <Panel tint>
                  <h4>Your times</h4>
                  <KvList rows={[['Check-in from', hotel?.check_in_time ?? '15:00'], ['Check-out by', hotel?.check_out_time ?? '11:00']]} />
                  <p className="small muted">{hotel?.house_rules}</p>
                </Panel>
                <div className="row">
                  <Link className="btn btn--primary btn--sm" to="/rooms">Book another stay</Link>
                  <Link className="btn btn--ghost btn--sm" to="/">Back to home</Link>
                </div>
                <p className="small muted">Already have an account? <Link to="/login">Sign in</Link> to keep every stay in one place.</p>
              </aside>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
