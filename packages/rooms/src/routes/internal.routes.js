import { Router } from 'express';
import mongoose from 'mongoose';
import { RoomType } from '../models/RoomType.js';
import { RoomBlock } from '../models/RoomBlock.js';
import { HotelDetails } from '../models/HotelDetails.js';
import { countBlockedNights, freePerNight, nightKeys } from '../lib/availability.js';
import { fetchBookedCounts } from '../lib/bookings-client.js';

/**
 * The doors the bookings service knocks on: a room type in any state, the
 * hotel's details, and how many rooms of one room type are free on every night
 * of a stay.
 *
 * Mounted under `/internal/...`, a prefix the gateway never proxies, and every
 * call carries the shared token.
 */
export function createInternalRouter(config) {
  const router = Router();
  router.use((req, res, next) => {
    if (req.get('x-internal-token') !== config.internalToken) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    next();
  });

  router.get('/room-types/:roomTypeId', async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.roomTypeId)) {
        return res.status(404).json({ error: 'That room type is not one of ours.' });
      }
      const roomType = await RoomType.findById(req.params.roomTypeId);
      if (!roomType) return res.status(404).json({ error: 'That room type is not one of ours.' });
      res.json({ room_type: roomType.toPublic() });
    } catch (error) { next(error); }
  });

  router.get('/hotel-details', async (req, res, next) => {
    try {
      const details = await HotelDetails.findOne({});
      if (!details) return res.status(404).json({ error: 'The hotel details are not set yet' });
      res.json({ hotel_details: details.toPublic() });
    } catch (error) { next(error); }
  });

  router.get('/availability', async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.query.room_type_id)) {
        return res.status(404).json({ error: 'That room type is not one of ours.' });
      }
      const roomType = await RoomType.findById(req.query.room_type_id);
      if (!roomType) return res.status(404).json({ error: 'That room type is not one of ours.' });

      const keys = nightKeys(req.query.check_in, req.query.check_out);
      if (!keys.length) return res.status(400).json({ error: 'check_in and check_out are required' });

      const blocks = await RoomBlock.find({
        room_type_id: roomType._id,
        first_night: { $lt: new Date(`${String(req.query.check_out).slice(0, 10)}T00:00:00.000Z`) },
        last_night: { $gte: new Date(`${String(req.query.check_in).slice(0, 10)}T00:00:00.000Z`) },
      });

      let booked = new Map();
      try {
        booked = await fetchBookedCounts({
          roomTypeIds: [String(roomType._id)],
          checkIn: req.query.check_in,
          checkOut: req.query.check_out,
        }, config);
      } catch (error) {
        return res.status(503).json({ error: error.message });
      }

      const blocked = countBlockedNights(blocks.map((block) => ({
        first_night: block.first_night, last_night: block.last_night,
      })));
      const free = freePerNight({ ...roomType.toObject(), id: String(roomType._id) }, booked, blocked, keys);

      res.json({
        room_type_id: String(roomType._id),
        nights: keys.length,
        free_rooms: free.length ? Math.min(...free) : 0,
        on_sale: roomType.on_sale,
        nightly_rate: roomType.nightly_rate,
        room_count: roomType.room_count,
        max_guests: roomType.max_guests,
      });
    } catch (error) { next(error); }
  });

  return router;
}
