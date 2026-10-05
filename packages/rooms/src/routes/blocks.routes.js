import { Router } from 'express';
import mongoose from 'mongoose';
import { RoomType } from '../models/RoomType.js';
import { RoomBlock } from '../models/RoomBlock.js';
import { blockProblems } from '../lib/validation.js';

/**
 * The nights a room type's rooms are out of service: repairs, painting or a
 * long let. Blocking stops new bookings only, and every block records who
 * added it and when.
 */
export function createBlocksRouter(config) {
  const router = Router({ mergeParams: true });

  const withRoomType = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.roomTypeId)) {
      res.status(404).json({ error: 'That room type is not one of ours.' });
      return null;
    }
    const roomType = await RoomType.findById(req.params.roomTypeId);
    if (!roomType) {
      res.status(404).json({ error: 'That room type is not one of ours.' });
      return null;
    }
    return roomType;
  };

  router.get('/', async (req, res, next) => {
    try {
      const roomType = await withRoomType(req, res);
      if (!roomType) return undefined;
      const blocks = await RoomBlock.find({ room_type_id: roomType._id }).sort({ first_night: 1 });
      res.json({
        room_type: { id: String(roomType._id), name: roomType.name, room_count: roomType.room_count, nightly_rate: roomType.nightly_rate, on_sale: roomType.on_sale },
        blocks: blocks.map((block) => block.toPublic()),
      });
    } catch (error) { next(error); }
  });

  router.post('/', async (req, res, next) => {
    try {
      const roomType = await withRoomType(req, res);
      if (!roomType) return undefined;
      const errors = blockProblems(req.body ?? {});
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the form', errors });

      const block = await RoomBlock.create({
        room_type_id: roomType._id,
        first_night: new Date(req.body.first_night),
        last_night: new Date(req.body.last_night),
        reason: String(req.body.reason).trim(),
        blocked_by_staff_account_id: req.user.id,
        blocked_by_name: req.user.name || '',
        blocked_at: new Date(),
      });
      res.status(201).json({ block: block.toPublic(req.user.name || null) });
    } catch (error) { next(error); }
  });

  router.delete('/:blockId', async (req, res, next) => {
    try {
      const roomType = await withRoomType(req, res);
      if (!roomType) return undefined;
      if (!mongoose.isValidObjectId(req.params.blockId)) {
        return res.status(404).json({ error: 'That block is no longer there.' });
      }
      const removed = await RoomBlock.findOneAndDelete({ _id: req.params.blockId, room_type_id: roomType._id });
      if (!removed) return res.status(404).json({ error: 'That block is no longer there.' });
      res.status(204).end();
    } catch (error) { next(error); }
  });

  return router;
}
