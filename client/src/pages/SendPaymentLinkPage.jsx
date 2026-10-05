import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import { useSession } from '../session.jsx';
import { Alert, Button, LoadingBlock, Steps, Topbar } from '../components/index.jsx';
import { StaySummary } from '../components/staff/StaySummary.jsx';
import { PaymentLinkPanel } from '../components/staff/PaymentLinkPanel.jsx';
import { WhatHappensNext } from '../components/staff/WhatHappensNext.jsx';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Send Payment Link: the last step of taking a booking for a guest on the phone.
 *
 * One email with a PayPal link for the full amount, to the address on the booking
 * — which the desk may correct here, since the link and the confirmation both go
 * there. The room is held while the link is unpaid, and the booking confirms with
 * its reference the moment the guest pays.
 */
export function SendPaymentLinkPage() {
  const [searchParams] = useSearchParams();
  const { account } = useSession();
  const bookingId = searchParams.get('booking_id');
  const booking = useAsync(
    () => (bookingId ? api.staffBooking(bookingId) : Promise.resolve({ booking: null })),
    [bookingId],
  );
  const data = booking.data?.booking ?? null;
  const roomType = useAsync(
    () => (data?.room_type_id ? api.staffRoomType(data.room_type_id) : Promise.resolve({ room_type: null })),
    [data?.room_type_id],
  );

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(null);
  const [state, setState] = useState({ sending: false, failed: null, sent: false });

  useEffect(() => {
    if (data?.guest_email) setEmail(data.guest_email);
  }, [data?.guest_email]);

  const send = async () => {
    if (!EMAIL.test(email.trim())) {
      setEmailError('Enter an email address in the correct format, like name@example.com.');
      return;
    }
    setEmailError(null);
    setState({ sending: true, failed: null, sent: false });
    try {
      const payload = await api.staffSendPaymentLink(bookingId, email.trim());
      if (payload.mail?.status === 'failed') {
        setState({ sending: false, failed: { message: payload.mail.error, link: payload.payment_link ?? null }, sent: false });
        return;
      }
      setState({ sending: false, failed: null, sent: true });
      booking.reload();
    } catch (error) {
      setState({
        sending: false,
        failed: { message: error.errors?.guest_email ?? error.message, link: error.payload?.payment_link ?? null },
        sent: false,
      });
    }
  };

  if (!bookingId) {
    return (
      <>
        <Topbar
          trail={[{ label: 'Bookings', to: '/staff/bookings' }, { label: 'Send payment link' }]}
          title="Send payment link"
          note="Take the booking first, then the guest is sent the link to pay for it."
          actions={<Link className="btn btn--ghost" to="/staff/bookings">Back to Bookings</Link>}
        />
        <Steps steps={['Dates and room', 'Guest and stay', 'Send payment link']} current={2} />
        <Alert kind="info" title="No booking is waiting for its payment link">
          This page sends the link for a booking the desk has just taken. Take the booking first, and the stay appears
          here with the guest's own details and the amount to pay.
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Link className="btn btn--primary btn--sm" to="/staff/bookings/new">New booking for a guest</Link>
            <Link className="btn btn--ghost btn--sm" to="/staff/bookings">Back to Bookings</Link>
          </div>
        </Alert>
      </>
    );
  }

  if (booking.loading) {
    return (
      <>
        <Topbar
          trail={[{ label: 'Bookings', to: '/staff/bookings' }, { label: 'Send payment link' }]}
          title="Send payment link"
          note="Loading the booking you just took…"
        />
        <LoadingBlock label="Loading the booking you just took…" lines={4} />
      </>
    );
  }

  if (booking.failed || !data) {
    return (
      <>
        <Topbar
          trail={[{ label: 'Bookings', to: '/staff/bookings' }, { label: 'Send payment link' }]}
          title="Send payment link"
          note="Nothing has been sent."
        />
        <Alert kind="error" title="This booking could not be loaded">
          {booking.error?.status === 404
            ? 'That booking is not one of ours. Open it from the Bookings page instead.'
            : `${booking.error.message} — nothing has been sent and nothing has changed.`}
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Button kind="primary" size="sm" type="button" onClick={booking.reload}>Try again</Button>
            <Link className="btn btn--ghost btn--sm" to="/staff/bookings">Back to Bookings</Link>
          </div>
        </Alert>
      </>
    );
  }

  const alreadyPaid = data.status !== 'pending_payment';

  return (
    <>
      <Topbar
        trail={[
          { label: 'Bookings', to: '/staff/bookings' },
          { label: 'New booking for a guest', to: '/staff/bookings/new' },
          { label: 'Send payment link' },
        ]}
        title="Send payment link"
        note="One email to this guest with a PayPal link for the full amount. The room is held while the link is unpaid."
        actions={<Link className="btn btn--ghost" to="/staff/bookings">Back to Bookings</Link>}
      />

      <Steps
        steps={[
          `Guest and stay — ${data.lead_guest_name} · ${data.nights} nights from ${new Date(data.check_in_date).toDateString()}`,
          'Send the PayPal link — email the guest, hold the room',
          'Waiting for payment — confirmed the moment the guest pays',
        ]}
        current={1}
      />

      {alreadyPaid ? (
        <Alert
          kind={data.status === 'cancelled' ? 'warn' : 'success'}
          title={data.status === 'cancelled' ? 'This booking is cancelled' : 'This booking is already paid'}
        >
          {data.status === 'cancelled'
            ? 'A cancelled booking cannot be paid for, so there is no link to send. Its record stays for accounting.'
            : `${data.booking_reference ? `Booking ${data.booking_reference} has been paid` : 'This booking has been paid'}, so there is no link to send.`}
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Link className="btn btn--primary btn--sm" to={`/staff/bookings/${data.id}`}>Open the booking record</Link>
          </div>
        </Alert>
      ) : (
        <div className="split">
          <StaySummary booking={data} roomType={roomType.data?.room_type ?? null} bookedBy={account?.full_name} />
          <div>
            <PaymentLinkPanel
              booking={data}
              email={email}
              onEmailChange={(value) => {
                setEmail(value);
                setEmailError(null);
                setState((current) => ({ ...current, failed: null }));
              }}
              emailError={emailError}
              onSend={send}
              sending={state.sending}
              failed={state.failed}
              sent={state.sent}
            />
            <WhatHappensNext booking={data} />
          </div>
        </div>
      )}
    </>
  );
}
