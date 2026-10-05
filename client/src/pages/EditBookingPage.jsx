import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatDate, formatRange, money } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import { Alert, Button, LoadingBlock, Panel, SectionHead, Stat, Stats, Topbar } from '../components/index.jsx';
import { AvailabilityChooser } from '../components/staff/AvailabilityChooser.jsx';
import { ChangeCostPanel } from '../components/staff/ChangeCostPanel.jsx';

/**
 * Edit Booking: moving a stay to other dates or another room type for the guest.
 *
 * The desk picks the dates, sees exactly which room types are free for them with
 * the rate and the total, and is told what the move settles through PayPal before
 * anything happens: the new total less what the guest has already paid. A dearer
 * stay needs the guest's approval at PayPal, so the link for the difference is
 * emailed from here; a cheaper one is refunded in full with no fee kept back. A
 * move on the arrival day itself is allowed, and nothing changes until Confirm.
 */
export function EditBookingPage() {
  const { bookingId } = useParams();
  const booking = useAsync(() => api.staffBooking(bookingId), [bookingId]);
  const roomTypes = useAsync(() => api.staffRoomTypes(), []);
  const data = booking.data?.booking ?? null;

  const [dates, setDates] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [state, setState] = useState({ status: 'idle', message: null });
  const [link, setLink] = useState({ sending: false, sent: false });

  // The stay as it stands, so the desk starts from the truth.
  useEffect(() => {
    if (!data || dates) return;
    setDates({
      checkIn: String(data.check_in_date).slice(0, 10),
      checkOut: String(data.check_out_date).slice(0, 10),
    });
    setSelectedId(String(data.room_type_id));
  }, [data, dates]);

  const availability = useAsync(
    () => (data && dates
      ? api.availability({ checkIn: dates.checkIn, checkOut: dates.checkOut, guests: data.guest_count })
      : Promise.resolve({ room_types: [] })),
    [data?.id, dates?.checkIn, dates?.checkOut],
  );

  // What is free on the dates the booking already holds, for the figures above.
  const nowAvailability = useAsync(
    () => (data
      ? api.availability({
        checkIn: String(data.check_in_date).slice(0, 10),
        checkOut: String(data.check_out_date).slice(0, 10),
        guests: data.guest_count,
      })
      : Promise.resolve({ room_types: [] })),
    [data?.id],
  );

  const namesById = useMemo(() => {
    const map = new Map();
    for (const roomType of roomTypes.data?.room_types ?? []) map.set(String(roomType.id), roomType);
    return map;
  }, [roomTypes.data]);

  if (booking.loading) {
    return (
      <>
        <p><Link className="link-arrow" to="/staff/bookings" style={{ textDecoration: 'none' }}>← Bookings</Link></p>
        <Topbar title="Edit booking" note="Loading this booking…" />
        <LoadingBlock label="Loading this booking…" lines={4} />
      </>
    );
  }

  if (booking.failed || !data) {
    return (
      <>
        <p><Link className="link-arrow" to="/staff/bookings" style={{ textDecoration: 'none' }}>← Bookings</Link></p>
        <Topbar title="Edit booking" note="Nothing has been changed." />
        <Alert kind="error" title="This booking could not be loaded">
          {booking.error?.status === 404
            ? 'That booking is not one of ours. Open it from the Bookings page instead.'
            : `${booking.error.message} — nothing has been changed.`}
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Button kind="primary" size="sm" type="button" onClick={booking.reload}>Try again</Button>
            <Link className="btn btn--ghost btn--sm" to="/staff/bookings">Back to Bookings</Link>
          </div>
        </Alert>
      </>
    );
  }

  const payments = data.payments ?? [];
  const paid = payments
    .filter((payment) => payment.status === 'completed')
    .reduce((sum, payment) => sum + (payment.type === 'refund' ? -Number(payment.amount) : Number(payment.amount)), 0);
  const currentRoomType = namesById.get(String(data.room_type_id));
  const nowRow = (nowAvailability.data?.room_types ?? []).find((row) => String(row.room_type_id) === String(data.room_type_id));

  const nights = dates ? Math.max(0, Math.round((new Date(`${dates.checkOut}T00:00:00.000Z`) - new Date(`${dates.checkIn}T00:00:00.000Z`)) / 86400000)) : 0;
  const freeRows = availability.data?.room_types ?? [];
  const chosenRow = freeRows.find((row) => String(row.room_type_id) === String(selectedId));
  const chosenRoomType = namesById.get(String(selectedId));
  const newTotal = chosenRow ? Number(chosenRow.total) : 0;
  const delta = Number((newTotal - paid).toFixed(2));
  const difference = delta > 0
    ? { direction: 'charge', amount: delta, rate: chosenRow?.nightly_rate }
    : delta < 0
      ? { direction: 'refund', amount: Math.abs(delta), rate: chosenRow?.nightly_rate }
      : { direction: 'none', amount: 0, rate: chosenRow?.nightly_rate };

  const cancelled = data.status === 'cancelled';
  const unpaid = data.status === 'pending_payment';
  const canConfirm = !cancelled && !unpaid && Boolean(chosenRow) && nights > 0;

  const confirm = async () => {
    setState({ status: 'working', message: null });
    setLink({ sending: false, sent: false });
    try {
      const payload = await api.staffChangeBooking(bookingId, {
        check_in_date: dates.checkIn,
        check_out_date: dates.checkOut,
        room_type_id: selectedId,
      });
      const settled = payload.settlement ?? difference;
      setState({
        status: 'done',
        message: null,
        nights,
        checkIn: dates.checkIn,
        checkOut: dates.checkOut,
        difference: { ...settled, pending: Boolean(settled.approve_url) },
      });
      booking.reload();
      availability.reload();
      nowAvailability.reload();
    } catch (error) {
      const code = error.code ?? 'failed';
      if (code === 'no_room_free') setState({ status: 'not_free', message: error.message });
      else if (error.status === 400) setState({ status: 'refused', message: Object.values(error.errors ?? {}).join(' ') || error.message });
      else if (code === 'cancelled') setState({ status: 'refused', message: 'That booking is cancelled, so it cannot be moved.' });
      else setState({ status: 'paypal_failed', message: error.message });
    }
  };

  const sendDifference = async () => {
    setLink({ sending: true, sent: false });
    try {
      const payload = await api.staffDifferenceLink(bookingId);
      if (payload.mail?.status === 'failed') {
        setState((current) => ({ ...current, differenceMail: payload.mail }));
        setLink({ sending: false, sent: false });
        return;
      }
      setLink({ sending: false, sent: true });
      setState((current) => ({ ...current, differenceMail: payload.mail }));
    } catch (error) {
      setState((current) => ({ ...current, differenceMail: { status: 'failed', error: error.message } }));
      setLink({ sending: false, sent: false });
    }
  };

  return (
    <>
      <p><Link className="link-arrow" to={`/staff/bookings/${data.id}`} style={{ textDecoration: 'none' }}>← Booking Record</Link></p>

      <Topbar
        title={`Edit booking ${data.booking_reference ?? ''}`}
        note={`${data.booking_reference ?? 'No reference yet'} · ${data.lead_guest_name} · booked ${data.booked_by === 'staff' ? `by staff${data.booked_by_staff_name ? ` (${data.booked_by_staff_name})` : ''}` : 'by the guest online'} on ${formatDate(data.booked_at)}`}
        actions={<Link className="btn btn--ghost" to="/staff/bookings">Back to Bookings</Link>}
      />

      <Stats>
        <Stat
          label="Room type now booked"
          value={<span style={{ fontSize: 'var(--text-md)' }}>{currentRoomType?.name ?? '—'}</span>}
          foot={`${money(data.nightly_rate)} a night · ${data.nights} ${data.nights === 1 ? 'night' : 'nights'}`}
        />
        <Stat
          label="Stay now booked"
          value={<span style={{ fontSize: 'var(--text-md)' }}>{formatRange(data.check_in_date, data.check_out_date)}</span>}
          foot={`${data.guest_count} ${data.guest_count === 1 ? 'guest' : 'guests'} staying`}
        />
        <Stat
          label="Rooms free on those nights"
          value={<span style={{ fontSize: 'var(--text-md)' }}>
            {nowRow
              ? `${nowRow.free_rooms} of the ${nowRow.room_count} ${currentRoomType?.name ?? 'room'} rooms are free`
              : 'Not known yet'}
          </span>}
          foot={nowRow
            ? `${nowRow.room_count - nowRow.free_rooms} ${nowRow.room_count - nowRow.free_rooms === 1 ? 'room' : 'rooms'} taken or out of service`
            : 'Availability for the nights held'}
        />
        <Stat accent label="Already paid" value={money(paid)} foot="through PayPal" />
      </Stats>

      {cancelled ? (
        <Alert kind="warn" title="This booking is cancelled" style={{ marginTop: 'var(--space-5)' }}>
          A cancelled booking cannot be moved, so there is nothing to change here. Cancelling freed the room for{' '}
          {formatRange(data.check_in_date, data.check_out_date)}, and the record stays for accounting.
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Link className="btn btn--ghost btn--sm" to={`/staff/bookings/${data.id}`}>Open the Booking Record</Link>
          </div>
        </Alert>
      ) : null}

      {unpaid ? (
        <Alert kind="warn" title="This booking has not been paid yet" style={{ marginTop: 'var(--space-5)' }}>
          Moving an unpaid booking would ask the guest to approve a second PayPal payment on top of the link they already
          have. The cleaner path is to cancel it — which frees the room with nothing to refund — and take a fresh booking
          for the nights the guest now wants.
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Link className="btn btn--ghost btn--sm" to={`/staff/bookings/${data.id}`}>Open the Booking Record</Link>
            <Link className="btn btn--primary btn--sm" to="/staff/bookings/new">New booking for a guest</Link>
          </div>
        </Alert>
      ) : null}

      <div className="split" style={{ marginTop: 'var(--space-6)' }}>
        <div>
          <Panel as="section" aria-labelledby="new-dates-title">
            <SectionHead title="New stay dates" note="Change a date and the room type list follows." />
            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                availability.reload();
              }}
            >
              <div className="field">
                <label htmlFor="edit-checkin">New check-in date</label>
                <input
                  type="date"
                  id="edit-checkin"
                  value={dates?.checkIn ?? ''}
                  onChange={(event) => {
                    setDates((current) => ({ ...current, checkIn: event.target.value }));
                    setState({ status: 'idle', message: null });
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="edit-checkout">New check-out date</label>
                <input
                  type="date"
                  id="edit-checkout"
                  value={dates?.checkOut ?? ''}
                  onChange={(event) => {
                    setDates((current) => ({ ...current, checkOut: event.target.value }));
                    setState({ status: 'idle', message: null });
                  }}
                />
              </div>
            </form>
            <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
              {nights} {nights === 1 ? 'night' : 'nights'}. The stay may be moved on the arrival day itself.
            </p>
            <Button kind="ghost" size="sm" type="button" onClick={availability.reload} disabled={availability.loading}>
              {availability.loading ? 'Checking availability…' : 'Check availability'}
            </Button>
          </Panel>

          <Panel as="section" aria-labelledby="free-title" style={{ marginTop: 'var(--space-5)' }}>
            <SectionHead
              title={`Room types free for ${formatDate(dates?.checkIn)} → ${formatDate(dates?.checkOut)}`}
              note="One room of one room type per booking."
              action={<span className="chip">{data.guest_count} {data.guest_count === 1 ? 'guest' : 'guests'} staying</span>}
            />

            {availability.failed ? (
              <Alert kind="error" title="We could not check what is free">
                {availability.error.message} — nothing has changed on this booking.
                <div className="row" style={{ marginTop: 'var(--space-3)' }}>
                  <Button kind="ghost" size="sm" type="button" onClick={availability.reload}>Try again</Button>
                </div>
              </Alert>
            ) : null}

            {!availability.loading && !availability.failed && freeRows.length === 0 ? (
              <Alert kind="error" title={`No room type is free for ${formatDate(dates?.checkIn)} → ${formatDate(dates?.checkOut)}`}>
                Every room of every room type is taken or out of service for these nights. Try other dates.
              </Alert>
            ) : null}

            <AvailabilityChooser
              allRoomTypes={(roomTypes.data?.room_types ?? []).filter((roomType) => roomType.on_sale)}
              freeRoomTypes={freeRows}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setState({ status: 'idle', message: null });
              }}
              nights={nights}
              guests={data.guest_count}
              currentRoomTypeId={String(data.room_type_id)}
              loading={availability.loading || roomTypes.loading}
              idPrefix="edit-rt"
            />

            {state.status === 'refused' || state.status === 'not_free' ? (
              <Alert kind="error" title="That move cannot be made" style={{ marginTop: 'var(--space-4)' }}>
                {state.message}
              </Alert>
            ) : null}

            {chosenRow ? (
              <Alert kind="success" title={`${chosenRoomType?.name} is free for the new dates`} style={{ marginTop: 'var(--space-4)' }}>
                {chosenRow.free_rooms} {chosenRow.free_rooms === 1 ? 'room' : 'rooms'} of {chosenRoomType?.name} free for
                all {nights} {nights === 1 ? 'night' : 'nights'}, {formatDate(dates?.checkIn)} → {formatDate(dates?.checkOut)}.
              </Alert>
            ) : null}
          </Panel>
        </div>

        <ChangeCostPanel
          booking={data}
          roomTypeName={chosenRoomType?.name ?? '—'}
          fromRoomTypeName={currentRoomType?.name ?? '—'}
          checkIn={dates?.checkIn}
          checkOut={dates?.checkOut}
          nights={nights}
          guests={data.guest_count}
          newTotal={newTotal}
          alreadyPaid={paid}
          difference={difference}
          confirming={state.status === 'working'}
          onConfirm={confirm}
          onSendDifference={sendDifference}
          sending={link.sending}
          differenceSent={link.sent}
          state={state}
          canConfirm={canConfirm}
        />
      </div>

      <Panel as="section" aria-labelledby="cancel-instead" style={{ marginTop: 'var(--space-5)' }}>
        <h3 id="cancel-instead">Cancel booking instead</h3>
        <p className="small muted">The guest's whole payment goes back through PayPal and the room is freed for those nights.</p>
        <Link className="btn btn--danger btn--sm" to={`/staff/bookings/${data.id}`}>Cancel booking instead</Link>
      </Panel>
    </>
  );
}
