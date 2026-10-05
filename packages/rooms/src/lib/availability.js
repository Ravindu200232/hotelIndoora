/**
 * What is free, and what it costs.
 *
 * A night is counted from the check-in date up to and not including the
 * check-out date. For each night, free rooms are the room type's number of
 * rooms, less the rooms booked for that night and the rooms blocked for it -
 * and never below zero. A room type is offered only when it is on sale, it
 * sleeps the party, and at least one room is free on every night of the stay.
 *
 * Pure functions on purpose: this is the rule the whole site depends on, so it
 * is testable without a database, a server or a browser.
 */
export const DAY_MS = 86400000;

/** `2026-06-12` for the night that a date belongs to. */
export function dayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

export function nightKeys(checkIn, checkOut) {
  const start = new Date(`${dayKey(checkIn)}T00:00:00.000Z`).getTime();
  const end = new Date(`${dayKey(checkOut)}T00:00:00.000Z`).getTime();
  const keys = [];
  for (let at = start; at < end; at += DAY_MS) keys.push(dayKey(new Date(at)));
  return keys;
}

export function nights(checkIn, checkOut) {
  return nightKeys(checkIn, checkOut).length;
}

/** A block covers every night from its first to its last, both included. */
export function countBlockedNights(blocks) {
  const counts = new Map();
  for (const block of blocks) {
    for (const key of nightKeys(block.first_night, new Date(new Date(block.last_night).getTime() + DAY_MS))) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

/** booked is a Map of `roomTypeId` -> Map(dayKey -> count). */
export function freePerNight(roomType, booked, blocked, keys) {
  const perRoomType = booked?.get(String(roomType.id)) ?? booked?.get(String(roomType._id)) ?? new Map();
  return keys.map((key) => {
    const count = Number(roomType.room_count ?? 0) - (perRoomType.get(key) ?? 0) - (blocked.get(key) ?? 0);
    return Math.max(0, count);
  });
}

/**
 * The room types free for the chosen nights, each with its nightly rate and the
 * total for the stay.
 */
export function availabilityFor(roomTypes, { checkIn, checkOut, guests, booked, blocks }) {
  const keys = nightKeys(checkIn, checkOut);
  const stay = keys.length;
  const results = [];
  for (const roomType of roomTypes) {
    if (!roomType.on_sale) continue;
    if (Number(roomType.max_guests ?? 0) < Number(guests ?? 1)) continue;
    const blocked = countBlockedNights((blocks ?? []).filter(
      (block) => String(block.room_type_id) === String(roomType.id ?? roomType._id),
    ));
    const free = freePerNight(roomType, booked, blocked, keys);
    const freeRooms = free.length ? Math.min(...free) : 0;
    if (freeRooms < 1) continue;
    results.push({
      room_type_id: String(roomType.id ?? roomType._id),
      name: roomType.name,
      nightly_rate: Number(roomType.nightly_rate),
      max_guests: Number(roomType.max_guests),
      room_count: Number(roomType.room_count),
      free_rooms: freeRooms,
      nights: stay,
      total: Number((Number(roomType.nightly_rate) * stay).toFixed(2)),
    });
  }
  return { nights: stay, nights_keys: keys, room_types: results };
}
