import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { connectTestDb, clearCollections, closeTestDb, request } from 'testing';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { Booking } from '../src/models/Booking.js';
import { Payment } from '../src/models/Payment.js';
import { differenceFor, nightsBetween, paidTotal, totalFor } from '../src/lib/pricing.js';
import { createReference, looksLikeReference } from '../src/lib/reference.js';

// PayPal is given real-shaped credentials here, so the suite reaches the stubbed
// network instead of stopping at the service's own "payments are not connected"
// refusal — with no credentials it never calls out at all, which is the point of
// that refusal.
const config = loadConfig({
  SESSION_SECRET: 'test-secret',
  EMAIL_API_KEY: '',
  ROOMS_URL: 'http://rooms.test',
  PAYPAL_CLIENT_ID: 'client-id',
  PAYPAL_CLIENT_SECRET: 'client-secret',
});
const app = createApp(config);
const internal = { 'x-internal-token': 'test-secret' };

const bookingBody = {
  room_type_id: '507f1f77bcf86cd799439011',
  check_in_date: '2026-06-12',
  check_out_date: '2026-06-15',
  nights: 3,
  nightly_rate: 180,
  total_price: 540,
  lead_guest_name: 'Marta Ferreira',
  guest_email: 'marta.ferreira@example.com',
  contact_phone: '+351 912 447 220',
  guest_count: 2,
  expected_arrival_time: '18:00',
  status: 'confirmed',
};

beforeAll(() => connectTestDb());
afterAll(() => closeTestDb());
beforeEach(() => clearCollections());
afterEach(() => { delete globalThis.fetch; });

describe('the money', () => {
  it('counts the nights and prices every one of them, with nothing added', () => {
    expect(nightsBetween('2026-06-12', '2026-06-15')).toBe(3);
    expect(totalFor(180, 3)).toBe(540);
    expect(totalFor(228.5, 3)).toBe(685.5);
  });

  it('counts what the guest has paid, charges less refunds', () => {
    expect(paidTotal([
      { type: 'charge', status: 'completed', amount: 540 },
      { type: 'refund', status: 'completed', amount: 180 },
    ])).toBe(360);
    expect(paidTotal([{ type: 'charge', status: 'pending', amount: 540 }])).toBe(0);
  });

  it('settles only the difference of a change', () => {
    expect(differenceFor(685.5, 540)).toEqual({ direction: 'charge', amount: 145.5 });
    expect(differenceFor(540, 360)).toEqual({ direction: 'charge', amount: 180 });
    expect(differenceFor(360, 540)).toEqual({ direction: 'refund', amount: 180 });
    expect(differenceFor(540, 540)).toEqual({ direction: 'none', amount: 0 });
  });
});

describe('the booking reference', () => {
  it('looks like a reference a guest could read over the phone, and does not repeat', () => {
    const first = createReference();
    const second = createReference();
    expect(looksLikeReference(first)).toBe(true);
    expect(first).not.toBe(second);
  });
});

describe('what is booked, for the availability count', () => {
  it('needs the shared token', async () => {
    await request(app).get('/internal/booked-counts?check_in=2026-06-12&check_out=2026-06-15').expect(403);
  });

  it('counts one room on every night a confirmed booking covers, check-out excluded', async () => {
    await Booking.create(bookingBody);
    const response = await request(app)
      .get('/internal/booked-counts?check_in=2026-06-12&check_out=2026-06-15')
      .set(internal).expect(200);
    expect(response.body.counts).toEqual([
      { room_type_id: bookingBody.room_type_id, night: '2026-06-12', rooms: 1 },
      { room_type_id: bookingBody.room_type_id, night: '2026-06-13', rooms: 1 },
      { room_type_id: bookingBody.room_type_id, night: '2026-06-14', rooms: 1 },
    ]);
  });

  it('stops counting a room an abandoned hold has released', async () => {
    await Booking.create({
      ...bookingBody,
      status: 'pending_payment',
      booked_by_guest_account_id: '507f1f77bcf86cd799439012',
      hold_expires_at: new Date(Date.now() - 60 * 1000),
    });
    const response = await request(app)
      .get('/internal/booked-counts?check_in=2026-06-12&check_out=2026-06-15')
      .set(internal).expect(200);
    expect(response.body.counts).toEqual([]);
  });
});

describe('deleting a guest account', () => {
  const createRefundableBooking = async () => {
    const guestId = '507f1f77bcf86cd799439012';
    const booking = await Booking.create({
      ...bookingBody,
      booking_reference: 'HID-7763',
      booked_by_guest_account_id: guestId,
      check_in_date: new Date('2099-07-10'),
      check_out_date: new Date('2099-07-13'),
    });
    await Payment.create({
      booking_id: booking._id,
      paypal_transaction_id: 'CAPTURE-1',
      amount: 540,
      type: 'charge',
      status: 'completed',
    });
    return { guestId, booking };
  };

  it('cancels and refunds, and reports the refund confirmed', async () => {
    const { guestId, booking } = await createRefundableBooking();
    globalThis.fetch = async (url) => {
      if (String(url).includes('/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'token' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({ id: 'REFUND-1', status: 'COMPLETED' }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const response = await request(app).post('/internal/guest-deletion')
      .set(internal).send({ guestAccountId: guestId }).expect(200);
    expect(response.body).toMatchObject({ refundsConfirmed: true, outstanding: [] });
    const reloaded = await Booking.findById(booking._id);
    expect(reloaded.status).toBe('cancelled');
    const refund = await Payment.findOne({ booking_id: booking._id, type: 'refund' });
    expect(refund.status).toBe('completed');
  });

  it('erases nothing and names the booking when PayPal refuses the refund', async () => {
    const { guestId, booking } = await createRefundableBooking();
    globalThis.fetch = async (url) => {
      if (String(url).includes('/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'token' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({ message: 'REFUND_CAPTURE_FULLY_REFUNDED' }), { status: 422, headers: { 'content-type': 'application/json' } });
    };
    const response = await request(app).post('/internal/guest-deletion')
      .set(internal).send({ guestAccountId: guestId }).expect(200);
    expect(response.body.refundsConfirmed).toBe(false);
    expect(response.body.outstanding[0].reference).toBe('HID-7763');
    expect((await Booking.findById(booking._id)).status).toBe('confirmed');
  });

  it('takes the personal details out of past bookings and clears the link', async () => {
    const { guestId, booking } = await createRefundableBooking();
    const response = await request(app).post('/internal/guest-anonymise')
      .set(internal).send({ guestAccountId: guestId }).expect(200);
    expect(response.body.cleaned).toBe(1);
    const reloaded = await Booking.findById(booking._id);
    expect(reloaded.lead_guest_name).toBe('Deleted guest');
    expect(reloaded.guest_email).toBe('');
    expect(reloaded.booked_by_guest_account_id).toBeUndefined();
  });
});
