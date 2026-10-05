import express from 'express';
import { createPublicRoomTypesRouter, createStaffRoomTypesRouter } from './routes/room-types.routes.js';
import { createBlocksRouter } from './routes/blocks.routes.js';
import { createAvailabilityRouter } from './routes/availability.routes.js';
import { createPublicHotelDetailsRouter, createStaffHotelDetailsRouter } from './routes/hotel-details.routes.js';
import { createInternalRouter } from './routes/internal.routes.js';
import { requireRole } from './lib/identity.js';
import { StorageError } from './lib/storage.js';

/**
 * Room types, blocked dates and the hotel's own public details, plus the
 * availability the whole booking flow rests on.
 *
 * The gateway strips its `/api` prefix before forwarding, so every door here
 * sits under `/v1/...` exactly as the specification's API table names it.
 */
export function createApp(config) {
  const app = express();
  app.disable('x-powered-by');
  // Photographs arrive as base64 JSON, so the body limit is generous on purpose.
  app.use(express.json({ limit: '8mb' }));

  app.get('/health', (req, res) => res.json({ ok: true, service: 'rooms' }));

  app.use('/v1/room-types', createPublicRoomTypesRouter(config));
  app.use('/v1/availability', createAvailabilityRouter(config));
  app.use('/v1/hotel-details', createPublicHotelDetailsRouter());

  const staffRoomTypes = createStaffRoomTypesRouter(config);
  staffRoomTypes.use('/:roomTypeId/blocks', requireRole('hotel_staff'), createBlocksRouter(config));
  app.use('/v1/staff/room-types', staffRoomTypes);
  app.use('/v1/staff/hotel-details', createStaffHotelDetailsRouter());
  // Internal only: the gateway proxies `/api/...` and nothing else.
  app.use('/internal', createInternalRouter(config));

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  // Four arguments: Express only treats this as an error handler with all four.
  app.use((error, req, res, next) => {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'A room type with that name already exists', errors: { name: 'That name is already used by another room type.' } });
    }
    if (error?.name === 'ValidationError') {
      const errors = {};
      for (const [field, detail] of Object.entries(error.errors ?? {})) errors[field] = detail.message;
      return res.status(400).json({ error: 'Check the form', errors });
    }
    if (error instanceof StorageError) return res.status(502).json({ error: error.message, code: 'storage_unavailable' });
    console.error('unhandled rooms service error', error);
    res.status(500).json({ error: 'Internal error' });
  });
  return app;
}
