import { Router } from 'express';
import { HotelDetails } from '../models/HotelDetails.js';
import { hotelDetailsProblems } from '../lib/validation.js';
import { requireRole } from '../lib/identity.js';

/** The hotel's public details, as guests read them on every page and email. */
export function createPublicHotelDetailsRouter() {
  const router = Router();
  router.get('/', async (req, res, next) => {
    try {
      const details = await HotelDetails.findOne({});
      if (!details) {
        return res.status(404).json({
          error: 'The hotel details are not set yet',
          code: 'hotel_details_missing',
        });
      }
      res.json({ hotel_details: details.toPublic() });
    } catch (error) { next(error); }
  });
  return router;
}

/** The one record staff keep current. There is no second one to add or delete. */
export function createStaffHotelDetailsRouter() {
  const router = Router();
  router.use(requireRole('hotel_staff'));
  router.get('/', async (req, res, next) => {
    try {
      const details = await HotelDetails.findOne({});
      if (!details) return res.status(404).json({ error: 'The hotel details are not set yet' });
      res.json({ hotel_details: details.toPublic() });
    } catch (error) { next(error); }
  });

  router.put('/', async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const errors = hotelDetailsProblems(body);
      if (Object.keys(errors).length) return res.status(400).json({ error: 'There is a problem', errors });
      const details = await HotelDetails.findOneAndUpdate(
        {},
        {
          hotel_name: String(body.hotel_name).trim(),
          address: String(body.address).trim(),
          phone_number: String(body.phone_number).trim(),
          email_address: String(body.email_address).trim().toLowerCase(),
          check_in_time: String(body.check_in_time).trim(),
          check_out_time: String(body.check_out_time).trim(),
          house_rules: String(body.house_rules ?? ''),
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
      res.json({ hotel_details: details.toPublic() });
    } catch (error) { next(error); }
  });

  return router;
}
