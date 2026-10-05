/**
 * The staff move, driven over HTTP exactly as the page drives it: sign in, find a
 * paid confirmation, then move it to the same nights and room type.
 *
 * Run through the project's own runner, which owns the server and the database:
 *   node scripts/with-server.mjs -- node scripts/check-staff-move.mjs
 */
const base = process.env.BASE_URL ?? 'http://127.0.0.1:4000'

const call = async (path, { method = 'GET', body, cookie } = {}) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* not JSON */ }
  return { status: response.status, body: json, cookie: response.headers.get('set-cookie') }
}

const waitForServices = async () => {
  const deadline = Date.now() + 60000
  while (Date.now() < deadline) {
    const probe = await fetch(`${base}/api/v1/room-types`).then((r) => r.status).catch(() => 0)
    if (probe === 200) return true
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

console.log('services ready:', await waitForServices())

const signIn = await call('/api/v1/auth/login', {
  method: 'POST',
  body: { email: 'hotel.staff@example.com', password: 'Demo!2026' },
})
console.log('sign in:', signIn.status)
const cookie = String(signIn.cookie ?? '').split(';')[0]

const list = await call('/api/v1/staff/bookings?status=confirmed', { cookie })
console.log('confirmed bookings:', list.status, '·', list.body?.total ?? 'no total')

const booking = (list.body?.bookings ?? []).find((one) => (one.payments ?? []).some((p) => p.type === 'charge' && p.status === 'completed'))
console.log('moving:', booking?.booking_reference, '·', booking?.nights, 'nights ·', booking?.nightly_rate, 'a night · paid', booking?.payments?.find((p) => p.type === 'charge')?.amount)

if (booking) {
  const checkIn = new Date(new Date(booking.check_in_date).getTime() + 7 * 86400000).toISOString().slice(0, 10)
  const checkOut = new Date(new Date(booking.check_out_date).getTime() + 7 * 86400000).toISOString().slice(0, 10)
  const moved = await call(`/api/v1/staff/bookings/${booking.id}`, {
    method: 'PATCH',
    cookie,
    body: { check_in_date: checkIn, check_out_date: checkOut, room_type_id: booking.room_type_id },
  })
  console.log('move:', moved.status, JSON.stringify(moved.body).slice(0, 400))
}

// The booking the desk's journey uses: HID-5001, arriving today.
const today = (list.body?.bookings ?? []).find((one) => one.booking_reference === 'HID-5001')
console.log('today\'s booked stay:', today?.booking_reference, today?.check_in_date, '·', today?.nights, 'nights · paid', today?.payments?.find((p) => p.type === 'charge')?.amount)
if (today) {
  const checkIn = new Date(new Date(today.check_in_date).getTime() + 7 * 86400000).toISOString().slice(0, 10)
  const checkOut = new Date(new Date(today.check_out_date).getTime() + 7 * 86400000).toISOString().slice(0, 10)
  const moved = await call(`/api/v1/staff/bookings/${today.id}`, {
    method: 'PATCH',
    cookie,
    body: { check_in_date: checkIn, check_out_date: checkOut, room_type_id: today.room_type_id },
  })
  console.log('move today:', moved.status, JSON.stringify(moved.body).slice(0, 500))
}
