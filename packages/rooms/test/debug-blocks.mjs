/**
 * Why a blocked-dates POST answers 404, printed from the app itself.
 * Development aid for a failing assertion — read-only apart from its test database.
 */
import { connectTestDb, clearCollections, closeTestDb, request } from 'testing';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { RoomType } from '../src/models/RoomType.js';

const config = loadConfig({ BOOKINGS_URL: 'http://bookings.test', SESSION_SECRET: 'test-secret' });
const app = createApp(config);
const asStaff = (req) => req.set('x-user-id', 'u1').set('x-user-role', 'hotel_staff').set('x-user-name', 'Priya Raman');

await connectTestDb();
await clearCollections();

const roomType = await RoomType.create({
  name: 'Garden Double', nightly_rate: 180, room_count: 6, max_guests: 3, room_size_sqm: 24,
  description: 'A calm double room.', bed_type_and_size: 'Queen bed', amenities: [], photos: [],
});

const created = await asStaff(request(app).post(`/v1/staff/room-types/${roomType._id}/blocks`))
  .send({ first_night: '2099-06-12', last_night: '2099-06-14', reason: 'Repainting the room' });
console.log('POST blocks status', created.status);
console.log('body', JSON.stringify(created.body));

const bad = await asStaff(request(app).post(`/v1/staff/room-types/${roomType._id}/blocks`))
  .send({ first_night: '2099-06-10', last_night: '2099-06-07', reason: 'Repainting the room' });
console.log('POST bad range status', bad.status, JSON.stringify(bad.body));

const list = await asStaff(request(app).get(`/v1/staff/room-types/${roomType._id}/blocks`));
console.log('GET blocks status', list.status, JSON.stringify(list.body).slice(0, 200));

await closeTestDb();
