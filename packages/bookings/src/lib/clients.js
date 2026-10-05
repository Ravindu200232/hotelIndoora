/**
 * The two services this one depends on, called over their internal doors.
 *
 * Room types, what is free and the hotel's details belong to the rooms service;
 * the guest's name, email and confirmation state belong to auth. Each call has a
 * timeout and a clear error, so a page can say what happened instead of showing
 * an empty answer as if it were true.
 */
async function get(config, baseUrl, path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(new URL(path, baseUrl), {
      headers: { 'x-internal-token': config.internalToken, accept: 'application/json' },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error ?? `the service answered ${response.status}`);
    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('the service did not answer in time');
    throw new Error(error.message);
  } finally {
    clearTimeout(timer);
  }
}

export async function roomTypeOf(config, roomTypeId) {
  const payload = await get(config, config.roomsUrl, `/internal/room-types/${roomTypeId}`);
  return payload.room_type;
}

export async function hotelDetailsOf(config) {
  const payload = await get(config, config.roomsUrl, '/internal/hotel-details');
  return payload.hotel_details;
}

/** A `Date` or a date string, as the `YYYY-MM-DD` a service can read back. */
const dayKey = (value) => (value instanceof Date
  ? value.toISOString().slice(0, 10)
  : String(value ?? '').slice(0, 10));

/** How many rooms of one room type are free on every night of a stay. */
export async function freeRoomsFor(config, { roomTypeId, checkIn, checkOut }) {
  const url = `/internal/availability?room_type_id=${encodeURIComponent(roomTypeId)}`
    + `&check_in=${encodeURIComponent(dayKey(checkIn))}`
    + `&check_out=${encodeURIComponent(dayKey(checkOut))}`;
  const payload = await get(config, config.roomsUrl, url);
  return { freeRooms: Number(payload.free_rooms ?? 0), nights: Number(payload.nights ?? 0) };
}

export async function guestOf(config, guestAccountId) {
  const payload = await get(config, config.authUrl, `/internal/guests/${guestAccountId}`);
  return payload.guest;
}
