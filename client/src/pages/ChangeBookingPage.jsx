import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, formatDate, money, nightsBetween } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import { Alert, Badge, Button, LoadingBlock, Panel, Ref, Stat, Stats } from '../components/index.jsx';
import { RoomTypeChooser } from '../components/bookings/RoomTypeChooser.jsx';
import { NewStaySummary } from '../components/bookings/NewStaySummary.jsx';
import { DifferencePanel } from '../components/bookings/DifferencePanel.jsx';

/**
 * Change Booking: pick new dates or a different room type and see exactly what
 * will be charged or refunded through PayPal before anything is settled.
 *
 * The room types free for the new dates come from the same availability the
 * search uses, the figure beside them is the difference against what the guest
 * has already paid, and the booking only moves once the settlement is under way —
 * a refusal from PayPal leaves the stay exactly as it was. A larger difference is
 * approved at PayPal and collected when the guest comes back; a smaller one is
 * refunded at once. This works on the check-in day itself.
 */
export function ChangeBookingPage() {
  const { bookingId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const booking = useAsync(() => api.booking(bookingId), [bookingId]);
  const roomTypes = useAsync(() => api.roomTypes(), []);
  const data = booking.data?.booking ?? null;

  const [dates, setDates] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [state, setState] = useState({ status: 'idle', message: null });
  const captured = useRef(false);

  // A week on from the dates they hold, for the same number of nights: a real
  // starting point the guest can change at once.
  useEffect(() => {
    if (!data || dates) return;
    const shift = 7 * 86400000;
    setDates({
      checkIn: new Date(new Date(data.check_in_date).getTime() + shift).toISOString().slice(0, 10),
      checkOut: new Date(new Date(data.check_out_date).getTime() + shift).toISOString().slice(0, 10),
    });
    setSelectedId(String(data.room_type_id));
  }, [data, dates]);

  const availability = useAsync(
    () => (data && dates
      ? api.availability({ checkIn: dates.checkIn, checkOut: dates.checkOut, guests: data.guest_count })
      : Promise.resolve({ room_types: [] })),
    [data?.id, dates?.checkIn, dates?.checkOut],
  );

  // Coming back from PayPal with an approved difference: collect it, then move on.
  const returnedOrder = searchParams.get('token');
  const collect = async (orderId) => {
    captured.current = true;
    setState({ status: 'capturing', message: null });
    try {
      const payload = await api.captureChange(bookingId, orderId);
      setState({
        status: 'changed',
        message: null,
        nights: payload.booking?.nights ?? data?.nights,
        guests: payload.booking?.guest_count ?? data?.guest_count,
        difference: {
          direction: 'charge',
          amount: payload.settlement?.amount ?? 0,
          pending: payload.settlement?.status === 'pending',
        },
        approveUrl: payload.settlement?.approve_url ?? null,
      });
      setSearchParams({}, { replace: true });
      booking.reload();
    } catch (error) {
      setState({ status: 'paypal_failed', message: error.message, retryToken: orderId });
    }
  };

  useEffect(() => {
    if (!returnedOrder || !data || captured.current) return;
    collect(returnedOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnedOrder, data?.id]);

  if (booking.loading) {
    return <main id="main"><div className="wrap section"><LoadingBlock label="Loading your booking…" lines={3} /></div></main>;
  }

  if (booking.failed || !data) {
    return (
      <main id="main">
        <div className="wrap section">
          <h1>Change booking</h1>
          <Alert kind="error" title={booking.error?.status === 404 ? "We can't show this booking" : 'We could not load this booking'}>
            {booking.error?.status === 404
              ? 'This booking does not belong to your account, so it cannot be changed here.'
              : `${booking.error?.message} — nothing has changed on your stay.`}
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
  // What has actually moved: every completed charge less every completed refund.
  const paid = payments.filter((payment) => payment.status === 'completed')
    .reduce((sum, payment) => sum + (payment.type === 'refund' ? -Number(payment.amount) : Number(payment.amount)), 0);
  // A difference the guest has not approved at PayPal yet.
  const outstanding = payments.find((payment) => payment.type === 'charge' && payment.status === 'pending' && payment.approve_url) ?? null;

  const nights = dates ? nightsBetween(dates.checkIn, dates.checkOut) : 0;
  const rows = availability.data?.room_types ?? [];
  const onSale = roomTypes.data?.room_types ?? [];
  const chosenRow = rows.find((row) => String(row.room_type_id ?? row.id) === String(selectedId))
    ?? onSale.find((roomType) => String(roomType.id) === String(selectedId));
  const chosenRoomType = onSale.find((roomType) => String(roomType.id) === String(selectedId))
    ?? (chosenRow ? { ...chosenRow, id: String(chosenRow.room_type_id ?? chosenRow.id) } : null);
  const newTotal = chosenRow ? Number(chosenRow.total ?? Number(chosenRow.nightly_rate) * nights) : 0;
  const delta = Number((newTotal - paid).toFixed(2));
  const difference = delta > 0
    ? { direction: 'charge', amount: delta }
    : delta < 0
      ? { direction: 'refund', amount: Math.abs(delta) }
      : { direction: 'none', amount: 0 };

  const confirm = async () => {
    setState({ status: 'working', message: null });
    try {
      const payload = await api.changeBooking(bookingId, {
        check_in_date: dates.checkIn,
        check_out_date: dates.checkOut,
        room_type_id: selectedId,
      });
      const settlement = payload.settlement ?? difference;
      setState({
        status: settlement.approve_url ? 'changed_pending' : 'changed',
        message: null,
        nights: payload.booking?.nights ?? nights,
        guests: payload.booking?.guest_count ?? data.guest_count,
        difference: { ...settlement, pending: Boolean(settlement.approve_url) },
        approveUrl: settlement.approve_url ?? null,
      });
      booking.reload();
      if (settlement.approve_url) {
        // Hand the guest to PayPal to approve the difference; they come back here
        // and it is collected on arrival.
        window.location.assign(settlement.approve_url);
      }
    } catch (error) {
      const code = error.code ?? 'failed';
      if (code === 'no_room_free') {
        setState({ status: 'not_free', message: error.message });
      } else if (error.status === 400) {
        setState({ status: 'refused_date', message: Object.values(error.errors ?? {}).join(' ') || error.message });
      } else if (code === 'cancelled') {
        setState({ status: 'refused_date', message: 'That booking is cancelled, so it cannot be moved.' });
      } else {
        setState({ status: 'paypal_failed', message: error.message });
      }
    }
  };

  const retry = () => (state.retryToken ? collect(state.retryToken) : confirm());
  const currentRoomType = onSale.find((roomType) => String(roomType.id) === String(data.room_type_id));

  return (
    <main id="main">
      <div className="wrap page-head">
        <p><Link className="link-arrow" to={`/my-bookings/${data.id}`} style={{ textDecoration: 'none' }}>← Back to booking</Link></p>
        <div className="page-head__grid">
          <div>
            <h1>Change booking</h1>
            <p className="lead">Pick new dates or another room type and we will check it is free before anything is settled.</p>
          </div>
          <div className="row">
            <Ref>{data.booking_reference ?? 'Not issued yet'}</Ref>
            <Badge kind={data.status === 'confirmed' ? 'confirmed' : 'pending'}>
              {data.status === 'confirmed' ? 'Confirmed' : 'Waiting for payment'}
            </Badge>
          </div>
        </div>
      </div>

      <section className="section" style={{ paddingTop: 'var(--space-3)' }}>
        <div className="wrap">
          <Stats>
            <Stat label="Room type now" value={<span style={{ fontSize: 'var(--text-md)' }}>{currentRoomType?.name ?? '—'}</span>} />
            <Stat
              label="Dates now"
              value={<span style={{ fontSize: 'var(--text-md)' }}>{formatDate(data.check_in_date).slice(4)} – {formatDate(data.check_out_date).slice(4)}</span>}
              foot={`${data.nights} nights`}
            />
            <Stat label="Guests" value={data.guest_count} foot={`arriving ${data.expected_arrival_time}`} />
            <Stat accent label="Paid through PayPal" value={money(paid)} />
          </Stats>

          <div className="split" style={{ marginTop: 'var(--space-6)' }}>
            <div>
              <Panel as="section" aria-labelledby="new-stay-title">
                <h2 id="new-stay-title">Choose your new stay</h2>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    availability.reload();
                  }}
                >
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="new-checkin">New check-in date</label>
                      <input
                        type="date"
                        id="new-checkin"
                        value={dates?.checkIn ?? ''}
                        onChange={(event) => {
                          setDates((current) => ({ ...current, checkIn: event.target.value }));
                          setState({ status: 'idle', message: null });
                        }}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="new-checkout">New check-out date</label>
                      <input
                        type="date"
                        id="new-checkout"
                        value={dates?.checkOut ?? ''}
                        onChange={(event) => {
                          setDates((current) => ({ ...current, checkOut: event.target.value }));
                          setState({ status: 'idle', message: null });
                        }}
                      />
                    </div>
                  </div>
                  <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
                    {formatDate(dates?.checkIn)} to {formatDate(dates?.checkOut)} · {nights} nights · {data.guest_count} guests staying.
                  </p>
                  <Button kind="ghost" size="sm" type="submit" disabled={availability.loading}>
                    {availability.loading ? 'Checking availability…' : 'Check availability'}
                  </Button>

                  <div className="section__head" style={{ marginTop: 'var(--space-5)' }}>
                    <div>
                      <h3>Room types free for {formatDate(dates?.checkIn)} to {formatDate(dates?.checkOut)}</h3>
                      <p>One room of one room type per booking.</p>
                    </div>
                    <span className="chip">{data.guest_count} guests staying</span>
                  </div>

                  {availability.failed ? (
                    <Alert kind="error" title="We could not check what is free">
                      {availability.error.message} — your booking is untouched.
                      <div className="row" style={{ marginTop: 'var(--space-3)' }}>
                        <Button kind="ghost" size="sm" type="button" onClick={availability.reload}>Try again</Button>
                      </div>
                    </Alert>
                  ) : null}

                  <RoomTypeChooser
                    roomTypes={rows}
                    allRoomTypes={onSale}
                    selectedId={selectedId}
                    onSelect={(id) => setSelectedId(id)}
                    nights={nights}
                    guests={data.guest_count}
                    currentRoomTypeId={String(data.room_type_id)}
                    loading={availability.loading || roomTypes.loading}
                  />

                  {chosenRow ? (
                    <Alert kind="success" title={`${chosenRoomType?.name ?? 'That room type'} is free for your new dates`} style={{ marginTop: 'var(--space-4)' }}>
                      {chosenRow.free_rooms === 1 ? '1 room is' : `${chosenRow.free_rooms} rooms are`} free for all {nights}{' '}
                      nights, {formatDate(dates?.checkIn)} to {formatDate(dates?.checkOut)}.
                    </Alert>
                  ) : null}
                </form>
              </Panel>

              <DifferencePanel
                state={state}
                bookingId={data.id}
                onRetry={retry}
                roomType={chosenRoomType}
                dates={`${formatDate(dates?.checkIn)} to ${formatDate(dates?.checkOut)}`}
                outstanding={outstanding}
              />
            </div>

            <NewStaySummary
              roomType={chosenRoomType}
              checkIn={formatDate(dates?.checkIn)}
              checkOut={formatDate(dates?.checkOut)}
              nights={nights}
              guests={data.guest_count}
              newTotal={newTotal}
              alreadyPaid={paid}
              difference={difference}
              onConfirm={confirm}
              confirming={state.status === 'working'}
              bookingId={data.id}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
