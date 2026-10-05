import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { connectTestDb, clearCollections, closeTestDb, request } from 'testing';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { RoomType } from '../src/models/RoomType.js';
import { RoomBlock } from '../src/models/RoomBlock.js';

/**
 * What the desk's room type pages read, which the guest's own room type routes
 * must not answer: every room type whether or not it is on sale, the nights out
 * of service ahead of it, and taking a single photograph off it.
 *
 * These are the handlers behind /staff/room-types, /staff/room-types/:id and the
 * blocked-ahead summary on Room Types and Edit Room Type.
 */
const config = loadConfig({ BOOKINGS_URL: 'http://bookings.test', SESSION_SECRET: 'test-secret' });
const app = createApp(config);
const staff = { id: '507f1f77bcf86cd799439011', role: 'hotel_staff', name: 'Priya Raman' };
const asStaff = (req) => req
  .set('x-user-id', staff.id).set('x-user-role', staff.role).set('x-user-name', staff.name);

const day = (iso) => new Date(`${iso}T00:00:00.000Z`);
const on = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const plusDays = (iso, days) => new Date(day(iso).getTime() + days * 86400000);
const todayIso = () => new Date().toISOString().slice(0, 10);

const roomTypeBody = (overrides = {}) => ({
  name: 'Garden Double',
  nightly_rate: 180,
  room_count: 6,
  description: 'A calm double room on the garden side.',
  bed_type_and_size: 'Queen bed, 160 x 200 cm',
  amenities: ['Free Wi-Fi'],
  photos: [
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800',
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800',
  ],
  max_guests: 3,
  room_size_sqm: 24,
  ...overrides,
});

const createRoomType = async (overrides) => RoomType.create(roomTypeBody(overrides));

beforeAll(() => connectTestDb());
afterAll(() => closeTestDb());
beforeEach(() => clearCollections());
afterEach(() => { delete globalThis.fetch; });

describe('the desk reading the hotel\'s room types', () => {
  it('lists every room type with what is blocked ahead of it, off sale included', async () => {
    const garden = await createRoomType();
    await createRoomType({ name: 'Attic Single', on_sale: false, room_count: 4, max_guests: 1 });
    await RoomBlock.create({
      room_type_id: garden._id,
      first_night: day(on(7)),
      last_night: day(on(10)),
      reason: 'Painting the corridor outside rooms 12–14',
      blocked_by_staff_account_id: staff.id,
      blocked_by_name: 'Amara Osei',
      blocked_at: day(on(-4)),
    });
    await RoomBlock.create({
      room_type_id: garden._id,
      first_night: day(on(28)),
      last_night: day(on(35)),
      reason: 'Long let — held off sale for a returning company booking',
      blocked_by_staff_account_id: staff.id,
      blocked_by_name: 'Tomas Beck',
      blocked_at: day(on(-20)),
    });

    const response = await asStaff(request(app).get('/v1/staff/room-types')).expect(200);
    expect(response.body.room_types).toHaveLength(2);

    const [attic, listed] = response.body.room_types;
    expect(attic.name).toBe('Attic Single');
    expect(attic.on_sale).toBe(false);
    expect(attic.nights_blocked_ahead).toBe(0);
    expect(attic.blocked_ranges_ahead).toBe(0);
    expect(attic.next_blocked_night).toBe(null);

    expect(listed.name).toBe('Garden Double');
    expect(listed.nights_blocked_ahead).toBe(4 + 8);
    expect(listed.blocked_ranges_ahead).toBe(2);
    expect(String(listed.next_blocked_night).slice(0, 10)).toBe(on(7));
    expect(String(listed.next_blocked_until).slice(0, 10)).toBe(on(10));
    expect(listed.next_blocked_reason).toContain('Painting the corridor');
    expect(listed.next_blocked_by).toBe('Amara Osei');
  });

  it('leaves out the nights already gone by', async () => {
    const garden = await createRoomType();
    await RoomBlock.create({
      room_type_id: garden._id,
      first_night: day(on(-10)),
      last_night: day(on(-8)),
      reason: 'Repairs finished last week',
      blocked_by_staff_account_id: staff.id,
      blocked_by_name: 'Amara Osei',
      blocked_at: day(on(-12)),
    });

    const response = await asStaff(request(app).get('/v1/staff/room-types')).expect(200);
    expect(response.body.room_types[0].nights_blocked_ahead).toBe(0);
    expect(response.body.room_types[0].blocked_ranges_ahead).toBe(0);
  });

  it('opens one room type even when it is off sale, where the guest route refuses it', async () => {
    const attic = await createRoomType({ name: 'Attic Single', on_sale: false, max_guests: 1 });

    const staff_ = await asStaff(request(app).get(`/v1/staff/room-types/${attic._id}`)).expect(200);
    expect(staff_.body.room_type).toMatchObject({
      name: 'Attic Single', on_sale: false, room_count: 6, max_guests: 1, nights_blocked_ahead: 0,
    });
    expect(staff_.body.room_type.updated_at).toBeTruthy();

    await request(app).get(`/v1/room-types/${attic._id}`).expect(409);
  });

  it('answers 404 for a room type that is not one of ours, and 404 for an id that is not an id', async () => {
    await asStaff(request(app).get('/v1/staff/room-types/507f1f77bcf86cd799439099')).expect(404);
    await asStaff(request(app).get('/v1/staff/room-types/not-an-id')).expect(404);
  });

  it('needs a staff caller for every one of them', async () => {
    const garden = await createRoomType();
    await request(app).get('/v1/staff/room-types').expect(401);
    await request(app).get(`/v1/staff/room-types/${garden._id}`).expect(401);
    await asStaff(request(app).patch(`/v1/staff/room-types/${garden._id}`)).send({ room_count: 7 }).expect(200);
    await request(app).patch(`/v1/staff/room-types/${garden._id}`).send({ room_count: 7 }).expect(401);
  });
});

describe('taking a photograph off a room type', () => {
  it('removes the one named, and leaves the rest where they are', async () => {
    const garden = await createRoomType();

    const patched = await asStaff(request(app).patch(`/v1/staff/room-types/${garden._id}`))
      .send({ remove_photo: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800' })
      .expect(200);

    expect(patched.body.room_type.photos).toEqual([
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800',
    ]);
    expect((await RoomType.findById(garden._id)).photos).toHaveLength(1);
  });

  it('removes an uploaded photograph by the path it is stored under', async () => {
    const garden = await createRoomType({ photos: ['507f1f77bcf86cd799439011/1730000000000-garden.jpg'] });

    await asStaff(request(app).patch(`/v1/staff/room-types/${garden._id}`))
      .send({ remove_photo: '507f1f77bcf86cd799439011/1730000000000-garden.jpg' })
      .expect(200);

    expect((await RoomType.findById(garden._id)).photos).toEqual([]);
  });

  it('changes nothing when the photograph named is not on the room type', async () => {
    const garden = await createRoomType();

    await asStaff(request(app).patch(`/v1/staff/room-types/${garden._id}`))
      .send({ remove_photo: 'https://images.unsplash.com/photo-does-not-belong' })
      .expect(200);

    expect((await RoomType.findById(garden._id)).photos).toHaveLength(2);
  });
});
