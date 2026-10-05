import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { proxyTo } from './proxy.js';
import { createSession } from './session.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// packages/gateway/src -> packages/gateway -> packages -> repo root -> client
const clientDist = path.resolve(here, '../../../client/dist');

/** `a=1; b=2` -> `{ a: '1', b: '2' }`. No dependency for six lines. */
function parseCookies(header = '') {
  const jar = {};
  for (const part of String(header).split(';')) {
    const at = part.indexOf('=');
    if (at < 0) continue;
    const name = part.slice(0, at).trim();
    if (name) jar[name] = decodeURIComponent(part.slice(at + 1).trim());
  }
  return jar;
}

export function createApp(config = {}) {
  const services = config.services ?? {
    auth: process.env.AUTH_URL ?? 'http://127.0.0.1:4001',
    rooms: process.env.ROOMS_URL ?? 'http://127.0.0.1:4002',
    bookings: process.env.BOOKINGS_URL ?? 'http://127.0.0.1:4003',
  };
  const sessionConfig = config.session ?? {};
  const session = createSession({
    secret: sessionConfig.secret || process.env.SESSION_SECRET || 'development-only-secret',
    cookieName: sessionConfig.cookieName ?? 'hi_session',
    absoluteMinutes: sessionConfig.absoluteMinutes ?? 12 * 60,
    idleMinutes: sessionConfig.idleMinutes ?? 60,
    production: Boolean(config.production ?? process.env.NODE_ENV === 'production'),
  });

  const app = express();
  app.disable('x-powered-by');
  // The gateway is the only public door, so it is where response headers are set.
  const frameAncestors = process.env.FRAME_ANCESTORS?.trim() || "'none'";
  app.use((req, res, next) => {
    res.set({
      ...(frameAncestors === "'none'" ? { 'X-Frame-Options': 'DENY' } : {}),
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': [
        "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline' https:",
        "img-src 'self' data: blob: https:", "font-src 'self' data: https:",
        // The product's own stylesheet imports the two typefaces the design uses
        // from Google's font host, so that connection is allowed by name — nothing
        // else is.
        "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
        `frame-ancestors ${frameAncestors}`, "base-uri 'self'", "form-action 'self'", "object-src 'none'",
      ].join('; '),
    });
    next();
  });
  app.use(express.json());

  // Read the session once per request and let its idle window slide. Every
  // protected door below reads this, never a header the browser sent.
  app.use((req, res, next) => {
    req.cookies = parseCookies(req.headers.cookie);
    req.session = session.read(req);
    if (req.session) session.touch(res, req.session);
    next();
  });

  const signedIn = (roles) => (req, res, next) => {
    if (!req.session) return res.status(401).json({ error: 'Sign in to continue' });
    if (roles && !roles.includes(req.session.role)) {
      return res.status(403).json({ error: 'Your account cannot open this' });
    }
    next();
  };

  // Readiness is about this process. It must not report the whole system healthy.
  const ready = (req, res) => res.json({ ok: true, clientBuilt: existsSync(clientDist) });
  app.get('/ready', ready);
  app.get('/health', ready);

  const to = {
    auth: proxyTo(services.auth),
    rooms: proxyTo(services.rooms),
    bookings: proxyTo(services.bookings),
  };

  /**
   * Some answers end a session or start one, and only the gateway - which owns
   * the public port - may set that cookie. This forwards one request and then
   * acts on the response.
   */
  // `res` is passed in as well as `req`: this path forwards the request and then
  // writes the answer itself, so it needs both halves of the exchange.
  const forward = async (req, res, target, onResponse) => {
    const headers = { accept: 'application/json' };
    if (req.get('content-type')) headers['content-type'] = req.get('content-type');
    if (req.session) {
      headers['x-user-id'] = String(req.session.id);
      headers['x-user-role'] = String(req.session.role);
    }
    const response = await fetch(new URL(req.originalUrl.replace(/^\/api/, ''), target), {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body ?? {}),
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
    onResponse?.(payload, response);
    res.status(response.status).type('application/json').send(text || 'null');
  };

  const withSession = (target) => async (req, res) => {
    try {
      await forward(req, res, target, (payload, response) => {
        // A successful sign-in or registration starts the session here. The
        // account the service answers with carries `full_name`; the cookie and the
        // identity headers carry it as `name`, which is what the desk's records
        // show — who blocked those nights, who took that booking.
        if (response.ok && payload?.account) {
          const account = payload.account;
          session.issue(res, {
            id: account.id,
            role: account.role,
            email: account.email,
            name: account.full_name ?? account.name ?? '',
          });
        }
      });
    } catch {
      res.status(503).json({ error: 'Upstream service unavailable' });
    }
  };

  const withSignOut = (target) => async (req, res) => {
    try {
      await forward(req, res, target, (payload, response) => {
        // The account is gone; the cookie must not outlive it.
        if (response.ok) session.clear(res);
      });
    } catch {
      res.status(503).json({ error: 'Upstream service unavailable' });
    }
  };

  // --- public doors ---------------------------------------------------------
  // Signing in, creating an account and setting a staff password all end with a
  // session cookie, so those three are forwarded here instead of straight
  // through: the service decides, the gateway sets the cookie. They are handed
  // the service's address, because this path forwards and then acts on the
  // answer rather than proxying the response as it stands.
  app.post('/api/v1/auth/login', withSession(services.auth));
  app.post('/api/v1/auth/register', withSession(services.auth));
  app.post('/api/v1/auth/staff/password-setup', withSession(services.auth));
  app.post('/api/v1/auth/logout', signedIn(), (req, res) => {
    session.clear(res);
    res.json({ signedOut: true });
  });
  app.use('/api/v1/auth', to.auth);                     // confirm, resend, session
  app.use('/api/v1/hotel-details', to.rooms);           // the hotel's public details
  app.use('/api/v1/room-types', to.rooms);              // on-sale room types, and one in full
  app.use('/api/v1/availability', to.rooms);            // what is free for the chosen nights
  app.get('/api/v1/bookings/reference/:reference/status', to.bookings); // the emailed payment link landing
  app.post('/api/v1/paypal/webhook', to.bookings);      // notifications, verified with PayPal

  // --- the guest's own account and bookings ---------------------------------
  // Deleting the account signs the guest out for good, so the cookie is cleared
  // when the deletion succeeds.
  app.delete('/api/v1/account', signedIn(['guest']), withSignOut(services.auth));
  app.use('/api/v1/account', signedIn(['guest']), to.auth);
  app.use('/api/v1/bookings', signedIn(['guest']), to.bookings);

  // --- hotel staff ----------------------------------------------------------
  app.use('/api/v1/staff/team', signedIn(['hotel_staff']), to.auth);
  app.use('/api/v1/staff/room-types', signedIn(['hotel_staff']), to.rooms);
  app.use('/api/v1/staff/hotel-details', signedIn(['hotel_staff']), to.rooms);
  app.use('/api/v1/staff/bookings', signedIn(['hotel_staff']), to.bookings);
  app.get('/api/v1/staff/dashboard', signedIn(['hotel_staff']), to.bookings);

  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    // The SPA fallback comes last and must not swallow /api: a missing API
    // route has to stay a 404, not silently return index.html with status 200.
    app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  } else {
    app.get('/', (req, res) => res.status(503).type('text/plain')
      .send('Client bundle is not built. Run: npm run build'));
  }
  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  // Four arguments: Express only treats this as an error handler with all four.
  app.use((error, req, res, next) => {
    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'That request body is not valid JSON' });
    }
    console.error('unhandled gateway error', error);
    res.status(500).json({ error: 'Internal error' });
  });
  return app;
}
