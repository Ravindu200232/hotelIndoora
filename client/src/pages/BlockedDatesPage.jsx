import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatShortDate, money } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import { useSession } from '../session.jsx';
import { Alert, Button, EmptyState, LoadingBlock, Panel, SectionHead, Skeleton, Topbar } from '../components/index.jsx';
import { BlockedStats } from '../components/staff/BlockedStats.jsx';
import { OutOfServiceBars } from '../components/staff/OutOfServiceBars.jsx';
import { BlockedRangesTable } from '../components/staff/BlockedRangesTable.jsx';
import { RemoveBlockDialog } from '../components/staff/RemoveBlockDialog.jsx';

/**
 * Blocked Dates: the nights this room type's rooms are out of service.
 *
 * Blocking stops new bookings only — a stay already booked for one of those
 * nights keeps its room, its dates and its price — so this page is the record of
 * what is off sale and why, who blocked it and when, with a way to put a range
 * back on sale. Every row and every figure comes from the room type's own blocks.
 */
export function BlockedDatesPage() {
  const { roomTypeId } = useParams();
  const { account } = useSession();
  const blocks = useAsync(() => api.staffBlocks(roomTypeId), [roomTypeId]);
  const [toRemove, setToRemove] = useState(null);
  const [state, setState] = useState({ status: 'idle', message: null, removed: null });

  const roomType = blocks.data?.room_type ?? null;
  const all = blocks.data?.blocks ?? [];

  const remove = async () => {
    if (!toRemove) return;
    setState({ status: 'removing', message: null, removed: null });
    try {
      await api.staffRemoveBlock(roomTypeId, toRemove.id);
      setState({
        status: 'removed',
        message: null,
        removed: { nights: toRemove.nights, first: toRemove.first_night, last: toRemove.last_night },
      });
      setToRemove(null);
      blocks.reload();
    } catch (error) {
      setState({ status: 'failed', message: error.message, removed: null });
    }
  };

  if (blocks.failed) {
    return (
      <>
        <Topbar
          trail={[
            { label: 'Room Types', to: '/staff/room-types' },
            { label: 'Room type', to: `/staff/room-types/${roomTypeId}` },
            { label: 'Blocked dates' },
          ]}
          title="Blocked dates"
          note="Nothing has been changed."
        />
        <Alert kind="error" title="We couldn't load the blocked dates">
          {blocks.error.message} — the list of nights out of service did not come back from the server, so nothing here
          is up to date.
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Button kind="primary" size="sm" type="button" onClick={blocks.reload}>Retry</Button>
            <Link className="btn btn--ghost btn--sm" to={`/staff/room-types/${roomTypeId}`}>Back to room type</Link>
          </div>
        </Alert>
      </>
    );
  }

  return (
    <>
      <Topbar
        trail={[
          { label: 'Room Types', to: '/staff/room-types' },
          { label: roomType?.name ?? 'Room type', to: `/staff/room-types/${roomTypeId}` },
          { label: 'Blocked dates' },
        ]}
        title="Blocked dates"
        note={roomType
          ? `${roomType.name} · ${roomType.room_count} ${roomType.room_count === 1 ? 'room' : 'rooms'} · ${money(roomType.nightly_rate)} a night · ${roomType.on_sale ? 'On sale' : 'Off sale'}`
          : 'Loading this room type…'}
        actions={(
          <>
            <Link className="btn btn--primary" to={`/staff/room-types/${roomTypeId}/blocks/new`}>Block rooms</Link>
            <Link className="btn btn--ghost" to={`/staff/room-types/${roomTypeId}`}>Back to room type</Link>
          </>
        )}
      />

      {blocks.loading ? (
        <>
          <Panel style={{ marginTop: 'var(--space-6)' }}>
            <p className="small muted" style={{ margin: 0 }}>Loading the blocked dates…</p>
            <Skeleton style={{ display: 'block', width: '85%', marginTop: 'var(--space-3)' }} />
            <Skeleton style={{ display: 'block', width: '70%', marginTop: 'var(--space-3)' }} />
            <Skeleton style={{ display: 'block', width: '55%', marginTop: 'var(--space-3)' }} />
          </Panel>
          <LoadingBlock label="Loading the nights out of service…" lines={3} />
        </>
      ) : null}

      {blocks.ready ? (
        <>
          <BlockedStats blocks={all} roomType={roomType} />
          <OutOfServiceBars blocks={all} />

          {state.status === 'removed' && state.removed ? (
            <Alert kind="success" title="Block removed" style={{ marginTop: 'var(--space-5)' }}>
              {state.removed.nights} {state.removed.nights === 1 ? 'night' : 'nights'},{' '}
              {formatShortDate(state.removed.first).slice(4)} to {formatShortDate(state.removed.last).slice(4)}, are back
              on sale for {roomType?.name}.
            </Alert>
          ) : null}

          {state.status === 'failed' ? (
            <Alert kind="error" title="The block was not removed" style={{ marginTop: 'var(--space-5)' }}>
              {state.message} Those nights are still out of service, and nothing else has changed.
            </Alert>
          ) : null}

          <section className="section" style={{ padding: 'var(--space-6) 0 0' }} aria-labelledby="ranges-title">
            <SectionHead
              title="Blocked date ranges"
              note={`Guests searching these nights see one fewer room of ${roomType?.name ?? 'this room type'} free.`}
              action={(
                <Link className="btn btn--ghost btn--sm" to={`/staff/room-types/${roomTypeId}/blocks/new`}>Block rooms</Link>
              )}
            />

            {all.length === 0 ? (
              <EmptyState
                title={`No nights are blocked for ${roomType?.name ?? 'this room type'}`}
                action={<Link className="btn btn--primary" to={`/staff/room-types/${roomTypeId}/blocks/new`}>Block rooms</Link>}
              >
                Every night is on sale. Block a range when the rooms need to come out of service for repairs, painting or
                a long let.
              </EmptyState>
            ) : (
              <BlockedRangesTable
                blocks={all}
                roomTypeName={roomType?.name ?? 'this room type'}
                onRemove={(block) => {
                  setState({ status: 'idle', message: null, removed: null });
                  setToRemove(block);
                }}
              />
            )}
          </section>

          <Panel tint style={{ marginTop: 'var(--space-6)' }}>
            <h4>What blocking does</h4>
            <ul>
              <li>Those nights have one fewer room of {roomType?.name ?? 'this room type'} to sell: the free room count drops by one for every night a block covers.</li>
              <li>Every night covered reduces the free room count for the room type.</li>
              <li>Bookings already made for a blocked night are left unchanged, with their room, dates and price.</li>
              <li>Removing a block puts those nights back on sale immediately.</li>
            </ul>
            <div className="row">
              <Link className="btn btn--ghost btn--sm" to="/staff/room-types">All room types</Link>
              <Link className="btn btn--quiet btn--sm" to="/staff/bookings">Bookings</Link>
            </div>
          </Panel>
        </>
      ) : null}

      <RemoveBlockDialog
        block={toRemove}
        roomTypeName={roomType?.name ?? 'this room type'}
        removing={state.status === 'removing'}
        failed={state.status === 'failed' ? state.message : null}
        removedBy={account?.full_name ?? 'the desk'}
        onClose={() => setToRemove(null)}
        onConfirm={remove}
      />
    </>
  );
}
