import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { connectTestDb, clearCollections, closeTestDb, request } from 'testing';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { RoomType } from '../src/models/RoomType.js';
import { HotelDetails } from '../src/models/HotelDetails.js';
import { availabilityFor, nightKeys, countBlockedNights } from '../src/lib/availability.js';

const config = loadConfig({ BOOKINGS_URL: 'http://bookings.test', SESSION_SECRET: 'test-secret' });
const app = createApp(config);
const staff = { id: '507f1f77bcf86cd799439011', role: 'hotel_staff', name: 'Priya Raman' };
const asStaff = (req) => req
  .set('x-user-id', staff.id).set('x-user-role', staff.role).set('x-user-name', staff.name);

const roomTypeBody = {
  name: 'Garden Double',
  nightly_rate: 180,
  room_count: 6,
  description: 'A calm double room on the garden side.',
  bed_type_and_size: 'Queen bed, 160 x 200 cm',
  amenities: ['Free Wi-Fi'],
  photos: ['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800'],
  max_guests: 3,
  room_size_sqm: 24,
};

/** A day `offset` days from today, so a stay is always ahead of the clock. */
const soon = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

/** The bookings service, stood in at the network boundary. */
const stubBookings = (counts) => {
  globalThis.fetch = async () => new Response(JSON.stringify({ counts }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
};

beforeAll(() => connectTestDb());
afterAll(() => closeTestDb());
beforeEach(() => clearCollections());
afterEach(() => { delete globalThis.fetch; });

describe('how many rooms are free', () => {
  it('counts the nights of a stay from check-in up to check-out', () => {
    expect(nightKeys('2026-06-12', '2026-06-15')).toEqual(['2026-06-12', '2026-06-13', '2026-06-14']);
  });

  it('spreads a block over every night it covers, both ends included', () => {
    const counts = countBlockedNights([{ first_night: '2026-06-12', last_night: '2026-06-14' }]);
    expect([...counts.entries()]).toEqual([['2026-06-12', 1], ['2026-06-13', 1], ['2026-06-14', 1]]);
  });

  it('takes booked and blocked rooms off the room count, and never goes below zero', () => {
    const roomTypes = [{ id: 'rt1', name: 'Garden Double', nightly_rate: 180, room_count: 2, max_guests: 3, on_sale: true }];
    const booked = new Map([['rt1', new Map([['2026-06-12', 1], ['2026-06-13', 1]])]]);
    const result = availabilityFor(roomTypes, {
      checkIn: '2026-06-12', checkOut: '2026-06-14', guests: 2, booked, blocks: [],
    });
    expect(result.room_types).toHaveLength(1);
    expect(result.room_types[0].free_rooms).toBe(1);

    // Every room of the type taken, so nothing is free and it is left out of the
    // answer altogether - a guest is never offered a room type with none left.
    const full = new Map([['rt1', new Map([['2026-06-12', 2], ['2026-06-13', 1]])]]);
    const none = availabilityFor(roomTypes, {
      checkIn: '2026-06-12', checkOut: '2026-06-14', guests: 2, booked: full, blocks: [],
    });
    expect(none.room_types).toHaveLength(0);

    // More booked than the hotel has rooms: still never below zero.
    const overBooked = new Map([['rt1', new Map([['2026-06-12', 5]])]]);
    const guarded = availabilityFor(roomTypes, {
      checkIn: '2026-06-12', checkOut: '2026-06-13', guests: 2, booked: overBooked, blocks: [],
    });
    expect(guarded.room_types).toHaveLength(0);
  });

  it('leaves out a room type that sleeps fewer guests, or is off sale', () => {
    const roomTypes = [
      { id: 'a', name: 'Attic Single', nightly_rate: 118, room_count: 4, max_guests: 1, on_sale: true },
      { id: 'b', name: 'Loft Twin', nightly_rate: 152, room_count: 3, max_guests: 2, on_sale: false },
    ];
    const result = availabilityFor(roomTypes, {
      checkIn: '2026-06-12', checkOut: '2026-06-13', guests: 2, booked: new Map(), blocks: [],
    });
    expect(result.room_types).toHaveLength(0);
  });

  it('prices the stay at the nightly rate for every night, with nothing added', () => {
    const roomTypes = [{ id: 'rt1', name: 'Garden Double', nightly_rate: 180, room_count: 6, max_guests: 3, on_sale: true }];
    const result = availabilityFor(roomTypes, {
      checkIn: '2026-06-12', checkOut: '2026-06-15', guests: 2, booked: new Map(), blocks: [],
    });
    expect(result.room_types[0]).toMatchObject({ nights: 3, total: 540, free_rooms: 6 });
  });
});

describe('the availability endpoint', () => {
  it('refuses a check-out that is not later than the check-in', async () => {
    const response = await request(app)
      .get(`/v1/availability?check_in=${soon(3)}&check_out=${soon(3)}&guests=2`).expect(400);
    expect(response.body.errors.check_out).toContain('later than the check-in');
  });

  it('refuses a check-in that has already gone by', async () => {
    const response = await request(app)
      .get(`/v1/availability?check_in=${soon(-3)}&check_out=${soon(-1)}&guests=2`).expect(400);
    expect(response.body.errors.check_in).toContain('from today onwards');
  });

  it('lists what is free with its rate and total', async () => {
    await RoomType.create(roomTypeBody);
    stubBookings([]);
    const response = await request(app)
      .get(`/v1/availability?check_in=${soon(3)}&check_out=${soon(6)}&guests=2`).expect(200);
    expect(response.body.nights).toBe(3);
    expect(response.body.room_types[0]).toMatchObject({ name: 'Garden Double', free_rooms: 6, total: 540 });
  });

  it('takes a booked room off the free count for the nights it covers', async () => {
    const created = await RoomType.create(roomTypeBody);
    stubBookings([{ room_type_id: String(created._id), night: soon(4), rooms: 3 }]);
    const response = await request(app)
      .get(`/v1/availability?check_in=${soon(3)}&check_out=${soon(6)}&guests=2`).expect(200);
    expect(response.body.room_types[0].free_rooms).toBe(3);
  });

  it('says so clearly when the bookings service cannot be reached', async () => {
    await RoomType.create(roomTypeBody);
    globalThis.fetch = async () => { throw new Error('connect ECONNREFUSED'); };
    const response = await request(app)
      .get(`/v1/availability?check_in=${soon(3)}&check_out=${soon(6)}&guests=2`).expect(503);
    expect(response.body.code).toBe('availability_unavailable');
  });
});

describe('room types on the guest site', () => {
  it('lists only what is on sale, and hides an off-sale one behind a clear answer', async () => {
    const created = await RoomType.create(roomTypeBody);
    expect((await request(app).get('/v1/room-types').expect(200)).body.room_types).toHaveLength(1);
    await asStaff(request(app).patch(`/v1/staff/room-types/${created._id}`)).send({ on_sale: false }).expect(200);
    expect((await request(app).get('/v1/room-types').expect(200)).body.room_types).toHaveLength(0);
    const hidden = await request(app).get(`/v1/room-types/${created._id}`).expect(409);
    expect(hidden.body.code).toBe('off_sale');
  });

  it('answers 404 for a room type that is not ours', async () => {
    await request(app).get('/v1/room-types/507f1f77bcf86cd799439012').expect(404);
    await request(app).get('/v1/room-types/not-an-id').expect(404);
  });
});

describe('staff room type rules', () => {
  it('refuses a name that is too long, a rate above the ceiling, too many rooms and too many guests', async () => {
    const long = await asStaff(request(app).post('/v1/staff/room-types'))
      .send({ ...roomTypeBody, name: 'x'.repeat(121) }).expect(400);
    expect(long.body.errors.name).toContain('2 and 120');

    const rate = await asStaff(request(app).post('/v1/staff/room-types'))
      .send({ ...roomTypeBody, nightly_rate: 100000 }).expect(400);
    expect(rate.body.errors.nightly_rate).toContain('99,999.99');

    const rooms = await asStaff(request(app).post('/v1/staff/room-types'))
      .send({ ...roomTypeBody, room_count: 501 }).expect(400);
    expect(rooms.body.errors.room_count).toContain('1 and 500');

    const guests = await asStaff(request(app).post('/v1/staff/room-types'))
      .send({ ...roomTypeBody, max_guests: 21 }).expect(400);
    expect(guests.body.errors.max_guests).toContain('1 and 20');
  });

  it('refuses a rate with more than two decimals and keeps a refused save whole', async () => {
    await asStaff(request(app).post('/v1/staff/room-types'))
      .send({ ...roomTypeBody, nightly_rate: 180.005 }).expect(400);
    expect(await RoomType.countDocuments()).toBe(0);
  });

  it('refuses a duplicate name with a conflict rather than a 500', async () => {
    await asStaff(request(app).post('/v1/staff/room-types')).send(roomTypeBody).expect(201);
    await asStaff(request(app).post('/v1/staff/room-types')).send(roomTypeBody).expect(409);
  });

  it('needs a staff caller', async () => {
    await request(app).get('/v1/staff/room-types').expect(401);
    await request(app).post('/v1/staff/room-types').set('x-user-id', 'x').set('x-user-role', 'guest').send(roomTypeBody).expect(403);
  });
});

describe('blocked dates', () => {
  const createRoomType = async () => (await RoomType.create(roomTypeBody))._id;

  it('refuses a last night earlier than the first night', async () => {
    const id = await createRoomType();
    const response = await asStaff(request(app).post(`/v1/staff/room-types/${id}/blocks`))
      .send({ first_night: '2026-06-10', last_night: '2026-06-07', reason: 'Repainting the room' }).expect(400);
    expect(response.body.errors.last_night).toContain('on or after');
  });

  it('records who blocked the nights and takes them out of availability', async () => {
    const id = await createRoomType();
    const created = await asStaff(request(app).post(`/v1/staff/room-types/${id}/blocks`))
      .send({ first_night: soon(3), last_night: soon(5), reason: 'Repainting the room' }).expect(201);
    expect(created.body.block).toMatchObject({ nights: 3, blocked_by: 'Priya Raman' });

    stubBookings([]);
    const available = await request(app)
      .get(`/v1/availability?check_in=${soon(4)}&check_out=${soon(5)}&guests=2`).expect(200);
    const partlyBlocked = available.body.room_types[0];
    // Six rooms, one of them out of service on the night asked for.
    expect(partlyBlocked.free_rooms).toBe(5);

    const list = await asStaff(request(app).get(`/v1/staff/room-types/${id}/blocks`)).expect(200);
    expect(list.body.blocks).toHaveLength(1);

    await asStaff(request(app).delete(`/v1/staff/room-types/${id}/blocks/${created.body.block.id}`)).expect(204);
    const after = await asStaff(request(app).get(`/v1/staff/room-types/${id}/blocks`)).expect(200);
    expect(after.body.blocks).toHaveLength(0);
  });
});

describe("the hotel's public details", () => {
  // FR-126 refuses a check-out time at or before the check-in time, so a save has
  // to be made of a later check-out. The hotel's own published hours (check-in
  // 15:00, check-out 11:00 — the prototype's, and what the seed writes) are
  // therefore refused by the save path; that is recorded as a known gap.
  const details = {
    hotel_name: 'hotelIndoora',
    address: '14 Harbour Lane, Kinsale, Co. Cork, Ireland',
    phone_number: '+353 21 477 0128',
    email_address: 'stay@hotelindoora.com',
    check_in_time: '11:00',
    check_out_time: '15:00',
    house_rules: 'No smoking indoors. Quiet hours 22:00 to 07:00.',
  };

  it('is missing until staff save it, and then readable by everyone', async () => {
    await request(app).get('/v1/hotel-details').expect(404);
    await asStaff(request(app).put('/v1/staff/hotel-details')).send(details).expect(200);
    const response = await request(app).get('/v1/hotel-details').expect(200);
    expect(response.body.hotel_details.hotel_name).toBe('hotelIndoora');
  });

  it('refuses a check-out that is not later than the check-in, and a bad email address', async () => {
    const times = await asStaff(request(app).put('/v1/staff/hotel-details'))
      .send({ ...details, check_out_time: '09:00' }).expect(400);
    expect(times.body.errors.check_out_time).toContain('later than the check-in');

    const email = await asStaff(request(app).put('/v1/staff/hotel-details'))
      .send({ ...details, email_address: 'stay@hotelindoora' }).expect(400);
    expect(email.body.errors.email_address).toContain('correct format');
  });

  it('refuses the prototype\'s own hours, because FR-126 asks for a later check-out', async () => {
    const response = await asStaff(request(app).put('/v1/staff/hotel-details'))
      .send({ ...details, check_in_time: '15:00', check_out_time: '11:00' }).expect(400);
    expect(response.body.errors.check_out_time).toContain('later than the check-in');
    expect(await HotelDetails.countDocuments()).toBe(0);
  });

  it('is one record only, however many saves happen', async () => {
    await asStaff(request(app).put('/v1/staff/hotel-details')).send(details).expect(200);
    await asStaff(request(app).put('/v1/staff/hotel-details'))
      .send({ ...details, hotel_name: 'hotelIndoora Kinsale' }).expect(200);
    expect(await HotelDetails.countDocuments()).toBe(1);
  });
});
