/**
 * Availability needs what is booked, and bookings belong to the bookings
 * service. This asks for the counts instead of reading another service's data.
 *
 * A service that is slow or down is a clear failure here, so the page can say
 * what happened rather than showing an empty list as if nothing were free.
 */
export async function fetchBookedCounts({ roomTypeIds, checkIn, checkOut }, config) {
  const url = new URL('/internal/booked-counts', config.bookingsUrl);
  url.searchParams.set('check_in', checkIn);
  url.searchParams.set('check_out', checkOut);
  if (roomTypeIds?.length) url.searchParams.set('room_type_ids', roomTypeIds.join(','));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      headers: { 'x-internal-token': config.internalToken, accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`The bookings service answered ${response.status}`);
    const payload = await response.json();
    // { room_type_id, night, rooms }[] -> Map(roomTypeId -> Map(night -> rooms))
    const booked = new Map();
    for (const row of payload.counts ?? []) {
      const key = String(row.room_type_id);
      if (!booked.has(key)) booked.set(key, new Map());
      booked.get(key).set(String(row.night), Number(row.rooms));
    }
    return booked;
  } catch (error) {
    throw new Error(`Availability could not be worked out: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }
}
