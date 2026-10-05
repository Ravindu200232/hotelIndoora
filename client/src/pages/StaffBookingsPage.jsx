import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, formatLongDate } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import {
  Alert, Button, EmptyState, LoadingBlock, Skeleton, Topbar,
} from '../components/index.jsx';
import { ArrivalsTodayTable } from '../components/staff/ArrivalsTodayTable.jsx';
import { WaitingPaymentPanel } from '../components/staff/WaitingPaymentPanel.jsx';
import { BookingFilters } from '../components/staff/BookingFilters.jsx';
import { BookingsTable, BookingResultsHead } from '../components/staff/BookingsTable.jsx';
import { BookingPager } from '../components/staff/BookingPager.jsx';

const BLANK = { check_in: '', check_out: '', guest: '', room_type_id: 'any', status: 'any' };

/**
 * Bookings: every booking the hotel has taken, and the way to find one.
 *
 * The desk works from three things at once — who is arriving today, which rooms
 * are still waiting to be paid for, and a search over every booking by the nights
 * it covers, any part of the guest's name, the room type or the status. The search
 * is answered by the bookings service itself, 25 rows at a time, so what the page
 * shows is the real result count and not a filter over one page of rows.
 */
export function StaffBookingsPage() {
  const location = useLocation();
  const [draft, setDraft] = useState(BLANK);
  const [applied, setApplied] = useState(BLANK);
  const [page, setPage] = useState(1);

  const roomTypes = useAsync(() => api.staffRoomTypes(), []);
  const dashboard = useAsync(() => api.staffDashboard(), []);

  const load = useCallback(() => {
    const query = { page };
    if (applied.check_in) query.check_in = applied.check_in;
    if (applied.check_out) query.check_out = applied.check_out;
    if (applied.guest.trim()) query.guest = applied.guest.trim();
    if (applied.room_type_id && applied.room_type_id !== 'any') query.room_type_id = applied.room_type_id;
    // The service knows the booking's own statuses; the page offers the desk's words.
    if (applied.status && applied.status !== 'any') {
      query.status = applied.status === 'waiting' ? 'pending_payment' : applied.status;
    }
    return api.staffBookings(query);
  }, [applied, page]);

  const results = useAsync(load, [applied, page]);
  const [changed, setChanged] = useState(null);

  // A booking changed or cancelled a moment ago: say what happened to it here.
  useEffect(() => {
    if (location.state?.changed) setChanged(location.state.changed);
  }, [location.state]);

  const namesById = useMemo(() => {
    const map = new Map();
    for (const roomType of roomTypes.data?.room_types ?? []) map.set(String(roomType.id), roomType.name);
    return map;
  }, [roomTypes.data]);
  const roomTypeName = useCallback((id) => namesById.get(String(id)) ?? '—', [namesById]);

  const bookings = results.data?.bookings ?? [];
  const total = results.data?.total ?? 0;
  const perPage = results.data?.per_page ?? 25;
  const pages = results.data?.pages ?? 1;
  const filtered = Object.values(applied).some((value) => value && value !== 'any')
    || Boolean(applied.check_in || applied.check_out);
  const arrivals = dashboard.data?.arrivals ?? [];
  const waiting = dashboard.data?.waiting_for_payment ?? [];

  const apply = () => {
    setApplied(draft);
    setPage(1);
  };
  const clear = () => {
    setDraft(BLANK);
    setApplied(BLANK);
    setPage(1);
  };

  return (
    <>
      <Topbar
        title="Bookings"
        note={`${formatLongDate()} · ${total} ${filtered ? 'matching ' : ''}${total === 1 ? 'booking' : 'bookings'} · ${arrivals.length} ${arrivals.length === 1 ? 'arrival' : 'arrivals'} today · ${waiting.length} still waiting for payment`}
        actions={(
          <>
            <Link className="btn btn--primary" to="/staff/bookings/new">New booking for a guest</Link>
            <Link className="btn btn--ghost" to="/staff">Dashboard</Link>
          </>
        )}
      />

      {changed ? (
        <Alert kind="success" title={changed.title}>
          {changed.body}
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <button className="btn btn--ghost btn--sm" type="button" onClick={() => setChanged(null)}>Dismiss</button>
          </div>
        </Alert>
      ) : null}

      {dashboard.failed ? (
        <Alert kind="warn" title="Today's arrivals could not be loaded">
          {dashboard.error.message} — the search below still works and nothing has changed.
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Button kind="ghost" size="sm" type="button" onClick={dashboard.reload}>Try again</Button>
          </div>
        </Alert>
      ) : null}

      {dashboard.loading ? (
        <LoadingBlock label="Loading today's arrivals and the bookings waiting for payment…" lines={3} />
      ) : (
        <div className="grid grid--2">
          <ArrivalsTodayTable bookings={arrivals} roomTypeName={roomTypeName} />
          <WaitingPaymentPanel bookings={waiting} roomTypeName={roomTypeName} />
        </div>
      )}

      {roomTypes.failed ? (
        <Alert kind="warn" title="The room types could not be loaded">
          {roomTypes.error.message} — the room type filter and column show a dash until they come back.
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Button kind="ghost" size="sm" type="button" onClick={roomTypes.reload}>Try again</Button>
          </div>
        </Alert>
      ) : null}

      <BookingFilters
        draft={draft}
        applied={applied}
        onChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))}
        onApply={apply}
        onClear={clear}
        roomTypes={roomTypes.data?.room_types ?? []}
        matchCount={total}
        perPage={perPage}
      />

      <section className="section" style={{ padding: 'var(--space-6) 0 0' }} aria-labelledby="results-title">
        <BookingResultsHead
          total={total}
          page={page}
          perPage={perPage}
          roomsLabel={filtered ? 'Filtered, sorted by check-in date' : 'Sorted by check-in date'}
        />

        {results.loading ? (
          <div className="panel" style={{ marginTop: 'var(--space-5)' }}>
            <p className="small muted" style={{ margin: 0 }}>Loading bookings…</p>
            <Skeleton style={{ display: 'block', width: '85%', marginTop: 'var(--space-3)' }} />
            <Skeleton style={{ display: 'block', width: '70%', marginTop: 'var(--space-3)' }} />
            <Skeleton style={{ display: 'block', width: '60%', marginTop: 'var(--space-3)' }} />
          </div>
        ) : null}

        {results.failed ? (
          <Alert kind="error" title="We couldn't load the bookings" style={{ marginTop: 'var(--space-5)' }}>
            {results.error.message} — the list didn't come back just now, and nothing has changed.
            <div className="row" style={{ marginTop: 'var(--space-3)' }}>
              <Button kind="primary" size="sm" type="button" onClick={results.reload}>Retry</Button>
            </div>
          </Alert>
        ) : null}

        {results.ready && bookings.length === 0 ? (
          <EmptyState
            title="No booking matches these filters"
            action={<Button kind="primary" type="button" onClick={clear}>Clear filters</Button>}
          >
            Nothing matches the nights, name, room type and status you chose. Widen one of them, or clear the filters and
            start again.
          </EmptyState>
        ) : null}

        {results.ready && bookings.length > 0 ? (
          <>
            <BookingsTable bookings={bookings} roomTypeName={roomTypeName} />
            <BookingPager
              pages={pages}
              page={page}
              onPage={setPage}
              total={total}
              perPage={perPage}
              filtered={filtered}
            />
          </>
        ) : null}
      </section>
    </>
  );
}
