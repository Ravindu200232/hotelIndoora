import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatShortDate, money } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import { Alert, LoadingBlock, Panel, PlainList, Topbar } from '../components/index.jsx';
import { BlockForm, nightsInRange, validateBlock } from '../components/staff/BlockForm.jsx';

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Block Rooms: taking a range of nights out of service, with a reason.
 *
 * The room type is shown beside the form with its rooms and rate, because the
 * block covers every room of the type, and the page says plainly what blocking
 * does and does not do: those nights stop being sold, while a booking already
 * made for one of them keeps its room, its dates and its price.
 */
export function BlockRoomsPage() {
  const { roomTypeId } = useParams();
  const blocks = useAsync(() => api.staffBlocks(roomTypeId), [roomTypeId]);
  const [values, setValues] = useState({ first_night: todayIso(), last_night: '', reason: '', roomTypeId });
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ status: 'idle', message: null, saved: null });

  const roomType = blocks.data?.room_type ?? null;
  const nights = nightsInRange(values.first_night, values.last_night);

  const change = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const save = async () => {
    const problems = validateBlock(values);
    setErrors(problems);
    if (Object.keys(problems).length) {
      setState({ status: 'idle', message: null, saved: null });
      return;
    }
    setState({ status: 'saving', message: null, saved: null });
    try {
      await api.staffCreateBlock(roomTypeId, {
        first_night: values.first_night,
        last_night: values.last_night,
        reason: values.reason.trim(),
      });
      setState({
        status: 'saved',
        message: null,
        saved: { nights, first: values.first_night, last: values.last_night },
      });
      blocks.reload();
    } catch (error) {
      setErrors(error.errors ?? {});
      setState({ status: 'failed', message: error.message, saved: null });
    }
  };

  if (blocks.failed) {
    return (
      <>
        <Topbar
          trail={[
            { label: 'Room Types', to: '/staff/room-types' },
            { label: 'Room type', to: `/staff/room-types/${roomTypeId}` },
            { label: 'Blocked dates', to: `/staff/room-types/${roomTypeId}/blocks` },
            { label: 'Block rooms' },
          ]}
          title="Block rooms"
          note="Nothing has been changed."
        />
        <Alert kind="error" title="This room type could not be loaded">
          {blocks.error.message} — nothing has been changed, and no night has been blocked.
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Link className="btn btn--primary btn--sm" to={`/staff/room-types/${roomTypeId}/blocks`}>Back to Blocked dates</Link>
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
          { label: 'Blocked dates', to: `/staff/room-types/${roomTypeId}/blocks` },
          { label: 'Block rooms' },
        ]}
        title="Block rooms"
        note={roomType
          ? `${roomType.name} · ${roomType.room_count} ${roomType.room_count === 1 ? 'room' : 'rooms'} · ${money(roomType.nightly_rate)} a night`
          : 'Loading this room type…'}
        actions={<Link className="btn btn--ghost" to={`/staff/room-types/${roomTypeId}`}>Back to room type</Link>}
      />

      {blocks.loading ? <LoadingBlock label="Loading this room type…" lines={3} /> : null}

      {blocks.ready ? (
        <div className="split">
          <div>
            <BlockForm
              values={values}
              onChange={change}
              errors={errors}
              nights={nights}
              roomTypeName={roomType?.name ?? 'this room type'}
              roomCount={roomType?.room_count ?? 0}
              saving={state.status === 'saving'}
              onSave={save}
            />

            {state.status === 'failed' && !Object.keys(errors).length ? (
              <Alert kind="error" title="The block could not be saved" style={{ marginTop: 'var(--space-5)' }}>
                {state.message} Those nights are still on sale.
                <div className="row" style={{ marginTop: 'var(--space-3)' }}>
                  <button className="btn btn--ghost btn--sm" type="button" onClick={save}>Retry</button>
                </div>
              </Alert>
            ) : null}

            {state.status === 'saved' && state.saved ? (
              <Alert kind="success" title="Block saved" style={{ marginTop: 'var(--space-5)' }}>
                {formatShortDate(state.saved.first).slice(4)} to {formatShortDate(state.saved.last).slice(4)},{' '}
                {state.saved.nights} {state.saved.nights === 1 ? 'night' : 'nights'}, are now off sale for{' '}
                {roomType?.name} and show on Blocked dates with who added the block and when.{' '}
                <Link to={`/staff/room-types/${roomTypeId}/blocks`}>See Blocked dates</Link>
              </Alert>
            ) : null}
          </div>

          <Panel as="aside" accent aria-labelledby="block-room-title">
            <h4>Room type</h4>
            <h3 id="block-room-title">{roomType?.name}</h3>
            <p className="small muted">
              {roomType?.room_count} {roomType?.room_count === 1 ? 'room' : 'rooms'} ·{' '}
              {money(roomType?.nightly_rate)} a night · {roomType?.on_sale ? 'On sale' : 'Off sale'}
            </p>
            <hr />
            <h4>While the block is in place</h4>
            <p>Those nights have one fewer room of {roomType?.name} to sell.</p>
            <p className="small muted">Nothing is refunded and no booking is moved — confirmed stays stay as they are.</p>
            <PlainList>
              <li><span>Rooms covered</span><b>{roomType?.room_count ?? 0}</b></li>
              <li><span>Nights you are blocking</span><b>{nights || '—'}</b></li>
              <li><span>Bookings already made</span><b>Left unchanged</b></li>
            </PlainList>
            <Link className="btn btn--ghost btn--block" to={`/staff/room-types/${roomTypeId}/blocks`}>
              Back to Blocked dates
            </Link>
          </Panel>
        </div>
      ) : null}
    </>
  );
}
