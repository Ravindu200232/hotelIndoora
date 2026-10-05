/**
 * What the change route answers when the test's own request is sent, printed in
 * full. Development aid for a failing assertion — read-only apart from the test
 * database it is pointed at.
 */
import { connectTestDb, clearCollections, closeTestDb, request } from 'testing';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { Booking } from '../src/models/Booking.js';
import { Payment } from '../src/models/Payment.js';

const config = loadConfig({
  SESSION_SECRET: 'test-secret',
  ROOMS_URL: 'http://rooms.test',
  AUTH_URL: 'http://auth.test',
  EMAIL_API_KEY: 'test-mail-key',
  PAYPAL_CLIENT_ID: 'client-id',
  PAYPAL_CLIENT_SECRET: 'client-secret',
});
const app = createApp(config);
const ROOM_TYPE_ID = '507f1f77bcf86cd799439021';
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const atMidnight = (iso) => new Date(`${iso}T00:00:00.000Z`);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

await connectTestDb();
await clearCollections();

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
});
await Payment.create({ booking_id: booking._id, paypal_transaction_id: 'CAPTURE-1', amount: 360, type: 'charge', status: 'completed' });

globalThis.fetch = async (url) => {
  const target = String(url);
  if (target.startsWith('http://rooms.test/internal/room-types/')) {
    return json({ room_type: { id: ROOM_TYPE_ID, name: 'Sea View King', nightly_rate: 228.5, room_count: 4, max_guests: 3, on_sale: true } });
  }
  if (target.startsWith('http://rooms.test/internal/availability')) return json({ free_rooms: 3, nights: 3 });
  if (target.startsWith('http://rooms.test/internal/hotel-details')) {
    return json({ hotel_details: { hotel_name: 'hotelIndoora', address: '14 Harbour Lane, Kinsale', phone_number: '+353 21 477 0128', email_address: 'stay@hotelindoora.com', check_in_time: '15:00', check_out_time: '11:00', house_rules: '' } });
  }
  if (target.includes('/oauth2/token')) return json({ access_token: 'token' });
  if (target.includes('/v2/checkout/orders')) return json({ id: 'ORDER-1', status: 'CREATED', links: [{ rel: 'approve', href: 'https://paypal.test/x' }] });
  if (target.includes('api.resend.com')) return json({ id: 'mail-1' });
  return json({ error: 'nothing stubbed' }, 404);
};

const response = await request(app)
  .patch(`/v1/staff/bookings/${booking._id}`)
  .set('x-user-id', '507f1f77bcf86cd799439011')
  .set('x-user-role', 'hotel_staff')
  .set('x-user-name', 'Priya Raman')
  .send({ check_in_date: day(15), check_out_date: day(18), room_type_id: ROOM_TYPE_ID });

console.log('status', response.status);
console.log('body', JSON.stringify(response.body, null, 1));

await closeTestDb();
