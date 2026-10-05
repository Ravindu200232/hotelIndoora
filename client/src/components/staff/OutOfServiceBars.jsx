import { BarTrack, Panel } from '../index.jsx';
import { blocksAhead } from './BlockedStats.jsx';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = MONTHS.map((month) => month.slice(0, 3));
const dayOf = (value) => String(value).slice(0, 10);

/** Every night each range covers, as `YYYY-MM-DD` keys. */
function nightsBetween(first, last) {
  const nights = [];
  const start = new Date(`${dayOf(first)}T00:00:00.000Z`);
  const end = new Date(`${dayOf(last)}T00:00:00.000Z`);
  for (let time = start.getTime(); time <= end.getTime(); time += 86400000) {
    nights.push(new Date(time).toISOString().slice(0, 10));
  }
  return nights;
}

/**
 * The months ahead with the nights each one loses to a block, so the desk can see
 * at a glance how far this room type is out of service.
 *
 * The track runs from the month the first block falls in to the month the last
 * one ends in — a month with nothing blocked shows as a short track, which means
 * every room of the type is on sale for it.
 */
export function OutOfServiceBars({ blocks = [] }) {
  const ahead = blocksAhead(blocks);
  const first = ahead[0] ? new Date(`${dayOf(ahead[0].first_night)}T00:00:00.000Z`) : null;
  const last = ahead.length ? new Date(`${dayOf(ahead[ahead.length - 1].last_night)}T00:00:00.000Z`) : null;

  if (!first || !last) {
    return (
      <Panel style={{ marginTop: 'var(--space-6)' }}>
        <h2 id="track-title">Nights out of service</h2>
        <p className="small muted" style={{ margin: 0 }}>
          No months ahead have blocked nights on this room type, so every room is on sale for every night.
        </p>
      </Panel>
    );
  }

  const counts = new Map();
  for (const block of ahead) {
    for (const night of nightsBetween(block.first_night, block.last_night)) {
      const key = night.slice(0, 7);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const bars = [];
  const cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1));
  while (cursor.getTime() <= last.getTime()) {
    const key = cursor.toISOString().slice(0, 7);
    const nights = counts.get(key) ?? 0;
    bars.push({ label: SHORT[cursor.getUTCMonth()], nights, outOfService: nights > 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  // Eight pixels for a month with nothing blocked, and a real bar for the rest:
  // proportional to the busiest month, so the shape follows the data.
  const busiest = Math.max(...bars.map((bar) => bar.nights), 1);
  for (const bar of bars) {
    bar.height = bar.nights ? Math.round(24 + (bar.nights / busiest) * 126) : 8;
  }

  const total = bars.reduce((sum, bar) => sum + bar.nights, 0);
  const span = `${MONTHS[first.getUTCMonth()]} – ${MONTHS[last.getUTCMonth()]} ${last.getUTCFullYear()}`;

  return (
    <Panel style={{ marginTop: 'var(--space-6)' }}>
      <h2 id="track-title">Nights out of service, {span}</h2>
      <BarTrack bars={bars} />
      <p className="small muted">
        A solid bar means those nights are out of service for the room type. A short track means every room of the type
        is on sale. {total} {total === 1 ? 'night' : 'nights'} out of service across {ahead.length}{' '}
        {ahead.length === 1 ? 'range' : 'ranges'}.
      </p>
    </Panel>
  );
}
