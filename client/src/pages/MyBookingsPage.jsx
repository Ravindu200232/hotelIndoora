import { Link, useLocation } from 'react-router-dom';
import { api, formatRange, money } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import { useSession } from '../session.jsx';
import { Alert, Badge, Card, CardBody, CardFoot, Grid, Skeleton, Stats, Stat, TableWrap, Table, Caption, Thead, Tbody, Tr, Th, Td, CellMain, CellSub, Ref } from '../components/index.jsx';

/**
 * My Bookings: a guest's own home — every stay they hold, upcoming and past,
 * with its dates, room type, status and total, and the few figures that matter
 * at a glance.
 *
 * Only their own bookings are ever here: the server scopes every query to the
 * signed-in account.
 */
export function MyBookingsPage() {
  const { account } = useSession();
  const location = useLocation();
  const bookings = useAsync(() => api.myBookings(), []);
  const roomTypes = useAsync(() => api.roomTypes(), []);

  const names = new Map((roomTypes.data?.room_types ?? []).map((roomType) => [roomType.id, roomType.name]));
  const nameOf = (booking) => names.get(String(booking.room_type_id)) ?? 'Room type';

  const upcoming = bookings.data?.upcoming ?? [];
  const past = bookings.data?.past ?? [];
  const waiting = upcoming.filter((booking) => booking.status === 'pending_payment');
  const next = [...upcoming].sort((a, b) => new Date(a.check_in_date) - new Date(b.check_in_date))[0];
  const lastPast = past[0];
  const refund = location.state?.refund;

  if (bookings.loading) {
    return (
      <main id="main">
        <div className="wrap section">
          <div className="panel" aria-busy="true">
            <p className="small muted" style={{ margin: 0 }}>Loading your bookings…</p>
            <div className="grid grid--3" style={{ marginTop: 'var(--space-3)' }}>
              <Skeleton variant="card" />
              <Skeleton variant="card" />
              <Skeleton variant="card" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (bookings.failed) {
    return (
      <main id="main">
        <div className="wrap section">
          <h1>My bookings</h1>
          <Alert kind="error" title="Your bookings could not be loaded">
            {bookings.error.message} — we could not reach your bookings just now.
            <div className="row" style={{ marginTop: 'var(--space-3)' }}>
              <button className="btn btn--ghost btn--sm" type="button" onClick={bookings.reload}>Try again</button>
            </div>
          </Alert>
        </div>
      </main>
    );
  }

  return (
    <main id="main">
      <div className="wrap page-head">
        <div className="page-head__grid">
          <div>
            <h1>My bookings</h1>
            <p className="lead">Welcome back, {account?.full_name} — every stay you have booked with us, upcoming and past.</p>
          </div>
          <div className="row">
            <Link className="btn btn--primary btn--sm" to="/rooms">Browse rooms</Link>
            <Link className="btn btn--ghost btn--sm" to="/">Book a room</Link>
          </div>
        </div>
      </div>

      <section className="section" style={{ paddingTop: 'var(--space-4)' }}>
        <div className="wrap">
          {refund ? (
            <Alert kind="success" title="Refund sent">
              Booking {refund.reference} was cancelled{refund.onArrivalDay ? ' on the arrival day' : ''} and{' '}
              {money(refund.amount)} is on its way back to your PayPal account. The refund now shows against that stay
              below.
            </Alert>
          ) : null}

          <Stats>
            <Stat
              accent
              label="Upcoming stays"
              value={upcoming.length}
              foot={next ? `Next check-in ${formatRange(next.check_in_date, next.check_out_date)}` : 'Nothing booked yet'}
            />
            <Stat
              label="Next check-in"
              value={<span style={{ fontSize: 'var(--text-lg)' }}>{next ? new Date(next.check_in_date).toDateString().slice(0, 10) : '—'}</span>}
              foot={next ? `${nameOf(next)} · ${next.nights} nights` : 'Book a room to see it here'}
            />
            <Stat
              label="Waiting for payment"
              value={waiting.length}
              foot={waiting[0] ? `${nameOf(waiting[0])} · ${money(waiting[0].total_price)}` : 'All settled'}
            />
            <Stat
              label="Past stays"
              value={past.length}
              foot={lastPast ? `Last ended ${new Date(lastPast.check_out_date).toDateString()}` : 'No past stays yet'}
            />
          </Stats>

          <section aria-labelledby="upcoming-title" style={{ marginTop: 'var(--space-6)' }}>
            <div className="section__head">
              <div>
                <h2 id="upcoming-title">Upcoming stays</h2>
                <p>Check-in today or later.</p>
              </div>
            </div>

            {upcoming.length === 0 ? null : (
              <Grid columns={3}>
                {upcoming.map((booking) => (
                  <Card as={Link} to={`/my-bookings/${booking.id}`} key={booking.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <CardBody>
                      <p className="small muted" style={{ margin: 0 }}>
                        {formatRange(booking.check_in_date, booking.check_out_date)} · {booking.nights} nights
                      </p>
                      <h3 className="card__title" style={{ marginTop: 'var(--space-2)' }}>{nameOf(booking)}</h3>
                      <p className="small muted">
                        <Ref>{booking.booking_reference ?? 'Not issued yet'}</Ref> {booking.guest_count} guests · booked{' '}
                        {new Date(booking.booked_at).toDateString()}
                      </p>
                      <div className="row row--between" style={{ marginTop: 'var(--space-4)' }}>
                        <Badge kind={booking.status === 'confirmed' ? 'confirmed' : 'pending'}>
                          {booking.status === 'confirmed' ? 'Confirmed' : 'Waiting for payment'}
                        </Badge>
                        <span className="price" style={{ fontSize: 'var(--text-md)' }}>{money(booking.total_price)}</span>
                      </div>
                    </CardBody>
                    <CardFoot><span className="link-arrow">Open booking</span></CardFoot>
                  </Card>
                ))}
              </Grid>
            )}
          </section>

          <section aria-labelledby="past-title" style={{ marginTop: 'var(--space-6)' }}>
            <div className="section__head">
              <div>
                <h2 id="past-title">Past stays</h2>
                <p>Stays that have already ended.</p>
              </div>
            </div>

            {past.length === 0 ? null : (
              <TableWrap>
                <Table>
                  <Caption>Every past stay, with its status and what it cost.</Caption>
                  <Thead columns={['Dates', 'Room type', 'Status', 'Total', '']} />
                  <Tbody>
                    {past.map((booking) => {
                      const refundPaid = (booking.payments ?? [])
                        .filter((payment) => payment.type === 'refund')
                        .reduce((sum, payment) => sum + Number(payment.amount), 0);
                      const charge = (booking.payments ?? []).find((payment) => payment.type === 'charge');
                      return (
                        <Tr key={booking.id}>
                          <Td label="Dates">
                            <CellMain>{formatRange(booking.check_in_date, booking.check_out_date)}</CellMain>
                            <CellSub>{booking.nights} nights</CellSub>
                          </Td>
                          <Td label="Room type">
                            <CellMain>{nameOf(booking)}</CellMain>
                            <CellSub><Ref>{booking.booking_reference ?? '—'}</Ref> · {booking.guest_count} guests</CellSub>
                          </Td>
                          <Td label="Status">
                            <Badge kind={booking.status === 'cancelled' ? 'cancelled' : 'confirmed'}>
                              {booking.status === 'cancelled' ? 'Cancelled' : 'Confirmed'}
                            </Badge>{' '}
                            <CellSub>
                              {refundPaid > 0
                                ? `${money(refundPaid)} refunded`
                                : charge?.created_at
                                  ? `Paid ${new Date(charge.created_at).toDateString()}`
                                  : '—'}
                            </CellSub>
                          </Td>
                          <Td label="Total">{money(booking.total_price)}</Td>
                          <Td label="">
                            <Link className="link-arrow" to={`/my-bookings/${booking.id}`}>Open booking</Link>
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              </TableWrap>
            )}
          </section>

          {upcoming.length === 0 && past.length === 0 ? (
            <div className="empty" style={{ marginTop: 'var(--space-5)' }}>
              <h3>No stays booked yet</h3>
              <p>When you book a room, it will appear here with its dates, room type, status and total.</p>
              <Link className="btn btn--primary" to="/">Book a room</Link>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
