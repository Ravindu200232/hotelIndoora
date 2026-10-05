import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

/**
 * The gateway is the product's only door, so this is where its own rules live:
 * it is the one place a session cookie is set or cleared, the identity of the
 * signed-in person travels inward as headers only, and a missing service answers
 * as a service that is missing rather than as an empty page.
 *
 * The services themselves are stood in for here; what is under test is the door.
 */
let upstream;
let seen;
let config;

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

beforeAll(async () => {
  upstream = http.createServer((req, res) => {
    seen.push({ url: req.url, method: req.method, userId: req.headers['x-user-id'], role: req.headers['x-user-role'] });
    if (req.url.startsWith('/v1/auth/login')) {
      json(res, 200, { account: { id: '507f1f77bcf86cd799439012', role: 'guest', full_name: 'Marta Ferreira', email: 'marta.ferreira@example.com' } });
      return;
    }
    if (req.url.startsWith('/v1/room-types/507f1f77bcf86cd799439099')) return json(res, 404, { error: 'That room type is not one of ours.' });
    if (req.url.startsWith('/v1/room-types')) {
      json(res, 200, { room_types: [{ id: '1', name: 'Garden Double', nightly_rate: 180 }] });
      return;
    }
    if (req.url.startsWith('/v1/availability')) return json(res, 200, { nights: 3, room_types: [] });
    if (req.url.startsWith('/v1/bookings')) return json(res, 200, { bookings: [], total: 0 });
    json(res, 404, { error: 'Not found' });
  });
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
});

afterAll(async () => { await new Promise((resolve) => upstream.close(resolve)); });
beforeEach(() => { seen = []; });

const serviceUrl = () => `http://127.0.0.1:${upstream.address().port}`;
const liveApp = () => createApp({
  session: { secret: 'gateway-test-secret' },
  services: { auth: serviceUrl(), rooms: serviceUrl(), bookings: serviceUrl() },
});

describe('the door to the services', () => {
  it('forwards a public read through to the service that owns it', async () => {
    const response = await request(liveApp()).get('/api/v1/room-types').expect(200);
    expect(response.body.room_types[0].name).toBe('Garden Double');
    // `/api` is the public prefix; the service is asked for `/v1/...`.
    expect(seen[0].url).toBe('/v1/room-types');
  });

  it('preserves the service\'s own 404 instead of answering with the page', async () => {
    const response = await request(liveApp()).get('/api/v1/room-types/507f1f77bcf86cd799439099').expect(404);
    expect(response.body).toEqual({ error: 'That room type is not one of ours.' });
  });

  it('never swallows an api path with the single-page fallback', async () => {
    const response = await request(liveApp()).get('/api/v1/nothing-here').expect(404);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body.error).toBeTruthy();
  });

  it('answers 503 when a service is not running, never 200 with an empty body', async () => {
    const dead = createApp({
      session: { secret: 'gateway-test-secret' },
      services: { auth: 'http://127.0.0.1:1', rooms: 'http://127.0.0.1:1', bookings: 'http://127.0.0.1:1' },
    });
    const response = await request(dead).get('/api/v1/room-types').expect(503);
    expect(response.body.error).toMatch(/unavailable/i);
  });
});

describe('the session cookie, which only the gateway may set', () => {
  it('starts a session on a successful sign-in and sends the identity inward as headers', async () => {
    const app = liveApp();
    const signIn = await request(app).post('/api/v1/auth/login')
      .send({ email: 'marta.ferreira@example.com', password: 'Demo!2026' }).expect(200);

    const cookie = signIn.headers['set-cookie'].join(';');
    expect(cookie).toContain('hi_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie.toLowerCase()).toContain('samesite=lax');
    expect(signIn.body.account.role).toBe('guest');

    // The next request carries only the cookie; the gateway reads it and tells
    // the service who is asking.
    await request(app).get('/api/v1/bookings').set('Cookie', cookie).expect(200);
    const forwarded = seen.at(-1);
    expect(forwarded.userId).toBe('507f1f77bcf86cd799439012');
    expect(forwarded.role).toBe('guest');
  });

  it('starts no session when the sign-in is refused', async () => {
    const upstreamRefusal = http.createServer((req, res) => json(res, 401, { error: 'Email or password is not right' }));
    await new Promise((resolve) => upstreamRefusal.listen(0, '127.0.0.1', resolve));
    const app = createApp({
      session: { secret: 'gateway-test-secret' },
      services: { auth: `http://127.0.0.1:${upstreamRefusal.address().port}`, rooms: serviceUrl(), bookings: serviceUrl() },
    });

    const response = await request(app).post('/api/v1/auth/login')
      .send({ email: 'marta.ferreira@example.com', password: 'wrong' }).expect(401);
    expect(response.headers['set-cookie']).toBeUndefined();
    await new Promise((resolve) => upstreamRefusal.close(resolve));
  });

  it('refuses a protected door without a session, and clears the cookie on sign-out', async () => {
    const app = liveApp();
    await request(app).get('/api/v1/bookings').expect(401);

    const signIn = await request(app).post('/api/v1/auth/login')
      .send({ email: 'marta.ferreira@example.com', password: 'Demo!2026' }).expect(200);
    const cookie = signIn.headers['set-cookie'].join(';');

    const out = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie).expect(200);
    expect(out.headers['set-cookie'].join(';')).toMatch(/hi_session=;|hi_session=$|Expires=Thu, 01 Jan 1970/i);
  });

  it('sends a guest nowhere near the desk\'s doors', async () => {
    const app = liveApp();
    const signIn = await request(app).post('/api/v1/auth/login')
      .send({ email: 'marta.ferreira@example.com', password: 'Demo!2026' }).expect(200);
    const cookie = signIn.headers['set-cookie'].join(';');

    const response = await request(app).get('/api/v1/staff/bookings').set('Cookie', cookie).expect(403);
    expect(response.body.error).toEqual(expect.any(String));
    // The refusal happens at the door: the service was never asked.
    expect(seen.some((call) => call.url.startsWith('/v1/staff/bookings'))).toBe(false);
  });
});

describe('readiness and the response headers', () => {
  it('reports its own readiness without claiming the services are healthy', async () => {
    const response = await request(liveApp()).get('/ready').expect(200);
    expect(response.body.ok).toBe(true);
    expect(Object.keys(response.body)).not.toContain('services');
  });

  it('answers the same readiness at /health, the path every package in this stack uses', async () => {
    const response = await request(liveApp()).get('/health').expect(200);
    expect(response.body.ok).toBe(true);
  });

  it('sends the security headers and does not name its framework', async () => {
    const response = await request(liveApp()).get('/ready').expect(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['content-security-policy']).toMatch(/frame-ancestors 'none'/);
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('lets only the origins FRAME_ANCESTORS names frame it', async () => {
    process.env.FRAME_ANCESTORS = "'self' https://partner.example";
    try {
      const response = await request(liveApp()).get('/ready').expect(200);
      expect(response.headers['content-security-policy']).toMatch(/frame-ancestors 'self' https:\/\/partner\.example/);
      expect(response.headers['x-frame-options']).toBeUndefined();   // it cannot name another origin
    } finally {
      delete process.env.FRAME_ANCESTORS;
    }
  });

  it('reads its own settings with a default that works on a developer machine', () => {
    const defaults = loadConfig({});
    expect(defaults.port).toBeGreaterThan(0);
  });
});
