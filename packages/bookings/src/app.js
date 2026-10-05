import express from 'express';
import { createGuestBookingsRouter, createReferenceRouter } from './routes/bookings.routes.js';
import { createStaffBookingsRouter, createDashboardRouter } from './routes/staff.routes.js';
import { createPayPalRouter } from './routes/paypal.routes.js';
import { createInternalRouter } from './routes/internal.routes.js';
import { MailError } from './lib/mailer.js';
import { PayPalError } from './lib/paypal.js';

/**
 * Bookings, payments and refunds.
 *
 * The gateway strips its `/api` prefix before forwarding, so every door here
 * sits under `/v1/...` exactly as the specification's API table names it, and
 * the doors other services use sit under `/internal/...`, which the gateway
 * never proxies.
 */
export function createApp(config) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));

  app.get('/health', (req, res) => res.json({ ok: true, service: 'bookings' }));

  // The emailed payment link lands here, and the guest may not be signed in, so
  // this one answers with the least it can and needs no session.
  app.use('/v1/bookings/reference', createReferenceRouter());
  app.use('/v1/bookings', createGuestBookingsRouter(config));
  app.use('/v1/staff/bookings', createStaffBookingsRouter(config));
  app.use('/v1/staff/dashboard', createDashboardRouter());
  app.use('/v1/paypal', createPayPalRouter(config));
  app.use('/internal', createInternalRouter(config));

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  // Four arguments: Express only treats this as an error handler with all four.
  app.use((error, req, res, next) => {
    if (error?.code === 11000) return res.status(409).json({ error: 'That record already exists' });
    if (error?.name === 'ValidationError') {
      const errors = {};
      for (const [field, detail] of Object.entries(error.errors ?? {})) errors[field] = detail.message;
      return res.status(400).json({ error: 'Check the form', errors });
    }
    if (error instanceof PayPalError) return res.status(502).json({ error: error.message, code: 'payment_failed' });
    if (error instanceof MailError) return res.status(502).json({ error: error.message, code: 'mail_failed' });
    console.error('unhandled bookings service error', error);
    res.status(500).json({ error: 'Internal error' });
  });
  return app;
}
