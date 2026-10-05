import { Badge, Button, Img, KvList, Panel } from '../index.jsx';
import { photoAt } from '../ui/media.jsx';

/**
 * A booking that is confirmed and paid: the reference to quote at reception,
 * and the stay as the hotel holds it.
 */
export function PaidSummary({ reference, booking, roomType, onCopy }) {
  const rate = booking.nights ? Number((booking.total_price / booking.nights).toFixed(2)) : booking.total_price;
  return (
    <>
      <section className="hero" style={{ paddingBottom: 'var(--space-5)' }}>
        <div className="wrap">
          <p className="eyebrow">Payment received</p>
          <h1>Your booking is confirmed</h1>
          <p className="lead">
            hotelIndoora booked this stay for you and your PayPal payment has come through. All {booking.nights} nights
            are confirmed and paid in full — there is nothing to pay at the desk.
          </p>

          <Panel accent aria-label="Booking reference" style={{ marginTop: 'var(--space-5)' }}>
            <div className="row row--between">
              <div>
                <p className="small muted" style={{ margin: 0 }}>Booking reference</p>
                <p style={{ margin: 0 }}><span className="ref" style={{ fontSize: 'var(--text-lg)' }}>{reference}</span></p>
                <p className="small muted" style={{ margin: 'var(--space-2) 0 0' }}>
                  Give this reference at reception and in any message to the hotel.
                </p>
              </div>
              <div className="row">
                <Badge kind="confirmed">Confirmed</Badge>
                <Badge kind="sale">Paid in full</Badge>
                <Button kind="ghost" size="sm" type="button" onClick={() => onCopy?.(reference)}>Copy reference</Button>
              </div>
            </div>
          </Panel>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 'var(--space-5)' }} aria-labelledby="stay-title">
        <div className="wrap split">
          <Panel as="section" aria-label="Your stay">
            <h2 id="stay-title">Your stay</h2>
            {roomType?.photos?.[0] ? (
              <Img
                src={photoAt(roomType.photos[0], 1000)}
                alt={`${roomType.name}: a room at hotelIndoora`}
                width={1000}
                height={640}
                style={{ borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}
              />
            ) : null}
            <KvList rows={[
              ['Room type', roomType?.name ?? '—'],
              ['Check-in', `${new Date(booking.check_in_date).toDateString()} · from 15:00`],
              ['Check-out', `${new Date(booking.check_out_date).toDateString()} · by 11:00`],
              ['Nights', booking.nights],
              ['Guests staying', booking.guests],
              ['Booked by', 'hotelIndoora for you'],
            ]} />
            <p className="visually-hidden">{`Nightly rate ${rate}`}</p>
          </Panel>
        </div>
      </section>
    </>
  );
}

/**
 * The receipt: the nightly rate for every night, with nothing added, and what
 * PayPal took. The transaction is PayPal's own record; nothing about the guest
 * is shown on this page, because a reference is all it takes to open it.
 */
export function PaymentLines({ booking }) {
  const rate = booking.nights ? Number((booking.total_price / booking.nights).toFixed(2)) : Number(booking.total_price);
  const added = 0;
  const paidOn = booking.paid_on ? new Date(booking.paid_on) : null;
  return (
    <>
      <h3 style={{ marginTop: 'var(--space-5)' }}>Amount paid</h3>
      <div className="table-wrap">
        <table className="receipt">
          <caption>The nightly rate for every night, with nothing added.</caption>
          <tbody>
            <tr><td>{booking.nights} nights at €{rate.toFixed(2)}</td><td>€{Number(booking.total_price).toFixed(2)}</td></tr>
            <tr><td>Added at checkout</td><td>€{added.toFixed(2)}</td></tr>
            <tr><td>Payment type</td><td>{booking.payment_type === 'charge' ? 'Charge' : '—'}</td></tr>
            <tr>
              <td>Payment status</td>
              <td>
                <Badge kind={booking.payment_status === 'completed' ? 'confirmed' : 'pending'}>
                  {booking.payment_status === 'completed' ? 'Completed' : 'Waiting for payment'}
                </Badge>
              </td>
            </tr>
            {paidOn ? (
              <tr>
                <td>Paid on</td>
                <td>{paidOn.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, {paidOn.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr><td>Total paid</td><td>€{Number(booking.paid ?? booking.total_price).toFixed(2)}</td></tr>
          </tfoot>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
        PayPal was the only payment taken. The hotel holds no card or bank details, and the confirmation — with the
        PayPal transaction details — is in the email the hotel sent you.
      </p>
    </>
  );
}
