import { Stat, Stats } from '../index.jsx';
import { formatShortDate } from '../../api.js';

const nightsOf = (block) => Number(block.nights ?? 0);
const dayOf = (value) => String(value).slice(0, 10);
const todayIso = () => new Date().toISOString().slice(0, 10);

/** The ranges still to come, earliest first. */
export function blocksAhead(blocks = []) {
  return [...blocks]
    .filter((block) => dayOf(block.last_night) >= todayIso())
    .sort((a, b) => new Date(a.first_night) - new Date(b.first_night));
}

/**
 * Four figures about the nights this room type is out of service: how many
 * ranges are still to come, how many nights they cover, when the next one starts,
 * and how many rooms stay on sale for the nights that are not blocked.
 */
export function BlockedStats({ blocks = [], roomType }) {
  const ahead = blocksAhead(blocks);
  const nights = ahead.reduce((sum, block) => sum + nightsOf(block), 0);
  const next = ahead[0] ?? null;

  return (
    <Stats>
      <Stat label="Ranges blocked ahead" value={ahead.length} />
      <Stat label="Nights out of service" value={nights} foot={ahead.length ? `across ${ahead.length} ${ahead.length === 1 ? 'range' : 'ranges'}` : 'none ahead'} />
      <Stat
        accent
        label="Next night off sale"
        value={<span style={{ fontSize: 'var(--text-lg)' }}>{next ? formatShortDate(next.first_night).slice(4) : 'None ahead'}</span>}
      />
      <Stat
        label="Rooms still on sale"
        value={roomType?.room_count ?? 0}
        foot="for the nights not blocked"
      />
    </Stats>
  );
}
