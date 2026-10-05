/**
 * One place that knows how to talk to the gateway.
 *
 * Relative URLs only: the gateway serves this bundle from its own origin, so an
 * absolute localhost URL would work in development and break everywhere else.
 * The session cookie rides along because same-origin requests send it, and a
 * refusal carries the gateway's own message so a page can show it as it is.
 */
export async function request(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch('/api/v1' + path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const text = await response.text();
  // A gateway that cannot reach a service answers 503 with JSON; a crashed one
  // can answer HTML. Parsing defensively keeps the real status in the error.
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  if (!response.ok) {
    const error = new Error(payload?.error ?? `Request failed (${response.status})`);
    error.status = response.status;
    error.code = payload?.code;
    error.errors = payload?.errors ?? null;
    error.payload = payload;
    throw error;
  }
  return payload;
}

/** One euro amount, formatted in one place. The nightly rate is the whole price. */
export function money(amount) {
  const value = Number(amount ?? 0);
  return `€${value.toFixed(2)}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** `Fri 12 June 2026` — the wording the prototype uses on every stay summary. */
export function formatDate(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];
  return `${weekday} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** `Fri 12 Jun → Mon 15 Jun 2026` */
export function formatRange(from, to) {
  const short = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];
    return `${weekday} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()].slice(0, 3)}`;
  };
  return `${short(from)} → ${short(to)} ${new Date(to).getUTCFullYear()}`;
}

/** `Wed 13 May` — one date, short, as the desk's lists write it. */
export function formatShortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];
  return `${weekday} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()].slice(0, 3)}`;
}

/** `Wed 13 – Fri 15 May · 2 nights` — how a stay reads in the desk's lists. */
export function formatStayRange(from, to, nights) {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—';
  const weekday = (date) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];
  const days = `${weekday(start)} ${start.getUTCDate()} – ${weekday(end)} ${end.getUTCDate()} ${MONTHS[end.getUTCMonth()].slice(0, 3)}`;
  const count = Number(nights ?? Math.round((end - start) / 86400000));
  return `${days} · ${count} ${count === 1 ? 'night' : 'nights'}`;
}

/** `14–16 May` — the short day span the desk's lists use. */
export function formatDaySpan(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—';
  const month = (date) => MONTHS[date.getUTCMonth()].slice(0, 3);
  if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${month(end)}`;
  }
  return `${start.getUTCDate()} ${month(start)} – ${end.getUTCDate()} ${month(end)}`;
}

/** `08:32` — the clock time something happened, in the desk's own day. */
export function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** `Tuesday 12 May 2026` — the day the desk is working. */
export function formatLongDate(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getUTCDay()];
  return `${weekday} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function nightsBetween(from, to) {
  const start = new Date(`${String(from).slice(0, 10)}T00:00:00.000Z`).getTime();
  const end = new Date(`${String(to).slice(0, 10)}T00:00:00.000Z`).getTime();
  return Math.max(0, Math.round((end - start) / 86400000));
}

/** `12 – 15 June 2026 · 3 nights · 2 guests` — the line above the results. */
export function stayLabel(checkIn, checkOut, guests) {
  const from = new Date(`${String(checkIn).slice(0, 10)}T00:00:00.000Z`);
  const to = new Date(`${String(checkOut).slice(0, 10)}T00:00:00.000Z`);
  const nights = nightsBetween(checkIn, checkOut);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || nights < 1) return 'Choose your dates';
  const month = MONTHS[to.getUTCMonth()];
  const sameMonth = from.getUTCMonth() === to.getUTCMonth() && from.getUTCFullYear() === to.getUTCFullYear();
  const dates = sameMonth
    ? `${from.getUTCDate()} – ${to.getUTCDate()} ${month} ${to.getUTCFullYear()}`
    : `${from.getUTCDate()} ${MONTHS[from.getUTCMonth()]} – ${to.getUTCDate()} ${month} ${to.getUTCFullYear()}`;
  return `${dates} · ${nights} ${nights === 1 ? 'night' : 'nights'} · ${guests} ${Number(guests) === 1 ? 'guest' : 'guests'}`;
}

/**
 * Uploading a room type photograph, with real progress.
 *
 * `fetch` cannot say how much of a body has been sent, and the desk watches a
 * photograph go up, so this one call uses XMLHttpRequest. The answer and the
 * error are shaped exactly like every other call in this file.
 */
export function uploadWithProgress(path, body, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/v1' + path);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let payload = null;
      try { payload = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { payload = null; }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload);
        return;
      }
      const error = new Error(payload?.error ?? `Request failed (${xhr.status})`);
      error.status = xhr.status;
      error.code = payload?.code;
      error.errors = payload?.errors ?? null;
      error.payload = payload;
      reject(error);
    };
    xhr.onerror = () => reject(new Error('The photograph could not be uploaded — check the connection and try again.'));
    xhr.send(JSON.stringify(body));
  });
}

/** One chosen file, read as base64, ready to be sent to the server. */
export function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('That photograph could not be read from this device.'));
    reader.readAsDataURL(file);
  });
}

const post = (path, body) => request(path, { method: 'POST', body });
const patch = (path, body) => request(path, { method: 'PATCH', body });

/** Every call the product makes, named after what it does. */
export const api = {
  // --- accounts and sessions ---
  session: () => request('/auth/session'),
  signIn: (email, password) => post('/auth/login', { email, password }),
  signOut: () => post('/auth/logout', {}),
  register: (body) => post('/auth/register', body),
  confirmEmail: (token) => post('/auth/confirm-email', { token }),
  resendConfirmation: (email) => post('/auth/resend-confirmation', { email }),
  setStaffPassword: (token, password) => post('/auth/staff/password-setup', { token, password }),

  // --- the guest site ---
  hotelDetails: () => request('/hotel-details'),
  roomTypes: () => request('/room-types'),
  roomType: (roomTypeId) => request(`/room-types/${roomTypeId}`),
  availability: ({ checkIn, checkOut, guests }) => request(
    `/availability?check_in=${encodeURIComponent(checkIn)}&check_out=${encodeURIComponent(checkOut)}&guests=${encodeURIComponent(guests)}`,
  ),

  // --- bookings ---
  createBooking: (body) => post('/bookings', body),
  myBookings: () => request('/bookings'),
  booking: (bookingId) => request(`/bookings/${bookingId}`),
  ownBookingByReference: (reference) => request(`/bookings/reference/${encodeURIComponent(reference)}`),
  openPayPalOrder: (bookingId) => post(`/bookings/${bookingId}/paypal-order`, {}),
  capturePayment: (bookingId, orderId) => post(`/bookings/${bookingId}/paypal-capture`, { order_id: orderId }),
  changeBooking: (bookingId, body) => patch(`/bookings/${bookingId}`, body),
  captureChange: (bookingId, orderId) => post(`/bookings/${bookingId}/change-capture`, { order_id: orderId }),
  cancelBooking: (bookingId) => post(`/bookings/${bookingId}/cancel`, {}),
  bookingByReference: (reference) => request(`/bookings/reference/${encodeURIComponent(reference)}/status`),

  // --- the guest's own account ---
  saveAccount: (body) => patch('/account', body),
  changePassword: (currentPassword, newPassword) => post('/account/password', {
    current_password: currentPassword, new_password: newPassword,
  }),
  deleteAccount: (password) => request('/account', { method: 'DELETE', body: { password } }),

  // --- the desk ---
  staffDashboard: () => request('/staff/dashboard'),
  staffBookings: (query = {}) => request(`/staff/bookings?${new URLSearchParams(query).toString()}`),
  staffBooking: (bookingId) => request(`/staff/bookings/${bookingId}`),
  staffCreateBooking: (body) => post('/staff/bookings', body),
  staffChangeBooking: (bookingId, body) => patch(`/staff/bookings/${bookingId}`, body),
  staffCancelBooking: (bookingId) => post(`/staff/bookings/${bookingId}/cancel`, {}),
  staffSendPaymentLink: (bookingId, email) => post(`/staff/bookings/${bookingId}/payment-link`, email ? { email } : {}),
  staffDifferenceLink: (bookingId) => post(`/staff/bookings/${bookingId}/difference-link`, {}),
  staffRoomTypes: () => request('/staff/room-types'),
  staffRoomType: (roomTypeId) => request(`/staff/room-types/${roomTypeId}`),
  staffCreateRoomType: (body) => post('/staff/room-types', body),
  staffUpdateRoomType: (roomTypeId, body) => patch(`/staff/room-types/${roomTypeId}`, body),
  staffUploadPhoto: (roomTypeId, body) => post(`/staff/room-types/${roomTypeId}/photos`, body),
  staffBlocks: (roomTypeId) => request(`/staff/room-types/${roomTypeId}/blocks`),
  staffCreateBlock: (roomTypeId, body) => post(`/staff/room-types/${roomTypeId}/blocks`, body),
  staffRemoveBlock: (roomTypeId, blockId) => request(`/staff/room-types/${roomTypeId}/blocks/${blockId}`, { method: 'DELETE' }),
  team: () => request('/staff/team'),
  addStaffMember: (body) => post('/staff/team', body),
  staffResendInvite: (memberId) => post(`/staff/team/${memberId}/invite`, {}),
  staffHotelDetails: () => request('/staff/hotel-details'),
  saveHotelDetails: (body) => request('/staff/hotel-details', { method: 'PUT', body }),
};
