import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, formatLongDate, formatTime } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import { useHotel } from '../hotel.jsx';
import { useSession } from '../session.jsx';
import { Alert, Button, EmptyState, LoadingBlock, Topbar } from '../components/index.jsx';
import { ShiftStats } from '../components/staff/ShiftStats.jsx';
import { ArrivalsTable } from '../components/staff/ArrivalsTable.jsx';
import { DeparturesTable } from '../components/staff/DeparturesTable.jsx';
import { UpcomingList } from '../components/staff/UpcomingList.jsx';
import { WaitingPaymentList } from '../components/staff/WaitingPaymentList.jsx';
import { ManageShortcuts } from '../components/staff/ManageShortcuts.jsx';

/** `Good morning`, `Good afternoon`, `Good evening` — by the desk's own clock. */
const greeting = (hour) => (hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening');

/**
 * Staff Dashboard: the day at the desk.
 *
 * The four figures, the arrivals and departures on the board today, the bookings
 * coming up and the ones still waiting to be paid for — every one of them from
 * the desk's own dashboard answer, refreshed once a minute so a booking that
 * comes in while the page is open appears on its own. When a refresh does not
 * come back, the page says which figures it is still showing rather than quietly
 * presenting something stale, and when a booking that was waiting becomes
 * confirmed the desk is told a payment came in.
 */
export function StaffDashboardPage() {
  const { account } = useSession();
  const { hotel } = useHotel();
  const location = useLocation();
  const dashboard = useAsync(() => api.staffDashboard(), []);
  const roomTypes = useAsync(() => api.staffRoomTypes(), []);
  const team = useAsync(() => api.team(), []);
  const [live, setLive] = useState(null);
  const [staleAt, setStaleAt] = useState(null);
  const [paymentReceived, setPaymentReceived] = useState(null);
  const waitingBefore = useRef(null);
  const [clock, setClock] = useState(() => new Date());

  const data = live ?? dashboard.data;

  const namesById = useMemo(() => {
    const map = new Map();
    for (const roomType of roomTypes.data?.room_types ?? []) map.set(String(roomType.id), roomType.name);
    return map;
  }, [roomTypes.data]);
  const roomTypeName = useCallback((id) => namesById.get(String(id)) ?? '—', [namesById]);

  // A payment that arrives while the page is open: a booking that was waiting is
  // no longer waiting, so the desk is told which one cleared.
  useEffect(() => {
    if (!data) return;
    const waitingNow = new Set((data.waiting_for_payment ?? []).map((booking) => booking.id));
    if (waitingBefore.current) {
      const cleared = [...waitingBefore.current].filter((id) => !waitingNow.has(id));
      if (cleared.length) {
        const booking = [...(data.arrivals ?? []), ...(data.upcoming ?? [])].find((one) => one.id === cleared[0]);
        if (booking) {
          setPaymentReceived({
            reference: booking.booking_reference,
            guest: booking.lead_guest_name,
          });
        }
      }
    }
    waitingBefore.current = waitingNow;
  }, [data]);

  // Arriving from a payment link being used: the desk is told straight away.
  useEffect(() => {
    const from = location.state?.paymentReceived;
    if (from) setPaymentReceived(from);
  }, [location.state]);

  const refresh = useCallback(async () => {
    try {
      const payload = await api.staffDashboard();
      setLive(payload);
      setStaleAt(null);
      setClock(new Date());
    } catch {
      // Keep showing what is on the board, and say when it was loaded.
      setStaleAt(formatTime(clock));
    }
  }, [clock]);

  // The board refreshes itself once a minute, as the page says it does.
  useEffect(() => {
    const timer = setInterval(refresh, 60000);
    return () => clearInterval(timer);
  }, [refresh]);

  if (dashboard.loading) {
    return (
      <>
        <Topbar title="Dashboard" note="Loading today at the desk…" />
        <LoadingBlock label="Loading today's arrivals, departures and bookings…" lines={4} />
      </>
    );
  }

  if (dashboard.failed || !data) {
    return (
      <>
        <Topbar title="Dashboard" note="Today at the desk." />
        <Alert kind="error" title="Today's board could not be loaded">
          {dashboard.error.message} — nothing has changed on any booking.
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Button kind="primary" size="sm" type="button" onClick={dashboard.reload}>Try again</Button>
            <Link className="btn btn--ghost btn--sm" to="/staff/bookings">Open Bookings</Link>
          </div>
        </Alert>
      </>
    );
  }

  const arrivals = data.arrivals ?? [];
  const departures = data.departures ?? [];
  const waiting = data.waiting_for_payment ?? [];
  const upcoming = data.upcoming ?? [];
  const today = formatLongDate(data.today);
  const nothingOn = arrivals.length === 0 && departures.length === 0 && waiting.length === 0;

  return (
    <>
      <Topbar
        titleClass="font-drop"
        title={<>Good {greeting(clock.getHours())}, <span>{account?.full_name}</span></>}
        note={`${today} · updated ${formatTime(clock)}`}
        actions={(
          <>
            <Link className="btn btn--primary" to="/staff/bookings/new">New booking for a guest</Link>
            <Link className="btn btn--ghost" to="/staff/bookings">All bookings</Link>
          </>
        )}
      />

      {paymentReceived ? (
        <Alert kind="success" title="Payment received">
          Booking {paymentReceived.reference ?? 'that booking'} is confirmed — {paymentReceived.guest} paid the emailed
          PayPal link — and the figures below are up to date.
        </Alert>
      ) : null}

      {roomTypes.failed ? (
        <Alert kind="warn" title="The room type names could not be loaded">
          {roomTypes.error.message} — the room type column shows a dash until they come back, and every other figure here
          is unaffected.
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Button kind="ghost" size="sm" type="button" onClick={roomTypes.reload}>Try again</Button>
          </div>
        </Alert>
      ) : null}

      <ShiftStats
        arrivals={arrivals}
        departures={departures}
        waiting={waiting}
        upcoming={upcoming}
        checkOutTime={hotel?.check_out_time}
      />

      <section className="section" style={{ padding: 'var(--space-6) 0 0' }} aria-labelledby="today-title">
        <div className="section__head">
          <div>
            <h2 id="today-title">Today</h2>
            <p>{today}.</p>
          </div>
          <span className="chip">Refreshing every minute</span>
        </div>

        {nothingOn ? (
          <EmptyState
            title="Nothing on the board today"
            action={<Link className="btn btn--primary" to="/staff/bookings">Open Bookings</Link>}
          >
            No arrivals, no departures and no bookings waiting for payment.
          </EmptyState>
        ) : (
          <div className="grid grid--2">
            <ArrivalsTable bookings={arrivals} roomTypeName={roomTypeName} />
            <DeparturesTable bookings={departures} roomTypeName={roomTypeName} />
          </div>
        )}
      </section>

      <section className="section" style={{ padding: 'var(--space-6) 0 0' }} aria-labelledby="waiting-title">
        <div className="grid grid--2">
          <UpcomingList
            bookings={upcoming}
            roomTypeName={roomTypeName}
            staleAt={staleAt}
            onRetry={refresh}
          />
          <WaitingPaymentList bookings={waiting} roomTypeName={roomTypeName} />
        </div>
      </section>

      <ManageShortcuts
        roomTypeCount={roomTypes.data?.room_types?.length ?? null}
        roomCount={roomTypes.data ? roomTypes.data.room_types.reduce((sum, roomType) => sum + Number(roomType.room_count ?? 0), 0) : null}
        staffCount={team.data?.members?.length ?? null}
      />
    </>
  );
}
