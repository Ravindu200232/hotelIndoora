import express from 'express';
import { createAuthRouter } from './routes/auth.routes.js';
import { createAccountRouter } from './routes/account.routes.js';
import { createTeamRouter } from './routes/team.routes.js';
import { createInternalRouter } from './routes/internal.routes.js';
import { MailError } from './lib/mailer.js';

/**
 * The app is built without listening, so a suite can drive it over supertest
 * with no port and no teardown, and server.js stays the only file that binds.
 *
 * The gateway strips its own `/api` prefix before forwarding, so every door in
 * this service sits under `/v1/...` exactly as the specification's API table
 * names it.
 */
export function createApp(config) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));

  // Readiness is about this process only.
  app.get('/health', (req, res) => res.json({ ok: true, service: 'auth' }));

  app.use('/v1/auth', createAuthRouter(config));
  app.use('/v1/account', createAccountRouter(config));
  app.use('/v1/staff/team', createTeamRouter(config));
  // Internal only: the gateway proxies `/api/...` and nothing else, so this
  // prefix is unreachable from outside the machine.
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
    if (error instanceof MailError) return res.status(502).json({ error: error.message, code: 'mail_failed' });
    console.error('unhandled auth service error', error);
    res.status(500).json({ error: 'Internal error' });
  });
  return app;
}
