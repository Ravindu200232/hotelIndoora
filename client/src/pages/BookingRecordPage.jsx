import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatShortDate, formatTime, money } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import { Alert, Button, LoadingBlock, Panel, Ref, Stack, Topbar } from '../components/index.jsx';
import { GuestDetailsTable } from '../components/staff/GuestDetailsTable.jsx';
import { StayTable } from '../components/staff/StayTable.jsx';
import { PaymentLinesTable } from '../components/staff/PaymentLinesTable.jsx';
import {
  AmountPaidPanel, BookingStatus, CancelBookingDialog, OtherStatesPanel, RecordActions,
} from '../components/staff/RecordActions.jsx';

/**
 * Booking Record: one booking in full for the desk.
 *
 * Who it is for and how to reach them, what it covers and at what rate, every
 * charge and refund with its PayPal transaction, and the actions the desk has:
 * move the stay, cancel it with the whole amount refunded, cancel an unpaid one to
 * free its room, or send the payment link again. The record also says what the
 * guest can do themselves, because they can change or cancel their own stay right
 * up to the arrival day.
 */
export function BookingRecordPage() {
  const { bookingId } = useParams();
  const booking = useAsync(() => api.staffBooking(bookingId), [bookingId]);
  const roomTypes = useAsync(() => api.staffRoomTypes(), []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [state, setState] = useState({ status: 'idle', message: null, cancelled: null });
  const [link, setLink] = useState({ sending: false, sent: false, error: null });

  const data = booking.data?.booking ?? null;
  const roomTypeName = (roomTypes.data?.room_types ?? []).find((roomType) => String(roomType.id) === String(data?.room_type_id))?.name ?? '—';
  const payments = data?.payments ?? [];
  const paid = payments
    .filter((payment) => payment.status === 'completed')
    .reduce((sum, payment) => sum + (payment.type === 'refund' ? -Number(payment.amount) : Number(payment.amount)), 0);

  const cancel = async () => {
    setState({ status: 'cancelling', message: null, cancelled: null });
    try {
      const payload = await api.staffCancelBooking(bookingId);
      setDialogOpen(false);
      setState({
        status: 'cancelled',
        message: null,
        cancelled: {
          amount: payload.refund?.amount ?? null,
          refundStatus: payload.refund?.status ?? null,
          mail: payload.mail ?? null,
        },
      });
      booking.reload();
    } catch (error) {
      setState({ status: 'refund_failed', message: error.message, cancelled: null });
    }
  };

  const sendLink = async () => {
    setLink({ sending: true, sent: false, error: null });
    try {
      const payload = await api.staffSendPaymentLink(bookingId);
      if (payload.mail?.status === 'failed') {
        setLink({ sending: false, sent: false, error: { message: payload.mail.error, link: payload.payment_link ?? null } });
        return;
      }
      setLink({ sending: false, sent: true, error: null });
      booking.reload();
    } catch (error) {
      setLink({ sending: false, sent: false, error: { message: error.message, link: null } });
    }
  };

  if (booking.loading) {
    return (
      <>
        <p><Link className="link-arrow" to="/staff/bookings" style={{ textDecoration: 'none' }}>← Back to Bookings</Link></p>
        <Topbar title="Booking" note="Loading this booking…" />
        <LoadingBlock label="Loading this booking…" lines={4} />
      </>
    );
  }

  if (booking.failed || !data) {
    return (
      <>
        <p><Link className="link-arrow" to="/staff/bookings" style={{ textDecoration: 'none' }}>← Back to Bookings</Link></p>
        <Topbar title="Booking" note="Nothing has been changed." />
        <Alert kind="error" title="This booking could not be loaded">
          {booking.error?.status === 404
            ? 'That booking is not one of ours. Check the reference on the Bookings page and open it from there.'
            : `${booking.error.message} — nothing has been changed.`}
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Button kind="primary" size="sm" type="button" onClick={booking.reload}>Try again</Button>
            <Link className="btn btn--ghost btn--sm" to="/staff/bookings">Back to Bookings</Link>
          </div>
        </Alert>
      </>
    );
  }

  const whenBooked = `${formatShortDate(data.booked_at).slice(4)} at ${formatTime(data.booked_at)}`;

  return (
    <>
      <p><Link className="link-arrow" to="/staff/bookings" style={{ textDecoration: 'none' }}>← Back to Bookings</Link></p>

      <div className="row" style={{ marginTop: 'var(--space-3)' }}>
        <Ref>{data.booking_reference ?? 'No reference yet'}</Ref>
        <BookingStatus status={data.status} />
      </div>

      <Topbar
        title={`Booking for ${data.lead_guest_name}`}
        note={`${data.booked_by === 'staff' ? `Taken by staff${data.booked_by_staff_name ? ` · ${data.booked_by_staff_name}` : ''}` : 'Made online by the guest'} · Booked ${whenBooked}`}
        actions={(
          <>
            <Link className="btn btn--primary" to={`/staff/bookings/${data.id}/edit`}>Edit booking</Link>
            {data.status === 'cancelled' ? null : (
              <Button kind="danger" type="button" onClick={() => { setState({ status: 'idle', message: null, cancelled: null }); setDialogOpen(true); }}>
                {paid > 0 ? `Cancel and refund ${money(paid)}` : 'Cancel unpaid booking'}
              </Button>
            )}
          </>
        )}
      />

      {state.status === 'cancelled' ? (
        <Alert kind="success" title="Booking cancelled">
          <p style={{ margin: 0 }}><BookingStatus status="cancelled" /></p>
          {state.cancelled?.amount
            ? `${money(state.cancelled.amount)} is on its way back through PayPal, the guest has been emailed and the room is back on sale for ${formatShortDate(data.check_in_date).slice(4)} to ${formatShortDate(data.check_out_date).slice(4)}.`
            : `The guest never paid, so there was nothing to refund. The room is back on sale for ${formatShortDate(data.check_in_date).slice(4)} to ${formatShortDate(data.check_out_date).slice(4)}.`}
          {state.cancelled?.mail?.status === 'failed' ? (
            <p className="small muted">The guest could not be emailed: {state.cancelled.mail.error}</p>
          ) : null}
        </Alert>
      ) : null}

      {state.status === 'refund_failed' ? (
        <Alert kind="error" title="The refund did not go through">
          {state.message} Nothing has been refunded and the booking is exactly as it was.
        </Alert>
      ) : null}

      <div className="split">
        <div>
          <GuestDetailsTable booking={data} />
          <StayTable booking={data} roomTypeName={roomTypeName} />
          <PaymentLinesTable payments={payments} />
          <OtherStatesPanel
            booking={data}
            paid={paid}
            state={state}
            onRetryRefund={() => setDialogOpen(true)}
          />
        </div>

        <Stack as="aside">
          <AmountPaidPanel booking={data} payments={payments} roomTypeName={roomTypeName} />
          <RecordActions
            booking={data}
            paid={paid}
            sending={link.sending}
            sent={link.sent}
            sendError={link.error}
            onCancelPaid={() => setDialogOpen(true)}
            onCancelUnpaid={() => setDialogOpen(true)}
            onSendLink={sendLink}
          />
          <Panel tint>
            <h4>What the guest can do themselves</h4>
            <p className="small muted">
              The guest can change the dates or the room type, or cancel and be refunded in full, right up to and
              including the arrival day, from their own bookings page.
            </p>
            <Link className="btn btn--ghost btn--sm btn--block" to="/">See the guest site</Link>
          </Panel>
        </Stack>
      </div>

      <CancelBookingDialog
        open={dialogOpen}
        booking={data}
        paid={paid}
        cancelling={state.status === 'cancelling'}
        failed={state.status === 'refund_failed' ? state.message : null}
        onClose={() => setDialogOpen(false)}
        onConfirm={cancel}
      />
    </>
  );
}
