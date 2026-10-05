import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { connectTestDb, clearCollections, closeTestDb, request } from 'testing';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { Booking } from '../src/models/Booking.js';
import { Payment } from '../src/models/Payment.js';
import { bookingChangedEmail } from '../src/lib/mailer.js';

/**
 * Moving a stay, and the money that follows it.
 *
 * A change to a cheaper stay is refunded at once; a change to a dearer one opens
 * a PayPal order for the difference, which only the guest can approve — so it is
 * handed back as a link, reused rather than reopened, and closed for good when
 * PayPal reports the capture. Nothing is ever reported as paid before PayPal says
 * so.
 */
const config = loadConfig({
  SESSION_SECRET: 'test-secret',
  ROOMS_URL: 'http://rooms.test',
  AUTH_URL: 'http://auth.test',
  EMAIL_API_KEY: 'test-mail-key',
  MAIL_FROM: 'stay@hotelindoora.com',
  PAYPAL_CLIENT_ID: 'client-id',
  PAYPAL_CLIENT_SECRET: 'client-secret',
  PAYPAL_WEBHOOK_ID: 'webhook-id',
});
const app = createApp(config);

const staff = { id: '507f1f77bcf86cd799439011', role: 'hotel_staff', name: 'Priya Raman' };
const guest = { id: '507f1f77bcf86cd799439012', role: 'guest', name: 'Marta Ferreira' };
const asStaff = (req) => req.set('x-user-id', staff.id).set('x-user-role', staff.role).set('x-user-name', staff.name);
const asGuest = (req) => req.set('x-user-id', guest.id).set('x-user-role', guest.role).set('x-user-name', guest.name);

const ROOM_TYPE_ID = '507f1f77bcf86cd799439021';
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const atMidnight = (iso) => new Date(`${iso}T00:00:00.000Z`);
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});
const APPROVE = 'https://paypal.test/checkoutnow?token=ORDER-1';

/** The rooms service, PayPal and the mail service, as the network sees them. */
function stubServices({ rate = 228.5, freeRooms = 3, verification = 'SUCCESS', calls = [] } = {}) {
  let orders = 0;
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url);
    calls.push({ url: target, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined });

    if (target.startsWith('http://rooms.test/internal/room-types/')) {
      return json({ room_type: { id: ROOM_TYPE_ID, name: 'Sea View King', nightly_rate: rate, room_count: 4, max_guests: 3, on_sale: true } });
    }
    if (target.startsWith('http://rooms.test/internal/availability')) return json({ free_rooms: freeRooms, nights: 3 });
    if (target.startsWith('http://rooms.test/internal/hotel-details')) {
      return json({ hotel_details: { hotel_name: 'hotelIndoora', address: '14 Harbour Lane, Kinsale', phone_number: '+353 21 477 0128', email_address: 'stay@hotelindoora.com', check_in_time: '15:00', check_out_time: '11:00', house_rules: '' } });
    }
    if (target.includes('/oauth2/token')) return json({ access_token: 'token' });
    if (target.includes('/v2/checkout/orders')) {
      orders += 1;
      return json({ id: `ORDER-${orders}`, status: 'CREATED', links: [{ rel: 'approve', href: APPROVE }] });
    }
    if (target.includes('/v2/payments/captures/') && target.includes('/refund')) return json({ id: 'REFUND-1', status: 'COMPLETED' });
    if (target.includes('/v1/notifications/verify-webhook-signature')) return json({ verification_status: verification });
    if (target.includes('api.resend.com')) return json({ id: 'mail-1' });
    return json({ error: 'nothing stubbed for this call' }, 404);
  };
  return { calls, orders: () => orders };
}

const confirmed = async (overrides = {}) => {
  const booking = await Booking.create({
    room_type_id: ROOM_TYPE_ID,
    check_in_date: atMidnight(day(10)),
    check_out_date: atMidnight(day(12)),
    nights: 2,
    nightly_rate: 180,
    total_price: 360,
    lead_guest_name: 'Marta Ferreira',
    guest_email: 'marta.ferreira@example.com',
    contact_phone: '+351 912 447 220',
    guest_count: 2,
    expected_arrival_time: '18:00',
    status: 'confirmed',
    booking_reference: 'HID-7742',
    booked_by_guest_account_id: guest.id,
    ...overrides,
  });
  await Payment.create({ booking_id: booking._id, paypal_transaction_id: 'CAPTURE-1', amount: 360, type: 'charge', status: 'completed' });
  return booking;
};

beforeAll(() => connectTestDb());
afterAll(() => closeTestDb());
beforeEach(() => clearCollections());
afterEach(() => { delete globalThis.fetch; });

describe('the difference a move settles', () => {
  it('refunds a cheaper stay at once, with a completed refund recorded', async () => {
    const booking = await confirmed();
    stubServices({ rate: 140 });

    const response = await asStaff(request(app).patch(`/v1/staff/bookings/${booking._id}`))
      .send({ check_in_date: day(15), check_out_date: day(17), room_type_id: ROOM_TYPE_ID })
      .expect(200);

    expect(response.body.settlement).toEqual({ direction: 'refund', amount: 80 });
    expect(response.body.booking.total_price).toBe(280);
    const refund = await Payment.findOne({ booking_id: booking._id, type: 'refund' });
    expect(refund).toMatchObject({ amount: 80, status: 'completed' });
    expect(response.body.mail.status).toBe('sent');
  });

  it('opens a PayPal order for a dearer stay and says the money is still to be approved', async () => {
    const booking = await confirmed();
    const stub = stubServices();

    const response = await asStaff(request(app).patch(`/v1/staff/bookings/${booking._id}`))
      .send({ check_in_date: day(15), check_out_date: day(18), room_type_id: ROOM_TYPE_ID })
      .expect(200);

    expect(response.body.settlement).toMatchObject({ direction: 'charge', amount: 325.5, pending: true, approve_url: APPROVE });
    expect(stub.orders()).toBe(1);

    // The stay has moved, and the difference is recorded as pending — not paid.
    const reloaded = await Booking.findById(booking._id);
    expect(reloaded.check_in_date.toISOString().slice(0, 10)).toBe(day(15));
    expect(reloaded.total_price).toBe(685.5);
    const pending = await Payment.findOne({ booking_id: booking._id, type: 'charge', status: 'pending' });
    expect(pending.amount).toBe(325.5);
    expect(pending.approve_url).toBe(APPROVE);

    const mail = stub.calls.find((call) => call.url.includes('api.resend.com'));
    expect(mail.body.html).toContain('is being charged through PayPal');
    expect(mail.body.html).not.toContain('was charged through PayPal');
  });

  it('hands back the same order when the change is pressed again, instead of opening a second one', async () => {
    const booking = await confirmed();
    const stub = stubServices();
    const body = { check_in_date: day(15), check_out_date: day(18), room_type_id: ROOM_TYPE_ID };

    await asStaff(request(app).patch(`/v1/staff/bookings/${booking._id}`)).send(body).expect(200);
    const again = await asStaff(request(app).patch(`/v1/staff/bookings/${booking._id}`)).send(body).expect(200);

    expect(stub.orders()).toBe(1);
    expect(again.body.settlement).toMatchObject({ direction: 'charge', amount: 325.5, approve_url: APPROVE, pending: true });
    expect(await Payment.countDocuments({ booking_id: booking._id, type: 'charge', status: 'pending' })).toBe(1);
  });

  it('refuses to move a cancelled booking, and refuses nights with no room free', async () => {
    const cancelled = await confirmed({ status: 'cancelled', booking_reference: 'HID-GONE' });
    stubServices();
    const refused = await asStaff(request(app).patch(`/v1/staff/bookings/${cancelled._id}`))
      .send({ check_in_date: day(15), check_out_date: day(18), room_type_id: ROOM_TYPE_ID }).expect(409);
    expect(refused.body.code).toBe('cancelled');

    const booking = await confirmed();
    stubServices({ freeRooms: 0 });
    const none = await asStaff(request(app).patch(`/v1/staff/bookings/${booking._id}`))
      .send({ check_in_date: day(15), check_out_date: day(18), room_type_id: ROOM_TYPE_ID }).expect(409);
    expect(none.body.code).toBe('no_room_free');
    expect((await Booking.findById(booking._id)).total_price).toBe(360);
  });

  it('emails the guest the difference link, and refuses when nothing is waiting to be paid', async () => {
    const booking = await confirmed();
    stubServices();
    const nothing = await asStaff(request(app).post(`/v1/staff/bookings/${booking._id}/difference-link`)).expect(409);
    expect(nothing.body.code).toBe('nothing_waiting');

    const stub = stubServices();
    await asStaff(request(app).patch(`/v1/staff/bookings/${booking._id}`))
      .send({ check_in_date: day(15), check_out_date: day(18), room_type_id: ROOM_TYPE_ID }).expect(200);
    const sent = await asStaff(request(app).post(`/v1/staff/bookings/${booking._id}/difference-link`)).expect(200);

    expect(sent.body).toMatchObject({ amount: 325.5, difference_link: APPROVE });
    expect(sent.body.mail.status).toBe('sent');
    const mail = stub.calls.filter((call) => call.url.includes('api.resend.com')).pop();
    expect(mail.body.subject).toContain('€325.50');
  });
});

describe('the guest moving their own booking', () => {
  it('refuses a booking that is not the caller\'s own, and answers 404 rather than telling them it exists', async () => {
    const booking = await confirmed({ booked_by_guest_account_id: '507f1f77bcf86cd799439099' });
    stubServices();
    await asGuest(request(app).patch(`/v1/bookings/${booking._id}`))
      .send({ check_in_date: day(15), check_out_date: day(18), room_type_id: ROOM_TYPE_ID }).expect(404);
  });

  it('collects the difference the guest approved at PayPal and closes the pending payment', async () => {
    const booking = await confirmed();
    stubServices();
    await asGuest(request(app).patch(`/v1/bookings/${booking._id}`))
      .send({ check_in_date: day(15), check_out_date: day(18), room_type_id: ROOM_TYPE_ID }).expect(200);

    globalThis.fetch = async (url) => {
      if (String(url).includes('/oauth2/token')) return json({ access_token: 'token' });
      if (String(url).includes('/capture')) {
        return json({
          id: 'ORDER-1',
          status: 'COMPLETED',
          purchase_units: [{ payments: { captures: [{ id: 'CAPTURE-DIFF', status: 'COMPLETED', amount: { value: '325.50' } }] } }],
        });
      }
      return json({ error: 'nothing stubbed' }, 404);
    };

    const response = await asGuest(request(app).post(`/v1/bookings/${booking._id}/change-capture`))
      .send({ order_id: 'ORDER-1' }).expect(200);

    expect(response.body.settlement).toMatchObject({ direction: 'charge', amount: 325.5, status: 'completed' });
    const settled = await Payment.findOne({ booking_id: booking._id, type: 'charge', status: 'completed', amount: 325.5 });
    expect(settled.paypal_transaction_id).toBe('CAPTURE-DIFF');
    expect((await Booking.findById(booking._id)).status).toBe('confirmed');
  });

  it('refuses to collect an order that is not waiting on the booking', async () => {
    const booking = await confirmed();
    stubServices();
    const response = await asGuest(request(app).post(`/v1/bookings/${booking._id}/change-capture`))
      .send({ order_id: 'ORDER-NOT-OURS' }).expect(409);
    expect(response.body.code).toBe('not_waiting');
  });
});

describe('PayPal reporting a payment', () => {
  const notify = (event) => request(app)
    .post('/v1/paypal/webhook')
    .set('paypal-auth-algo', 'SHA256withRSA')
    .set('paypal-cert-url', 'https://paypal.test/cert')
    .set('paypal-transmission-id', 'transmission-1')
    .set('paypal-transmission-sig', 'signature')
    .set('paypal-transmission-time', new Date().toISOString())
    .send(event);

  it('closes a pending difference, rather than being discarded', async () => {
    const booking = await confirmed();
    stubServices();
    await asStaff(request(app).patch(`/v1/staff/bookings/${booking._id}`))
      .send({ check_in_date: day(15), check_out_date: day(18), room_type_id: ROOM_TYPE_ID }).expect(200);

    globalThis.fetch = async (url) => {
      if (String(url).includes('/oauth2/token')) return json({ access_token: 'token' });
      if (String(url).includes('verify-webhook-signature')) return json({ verification_status: 'SUCCESS' });
      return json({ error: 'nothing stubbed' }, 404);
    };

    const response = await notify({
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: 'CAPTURE-DIFF',
        custom_id: String(booking._id),
        amount: { value: '325.50' },
        supplementary_data: { related_ids: { order_id: 'ORDER-1' } },
      },
    }).expect(200);

    expect(response.body).toMatchObject({ handled: true, difference_settled: true });
    const settled = await Payment.findOne({ booking_id: booking._id, amount: 325.5 });
    expect(settled).toMatchObject({ status: 'completed', paypal_transaction_id: 'CAPTURE-DIFF' });
  });

  it('refuses a notification it cannot prove came from PayPal, and changes nothing', async () => {
    const booking = await confirmed();
    globalThis.fetch = async (url) => {
      if (String(url).includes('/oauth2/token')) return json({ access_token: 'token' });
      if (String(url).includes('verify-webhook-signature')) return json({ verification_status: 'FAILURE' });
      return json({ error: 'nothing stubbed' }, 404);
    };

    const response = await notify({
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: { id: 'CAPTURE-X', custom_id: String(booking._id), amount: { value: '360.00' } },
    }).expect(400);

    expect(response.body.code).toBe('unverified');
    expect(await Payment.countDocuments({ booking_id: booking._id, status: 'completed' })).toBe(1);
  });

  it('leaves an event it has nothing to do with alone', async () => {
    stubServices();
    const response = await notify({ event_type: 'BILLING.SUBSCRIPTION.CREATED', resource: {} }).expect(200);
    expect(response.body).toEqual({ handled: false, reason: 'nothing to do for BILLING.SUBSCRIPTION.CREATED' });
  });
});

describe('what the change email says', () => {
  const hotel = { hotel_name: 'hotelIndoora', address: '14 Harbour Lane, Kinsale', phone_number: '+353 21 477 0128', email_address: 'stay@hotelindoora.com', check_in_time: '15:00', check_out_time: '11:00' };
  const booking = { booking_reference: 'HID-7742', check_in_date: new Date('2099-06-12'), check_out_date: new Date('2099-06-14'), nights: 2, total_price: 685.5 };

  it('says a difference is being charged while it waits, and charged once it is paid', () => {
    const pending = bookingChangedEmail({ hotel, booking, roomType: { name: 'Sea View King' }, settled: { direction: 'charge', amount: 325.5, pending: true } });
    expect(pending.html).toContain('€325.50 is being charged through PayPal');

    const settled = bookingChangedEmail({ hotel, booking, roomType: { name: 'Sea View King' }, settled: { direction: 'charge', amount: 325.5 } });
    expect(settled.html).toContain('€325.50 was charged through PayPal');

    const refunded = bookingChangedEmail({ hotel, booking, roomType: { name: 'Sea View King' }, settled: { direction: 'refund', amount: 60 } });
    expect(refunded.html).toContain('€60.00 was refunded to you through PayPal');
  });
});
