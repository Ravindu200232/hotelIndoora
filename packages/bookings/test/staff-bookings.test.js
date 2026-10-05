import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { connectTestDb, clearCollections, closeTestDb, request } from 'testing';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { Booking } from '../src/models/Booking.js';
import { Payment } from '../src/models/Payment.js';

/**
 * The desk's own handlers: the dashboard, the search over every booking, taking a
 * booking for a guest who phoned, and cancelling one — paid or never paid.
 *
 * The rooms and auth services and PayPal are stood in at the network boundary, so
 * what is under test is this service's own decisions.
 */
const config = loadConfig({
  SESSION_SECRET: 'test-secret',
  ROOMS_URL: 'http://rooms.test',
  AUTH_URL: 'http://auth.test',
  EMAIL_API_KEY: 'test-mail-key',
  MAIL_FROM: 'stay@hotelindoora.com',
  PAYPAL_CLIENT_ID: 'client-id',
  PAYPAL_CLIENT_SECRET: 'client-secret',
});
const app = createApp(config);

const staff = { id: '507f1f77bcf86cd799439011', role: 'hotel_staff', name: 'Priya Raman' };
const asStaff = (req) => req
  .set('x-user-id', staff.id).set('x-user-role', staff.role).set('x-user-name', staff.name);

const ROOM_TYPE_ID = '507f1f77bcf86cd799439021';
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const atMidnight = (iso) => new Date(`${iso}T00:00:00.000Z`);

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});

/** The rooms service, PayPal and the mail service, as the network sees them. */
function stubServices({ freeRooms = 3, onSale = true, mailStatus = 200, refundStatus = 'COMPLETED', calls = [] } = {}) {
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url);
    calls.push({ url: target, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined });

    if (target.startsWith('http://rooms.test/internal/room-types/')) {
      return json({
        room_type: {
          id: ROOM_TYPE_ID,
          name: 'Garden Double',
          nightly_rate: 180,
          room_count: 6,
          max_guests: 3,
          on_sale: onSale,
        },
      });
    }
    if (target.startsWith('http://rooms.test/internal/availability')) {
      return json({ free_rooms: freeRooms, nights: 3 });
    }
    if (target.startsWith('http://rooms.test/internal/hotel-details')) {
      return json({
        hotel_details: {
          hotel_name: 'hotelIndoora',
          address: '14 Harbour Lane, Kinsale, Co. Cork, Ireland',
          phone_number: '+353 21 477 0128',
          email_address: 'stay@hotelindoora.com',
          check_in_time: '15:00',
          check_out_time: '11:00',
          house_rules: 'No smoking indoors.',
        },
      });
    }
    if (target.includes('/oauth2/token')) return json({ access_token: 'token' });
    if (target.includes('/v2/checkout/orders')) {
      return json({ id: 'ORDER-1', status: 'CREATED', links: [{ rel: 'approve', href: 'https://paypal.test/checkoutnow?token=ORDER-1' }] });
    }
    if (target.includes('/v2/payments/captures/') && target.includes('/refund')) {
      return json({ id: 'REFUND-1', status: refundStatus });
    }
    if (target.includes('api.resend.com')) {
      return mailStatus === 200
        ? json({ id: 'mail-1' })
        : json({ message: 'the address was rejected' }, mailStatus);
    }
    return json({ error: 'nothing stubbed for this call' }, 404);
  };
  return calls;
}

const bookingBody = (overrides = {}) => ({
  room_type_id: ROOM_TYPE_ID,
  check_in_date: atMidnight(day(2)),
  check_out_date: atMidnight(day(5)),
  nights: 3,
  nightly_rate: 180,
  total_price: 540,
  lead_guest_name: 'Aoife Brennan',
  guest_email: 'aoife.brennan@example.com',
  contact_phone: '+353 87 331 9046',
  guest_count: 2,
  expected_arrival_time: '17:00',
  status: 'confirmed',
  booking_reference: 'HID-5045',
  booked_by_staff_account_id: staff.id,
  booked_by_staff_name: staff.name,
  ...overrides,
});

beforeAll(() => connectTestDb());
afterAll(() => closeTestDb());
beforeEach(() => clearCollections());
afterEach(() => { delete globalThis.fetch; });

describe('the day at the desk', () => {
  it('answers with today\'s arrivals and departures, what is coming up, and what is waiting to be paid for', async () => {
    await Booking.create(bookingBody({ booking_reference: 'HID-A', check_in_date: atMidnight(day(0)), check_out_date: atMidnight(day(2)) }));
    await Booking.create(bookingBody({ booking_reference: 'HID-B', check_in_date: atMidnight(day(-2)), check_out_date: atMidnight(day(0)) }));
    await Booking.create(bookingBody({ booking_reference: 'HID-C', check_in_date: atMidnight(day(4)), check_out_date: atMidnight(day(6)) }));
    await Booking.create(bookingBody({ booking_reference: 'HID-D', status: 'pending_payment' }));
    await Booking.create(bookingBody({ booking_reference: 'HID-E', status: 'cancelled', check_in_date: atMidnight(day(0)), check_out_date: atMidnight(day(1)) }));

    const response = await asStaff(request(app).get('/v1/staff/dashboard')).expect(200);
    const references = (list) => list.map((booking) => booking.booking_reference).sort();

    expect(response.body.today).toBe(day(0));
    expect(references(response.body.arrivals)).toEqual(['HID-A']);
    expect(references(response.body.departures)).toEqual(['HID-B']);
    expect(references(response.body.upcoming)).toEqual(['HID-C']);
    expect(references(response.body.waiting_for_payment)).toEqual(['HID-D']);
  });

  it('needs a staff caller', async () => {
    await request(app).get('/v1/staff/dashboard').expect(401);
    await request(app).get('/v1/staff/dashboard').set('x-user-id', 'x').set('x-user-role', 'guest').expect(403);
  });
});

describe('finding a booking', () => {
  const seed = async () => {
    await Booking.create(bookingBody({ booking_reference: 'HID-1', lead_guest_name: 'Niamh Kelleher', check_in_date: atMidnight(day(1)), check_out_date: atMidnight(day(3)) }));
    await Booking.create(bookingBody({ booking_reference: 'HID-2', lead_guest_name: 'Mark Whelan', status: 'pending_payment', check_in_date: atMidnight(day(10)), check_out_date: atMidnight(day(13)) }));
    await Booking.create(bookingBody({ booking_reference: 'HID-3', lead_guest_name: 'Ruth Adeyemi', status: 'cancelled', check_in_date: atMidnight(day(20)), check_out_date: atMidnight(day(22)) }));
  };

  it('answers the desk\'s word for a status, and the guest\'s name however it is typed', async () => {
    await seed();

    const waiting = await asStaff(request(app).get('/v1/staff/bookings?status=pending_payment')).expect(200);
    expect(waiting.body.bookings.map((b) => b.booking_reference)).toEqual(['HID-2']);

    const byName = await asStaff(request(app).get('/v1/staff/bookings?guest=kelleher')).expect(200);
    expect(byName.body.bookings.map((b) => b.booking_reference)).toEqual(['HID-1']);

    const all = await asStaff(request(app).get('/v1/staff/bookings?status=any')).expect(200);
    expect(all.body.total).toBe(3);
  });

  it('finds the bookings that stand on the nights asked for, and pages 25 at a time', async () => {
    await seed();
    for (let index = 0; index < 27; index += 1) {
      await Booking.create(bookingBody({
        booking_reference: `HID-P${String(index).padStart(2, '0')}`,
        check_in_date: atMidnight(day(40 + index)),
        check_out_date: atMidnight(day(42 + index)),
      }));
    }

    const one = await asStaff(request(app).get('/v1/staff/bookings')).expect(200);
    expect(one.body.total).toBe(30);
    expect(one.body.per_page).toBe(25);
    expect(one.body.pages).toBe(2);
    expect(one.body.bookings).toHaveLength(25);

    const two = await asStaff(request(app).get('/v1/staff/bookings?page=2')).expect(200);
    expect(two.body.page).toBe(2);
    expect(two.body.bookings).toHaveLength(5);

    const window = await asStaff(request(app).get(`/v1/staff/bookings?check_in=${day(40)}&check_out=${day(43)}`)).expect(200);
    expect(window.body.bookings.map((b) => b.booking_reference)).toEqual(['HID-P00', 'HID-P01', 'HID-P02']);
  });

  it('shows a booking in full with every payment against it, and 404 for one that is not ours', async () => {
    await seed();
    const booking = await Booking.findOne({ booking_reference: 'HID-1' });
    await Payment.create({ booking_id: booking._id, paypal_transaction_id: 'CAPTURE-1', amount: 540, type: 'charge', status: 'completed' });

    const response = await asStaff(request(app).get(`/v1/staff/bookings/${booking._id}`)).expect(200);
    expect(response.body.booking.booking_reference).toBe('HID-1');
    expect(response.body.booking.payments).toHaveLength(1);
    expect(response.body.booking.payments[0]).toMatchObject({ amount: 540, type: 'charge', status: 'completed' });

    await asStaff(request(app).get('/v1/staff/bookings/507f1f77bcf86cd799439099')).expect(404);
  });
});

describe('taking a booking for a guest who phoned', () => {
  const body = {
    room_type_id: ROOM_TYPE_ID,
    check_in_date: day(2),
    check_out_date: day(5),
    lead_guest_name: 'Ilse Brandt',
    guest_email: 'ilse.brandt@example.com',
    contact_phone: '+49 171 555 0142',
    guest_count: 3,
    expected_arrival_time: '15:30',
    special_requests: 'Travelling with a small dog.',
  };

  it('books it, prices it from the room type, and gives it a reference the desk can read out', async () => {
    stubServices();

    const response = await asStaff(request(app).post('/v1/staff/bookings')).send(body).expect(201);
    const booking = response.body.booking;

    expect(booking.status).toBe('pending_payment');
    expect(booking.nights).toBe(3);
    expect(booking.nightly_rate).toBe(180);
    expect(booking.total_price).toBe(540);
    expect(booking.booking_reference).toMatch(/^HID-[A-Z0-9]{6}$/);
    expect(booking.booked_by).toBe('staff');
    expect(booking.booked_by_staff_name).toBe('Priya Raman');
    expect(booking.hold_expires_at).toBe(null);
    expect(response.body.mail.status).toBe('sent');
  });

  it('refuses a bad address, a bad phone number and a party the room type cannot take', async () => {
    stubServices();

    const badEmail = await asStaff(request(app).post('/v1/staff/bookings'))
      .send({ ...body, guest_email: 'ilse@' }).expect(400);
    expect(badEmail.body.errors.guest_email).toContain('correct format');

    const badPhone = await asStaff(request(app).post('/v1/staff/bookings'))
      .send({ ...body, contact_phone: 'call me' }).expect(400);
    expect(badPhone.body.errors.contact_phone).toContain('digits');

    const tooMany = await asStaff(request(app).post('/v1/staff/bookings'))
      .send({ ...body, guest_count: 4 }).expect(400);
    expect(tooMany.body.errors.guest_count).toContain('up to 3 guests');

    expect(await Booking.countDocuments()).toBe(0);
  });

  it('refuses dates in the past, a room type that is off sale, and nights with no room free', async () => {
    stubServices();
    const past = await asStaff(request(app).post('/v1/staff/bookings'))
      .send({ ...body, check_in_date: day(-3), check_out_date: day(-1) }).expect(400);
    expect(past.body.errors.check_in_date).toContain('from today onwards');

    stubServices({ onSale: false });
    await asStaff(request(app).post('/v1/staff/bookings')).send(body).expect(409);

    stubServices({ freeRooms: 0 });
    const none = await asStaff(request(app).post('/v1/staff/bookings')).send(body).expect(409);
    expect(none.body.code).toBe('no_room_free');
    expect(await Booking.countDocuments()).toBe(0);
  });

  it('needs a staff caller', async () => {
    stubServices();
    await request(app).post('/v1/staff/bookings').send(body).expect(401);
  });
});

describe('cancelling for the desk', () => {
  const withCharge = async (overrides = {}) => {
    const booking = await Booking.create(bookingBody(overrides));
    await Payment.create({ booking_id: booking._id, paypal_transaction_id: 'CAPTURE-1', amount: 540, type: 'charge', status: 'completed' });
    return booking;
  };

  it('refunds the whole amount, marks it cancelled and emails the guest', async () => {
    const booking = await withCharge();
    const calls = stubServices();

    const response = await asStaff(request(app).post(`/v1/staff/bookings/${booking._id}/cancel`)).expect(200);

    expect(response.body.refund).toEqual({ amount: 540, status: 'completed' });
    expect(response.body.booking.status).toBe('cancelled');
    expect(response.body.mail.status).toBe('sent');
    const refund = await Payment.findOne({ booking_id: booking._id, type: 'refund' });
    expect(refund.amount).toBe(540);
    expect(refund.status).toBe('completed');
    expect(calls.some((call) => call.url.includes('api.resend.com'))).toBe(true);
  });

  it('keeps the booking confirmed and refunds nothing when PayPal refuses', async () => {
    const booking = await withCharge();
    globalThis.fetch = async (url) => {
      if (String(url).includes('/oauth2/token')) return json({ access_token: 'token' });
      if (String(url).includes('/refund')) return json({ message: 'CAPTURE_FULLY_REFUNDED' }, 422);
      return json({ hotel_details: {} });
    };

    const response = await asStaff(request(app).post(`/v1/staff/bookings/${booking._id}/cancel`)).expect(502);
    expect(response.body.code).toBe('refund_failed');
    expect((await Booking.findById(booking._id)).status).toBe('confirmed');
    expect(await Payment.countDocuments({ booking_id: booking._id, type: 'refund' })).toBe(0);
  });

  it('cancels a booking nobody paid for, with nothing to refund and the room freed', async () => {
    const booking = await Booking.create(bookingBody({ status: 'pending_payment', hold_expires_at: new Date(Date.now() + 60000) }));
    stubServices();

    const response = await asStaff(request(app).post(`/v1/staff/bookings/${booking._id}/cancel`)).expect(200);
    expect(response.body.refund).toBe(null);
    expect(response.body.booking.status).toBe('cancelled');
    expect(response.body.booking.hold_expires_at).toBe(null);
    expect(await Payment.countDocuments({ booking_id: booking._id })).toBe(0);
  });

  it('refuses to cancel one that is already cancelled', async () => {
    const booking = await Booking.create(bookingBody({ status: 'cancelled' }));
    stubServices();
    const response = await asStaff(request(app).post(`/v1/staff/bookings/${booking._id}/cancel`)).expect(409);
    expect(response.body.code).toBe('cancelled');
  });
});

describe('sending the payment link', () => {
  it('corrects the address as it sends, and records that the link went out', async () => {
    const booking = await Booking.create(bookingBody({ status: 'pending_payment', guest_email: 'wrong@example.com' }));
    const calls = stubServices();

    const response = await asStaff(request(app).post(`/v1/staff/bookings/${booking._id}/payment-link`))
      .send({ email: 'Aoife.Brennan@Example.com' })
      .expect(200);

    expect(response.body.mail.status).toBe('sent');
    expect(response.body.payment_link).toContain('paypal.test');
    const reloaded = await Booking.findById(booking._id);
    expect(reloaded.guest_email).toBe('aoife.brennan@example.com');
    expect(reloaded.payment_link_sent_at).toBeTruthy();
    const mail = calls.find((call) => call.url.includes('api.resend.com'));
    expect(mail.body.to).toEqual(['aoife.brennan@example.com']);
  });

  it('refuses a bad address, and refuses a booking that is not waiting for payment', async () => {
    const booking = await Booking.create(bookingBody({ status: 'pending_payment' }));
    stubServices();

    await asStaff(request(app).post(`/v1/staff/bookings/${booking._id}/payment-link`))
      .send({ email: 'not-an-address' }).expect(400);

    const confirmed = await Booking.create(bookingBody({ booking_reference: 'HID-PAID', status: 'confirmed' }));
    const response = await asStaff(request(app).post(`/v1/staff/bookings/${confirmed._id}/payment-link`)).expect(409);
    expect(response.body.code).toBe('not_waiting');
  });

  it('says the email did not go out, and hands back the link, when the mail service refuses', async () => {
    const booking = await Booking.create(bookingBody({ status: 'pending_payment' }));
    stubServices({ mailStatus: 422 });

    const response = await asStaff(request(app).post(`/v1/staff/bookings/${booking._id}/payment-link`)).expect(200);
    expect(response.body.mail.status).toBe('failed');
    expect(response.body.mail.error).toContain('refused the message');
    expect(response.body.payment_link).toContain('paypal.test');
    expect((await Booking.findById(booking._id)).payment_link_sent_at).toBeTruthy();
  });
});
