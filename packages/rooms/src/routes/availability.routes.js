import { Router } from 'express';
import { RoomType } from '../models/RoomType.js';
import { RoomBlock } from '../models/RoomBlock.js';
import { availabilityFor } from '../lib/availability.js';
import { stayProblems } from '../lib/validation.js';
import { fetchBookedCounts } from '../lib/bookings-client.js';
import { publicPhotoUrl } from '../lib/storage.js';

/**
 * What is free for the chosen nights: the room type's rooms, less what is
 * booked and what is blocked, for every night of the stay.
 */
export function createAvailabilityRouter(config) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const query = {
        check_in: req.query.check_in,
        check_out: req.query.check_out,
        guests: req.query.guests,
      };
      const errors = stayProblems(query);
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the dates', errors });

      const roomTypes = await RoomType.find({ on_sale: true }).sort({ nightly_rate: 1, name: 1 });
      const blocks = await RoomBlock.find({
        room_type_id: { $in: roomTypes.map((roomType) => roomType._id) },
        last_night: { $gte: new Date(`${String(query.check_in).slice(0, 10)}T00:00:00.000Z`) },
        first_night: { $lt: new Date(`${String(query.check_out).slice(0, 10)}T00:00:00.000Z`) },
      });

      let booked = new Map();
      try {
        booked = await fetchBookedCounts({
          roomTypeIds: roomTypes.map((roomType) => String(roomType._id)),
          checkIn: query.check_in,
          checkOut: query.check_out,
        }, config);
      } catch (error) {
        return res.status(503).json({ error: error.message, code: 'availability_unavailable' });
      }

      const result = availabilityFor(
        roomTypes.map((roomType) => ({ ...roomType.toObject(), id: String(roomType._id) })),
        {
          checkIn: query.check_in,
          checkOut: query.check_out,
          guests: Number(query.guests),
          booked,
          blocks: blocks.map((block) => ({ ...block.toObject(), id: String(block._id) })),
        },
      );

      const details = new Map(roomTypes.map((roomType) => [
        String(roomType._id),
        roomType.toPublic({ photoUrls: (roomType.photos ?? []).map((path) => publicPhotoUrl(config, path)) }),
      ]));

      res.json({
        nights: result.nights,
        check_in: query.check_in,
        check_out: query.check_out,
        guests: Number(query.guests),
        room_types: result.room_types.map((row) => ({
          ...details.get(row.room_type_id),
          ...row,
        })),
      });
    } catch (error) { next(error); }
  });

  return router;
}
