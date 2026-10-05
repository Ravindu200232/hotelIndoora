import { Router } from 'express';
import mongoose from 'mongoose';
import { RoomType } from '../models/RoomType.js';
import { RoomBlock } from '../models/RoomBlock.js';
import { publicPhotoUrl, checkPhoto, uploadPhoto } from '../lib/storage.js';
import { roomTypeProblems } from '../lib/validation.js';
import { requireRole } from '../lib/identity.js';

const photosOf = (roomType, config) => (roomType.photos ?? []).map((path) => publicPhotoUrl(config, path));

const shape = (roomType, config) => roomType.toPublic({ photoUrls: photosOf(roomType, config) });

/** The rooms the hotel sells, as guests see them: only what is on sale. */
export function createPublicRoomTypesRouter(config) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const roomTypes = await RoomType.find({ on_sale: true }).sort({ nightly_rate: 1, name: 1 });
      res.json({ room_types: roomTypes.map((roomType) => shape(roomType, config)) });
    } catch (error) { next(error); }
  });

  router.get('/:roomTypeId', async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.roomTypeId)) {
        return res.status(404).json({ error: 'That room type is not one of ours.' });
      }
      const roomType = await RoomType.findById(req.params.roomTypeId);
      if (!roomType) return res.status(404).json({ error: 'That room type is not one of ours.' });
      if (!roomType.on_sale) {
        return res.status(409).json({
          error: 'This room type is not on sale',
          code: 'off_sale',
          room_type: shape(roomType, config),
        });
      }
      res.json({ room_type: shape(roomType, config) });
    } catch (error) { next(error); }
  });

  return router;
}

/** The room types the hotel runs, as the desk sees them. */
export function createStaffRoomTypesRouter(config) {
  const router = Router();
  router.use(requireRole('hotel_staff'));

  router.get('/', async (req, res, next) => {
    try {
      const roomTypes = await RoomType.find({}).sort({ name: 1 });
      // Every range still to come, per room type, so the list can show what is
      // out of service ahead and how many rooms it takes off the market.
      const today = new Date(new Date().toISOString().slice(0, 10));
      const ahead = await RoomBlock.find({ last_night: { $gte: today } }).sort({ first_night: 1 });
      const byType = new Map();
      for (const block of ahead) {
        const key = String(block.room_type_id);
        if (!byType.has(key)) byType.set(key, []);
        const nightsOfBlock = Math.round((block.last_night - block.first_night) / 86400000) + 1;
        byType.get(key).push({ block, nights: nightsOfBlock });
      }
      res.json({
        room_types: roomTypes.map((roomType) => {
          const ranges = byType.get(String(roomType._id)) ?? [];
          const next = ranges[0]?.block ?? null;
          return {
            ...shape(roomType, config),
            nights_blocked_ahead: ranges.reduce((sum, range) => sum + range.nights, 0),
            blocked_ranges_ahead: ranges.length,
            next_blocked_night: next ? next.first_night : null,
            next_blocked_until: next ? next.last_night : null,
            next_blocked_reason: next ? next.reason : null,
            next_blocked_by: next ? next.blocked_by_name || null : null,
          };
        }),
      });
    } catch (error) { next(error); }
  });

  // One room type as the desk opens it: every field, the on-sale flag whatever
  // its state, and what is out of service ahead.
  router.get('/:roomTypeId', async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.roomTypeId)) {
        return res.status(404).json({ error: 'That room type is not one of ours.' });
      }
      const roomType = await RoomType.findById(req.params.roomTypeId);
      if (!roomType) return res.status(404).json({ error: 'That room type is not one of ours.' });

      const today = new Date(new Date().toISOString().slice(0, 10));
      const ahead = await RoomBlock.find({ room_type_id: roomType._id, last_night: { $gte: today } })
        .sort({ first_night: 1 });
      const next = ahead[0] ?? null;
      res.json({
        room_type: {
          ...shape(roomType, config),
          nights_blocked_ahead: ahead.reduce(
            (sum, block) => sum + Math.round((block.last_night - block.first_night) / 86400000) + 1,
            0,
          ),
          blocked_ranges_ahead: ahead.length,
          next_blocked_night: next ? next.first_night : null,
          next_blocked_until: next ? next.last_night : null,
          next_blocked_reason: next ? next.reason : null,
          next_blocked_by: next ? next.blocked_by_name || null : null,
        },
      });
    } catch (error) { next(error); }
  });

  router.post('/', async (req, res, next) => {
    try {
      const errors = roomTypeProblems(req.body ?? {});
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the form', errors });
      const body = req.body ?? {};
      const roomType = await RoomType.create({
        name: String(body.name).trim(),
        nightly_rate: Number(body.nightly_rate),
        room_count: Number(body.room_count),
        description: body.description ? String(body.description) : '',
        bed_type_and_size: body.bed_type_and_size ? String(body.bed_type_and_size) : '',
        amenities: Array.isArray(body.amenities) ? body.amenities.map(String) : [],
        photos: Array.isArray(body.photos) ? body.photos.map(String) : [],
        max_guests: Number(body.max_guests),
        room_size_sqm: body.room_size_sqm ? Number(body.room_size_sqm) : undefined,
        on_sale: body.on_sale === undefined ? true : Boolean(body.on_sale),
      });
      res.status(201).json({ room_type: shape(roomType, config) });
    } catch (error) { next(error); }
  });

  router.patch('/:roomTypeId', async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.roomTypeId)) {
        return res.status(404).json({ error: 'That room type is not one of ours.' });
      }
      const roomType = await RoomType.findById(req.params.roomTypeId);
      if (!roomType) return res.status(404).json({ error: 'That room type is not one of ours.' });

      const merged = { ...roomType.toObject(), ...req.body };
      const errors = roomTypeProblems(merged);
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the form', errors });

      for (const field of ['name', 'description', 'bed_type_and_size', 'amenities', 'photos']) {
        if (req.body[field] !== undefined) roomType[field] = req.body[field];
      }
      // A photograph is removed by naming it, so the paths already stored on the
      // room type are never rewritten by a round trip through the browser.
      if (req.body.remove_photo) {
        const gone = String(req.body.remove_photo);
        roomType.photos = (roomType.photos ?? []).filter(
          (path) => path !== gone && publicPhotoUrl(config, path) !== gone,
        );
      }
      for (const field of ['nightly_rate', 'room_count', 'max_guests', 'room_size_sqm']) {
        if (req.body[field] !== undefined) roomType[field] = Number(req.body[field]);
      }
      if (req.body.on_sale !== undefined) roomType.on_sale = Boolean(req.body.on_sale);
      await roomType.save();
      res.json({ room_type: shape(roomType, config) });
    } catch (error) { next(error); }
  });

  // A photograph arrives as base64 JSON so no multipart dependency is needed;
  // type and size are checked on the server before anything is stored.
  router.post('/:roomTypeId/photos', async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.roomTypeId)) {
        return res.status(404).json({ error: 'That room type is not one of ours.' });
      }
      const roomType = await RoomType.findById(req.params.roomTypeId);
      if (!roomType) return res.status(404).json({ error: 'That room type is not one of ours.' });
      if ((roomType.photos ?? []).length >= config.photos.maxPerRoomType) {
        return res.status(400).json({ error: 'At most 10 photographs fit on a room type.' });
      }

      const { filename, content_type: contentType, data } = req.body ?? {};
      const bytes = Buffer.from(String(data ?? ''), 'base64');
      const problem = checkPhoto({ contentType, byteLength: bytes.length }, config);
      if (problem) return res.status(400).json({ error: problem, errors: { photos: problem } });

      const objectPath = await uploadPhoto({
        roomTypeId: String(roomType._id), filename, contentType, bytes,
      }, config);
      roomType.photos = [...(roomType.photos ?? []), objectPath];
      await roomType.save();
      res.status(201).json({ room_type: shape(roomType, config) });
    } catch (error) { next(error); }
  });

  return router;
}
