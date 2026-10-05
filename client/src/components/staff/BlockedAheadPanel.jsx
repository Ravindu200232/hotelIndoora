import { Link } from 'react-router-dom';
import { Alert, Button, Panel, Skeleton } from '../index.jsx';
import { formatShortDate } from '../../api.js';

const nightsOf = (block) => Number(block.nights ?? 0);
const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * The nights this room type's rooms are out of service, summed up where the desk
 * changes the room type, with the next range named in full: when it runs, why,
 * who blocked it and when.
 *
 * A block stops new bookings only - a booking already made for one of those
 * nights is left exactly as it is - so this panel is a summary and a way through
 * to the blocked dates page rather than a warning.
 */
export function BlockedAheadPanel({ roomTypeId, data, loading, failed, error, onRetry }) {
  const ahead = (data?.blocks ?? []).filter((block) => String(block.last_night).slice(0, 10) >= todayIso());
  const nights = ahead.reduce((sum, block) => sum + nightsOf(block), 0);
  const next = ahead[0] ?? null;

  return (
    <Panel as="section" tint aria-labelledby="edit-blocks" style={{ marginTop: 'var(--space-5)' }}>
      <h2 id="edit-blocks">Rooms out of service</h2>

      {loading ? (
        <>
          <p className="small muted">Loading the nights out of service…</p>
          <Skeleton style={{ display: 'block', width: '60%', marginTop: 'var(--space-3)' }} />
          <Skeleton style={{ display: 'block', width: '40%', marginTop: 'var(--space-3)' }} />
        </>
      ) : null}

      {failed ? (
        <Alert kind="error" title="The blocked nights could not be loaded">
          {error?.message ?? 'Try again in a moment.'} — nothing has changed on this room type.
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Button kind="ghost" size="sm" type="button" onClick={onRetry}>Try again</Button>
            <Link className="btn btn--ghost btn--sm" to={`/staff/room-types/${roomTypeId}/blocks`}>Open Blocked dates</Link>
          </div>
        </Alert>
      ) : null}

      {!loading && !failed ? (
        <div className="row row--between">
          <div>
            <p>
              <b>
                {ahead.length === 0
                  ? 'No nights blocked ahead'
                  : `${ahead.length} ${ahead.length === 1 ? 'range' : 'ranges'} blocked ahead`}
              </b>
            </p>
            <p className="small muted" style={{ margin: 0 }}>
              {next
                ? `Next: ${formatShortDate(next.first_night)} – ${formatShortDate(next.last_night)} · ${next.reason} · blocked by ${next.blocked_by ?? 'the desk'} on ${formatShortDate(next.blocked_at)}. ${nights} ${nights === 1 ? 'night' : 'nights'} out of service in all.`
                : 'Every free night on this room type is on sale.'}
            </p>
          </div>
          <Link className="btn btn--primary btn--sm" to={`/staff/room-types/${roomTypeId}/blocks`}>
            {ahead.length ? 'Blocked dates' : 'Block rooms'}
          </Link>
        </div>
      ) : null}
    </Panel>
  );
}
