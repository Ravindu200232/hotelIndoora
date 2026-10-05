/**
 * What the gateway answers on its session doors, and why. Development aid.
 */
import http from 'node:http';
import request from 'supertest';
import { createApp } from '../src/app.js';

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

const upstream = http.createServer((req, res) => {
  console.log('  upstream asked:', req.method, req.url);
  if (req.url.startsWith('/v1/auth/login')) {
    return json(res, 200, { account: { id: '507f1f77bcf86cd799439012', role: 'guest', full_name: 'Marta Ferreira' } });
  }
  if (req.url.startsWith('/v1/bookings')) return json(res, 200, { bookings: [] });
  return json(res, 404, { error: 'Not found' });
});
await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${upstream.address().port}`;

const app = createApp({ session: { secret: 'debug-secret' }, services: { auth: base, rooms: base, bookings: base } });

const plain = await request(app).get('/api/v1/bookings');
console.log('GET bookings without a session ->', plain.status, JSON.stringify(plain.body));

const signIn = await request(app).post('/api/v1/auth/login').send({ email: 'marta.ferreira@example.com', password: 'Demo!2026' });
console.log('POST login ->', signIn.status, JSON.stringify(signIn.body));
console.log('set-cookie:', signIn.headers['set-cookie']);

await new Promise((resolve) => upstream.close(resolve));
