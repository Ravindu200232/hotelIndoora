/**
 * Does every call the client makes reach a route that exists?
 *
 * The gateway and the three services are built here without listening on
 * anything, and their own routing tables are walked. Each API path the client
 * calls is then resolved: it must match a gateway mount, and the path that mount
 * forwards must match a route inside the service it points at. This is the check
 * that the parts are connected — no server, no traffic, just the real routers.
 */
import express from 'express';
import { readFileSync } from 'node:fs';
import { createApp as createGateway } from '../packages/gateway/src/app.js';
import { createApp as createAuth } from '../packages/auth/src/app.js';
import { createApp as createRooms } from '../packages/rooms/src/app.js';
import { createApp as createBookings } from '../packages/bookings/src/app.js';

/** Every route an Express app has, as `METHOD /path`, mounts included. */
function routesOf(app, prefix = '') {
  const found = [];
  const stack = app._router?.stack ?? [];
  for (const layer of stack) {
    if (layer.route) {
      const path = prefix + layer.route.path;
      for (const method of Object.keys(layer.route.methods)) {
        if (method === '_all') continue;
        found.push(`${method.toUpperCase()} ${path}`);
      }
      continue;
    }
    if (layer.name === 'router' && layer.handle?.stack) {
      // Express turns a mount path into a regexp; read the literal prefix back.
      // A nested mount composes its own regex, so the parenthesised parameter
      // groups have to be read as parameters again.
      const literal = (layer.regexp?.source ?? '')
        .replace(/^\^/, '')
        .replace(/\\\//g, '/')
        .replace(/\(\?:\/\(\[\^\/\]\+\?\)\)/g, '/:param')
        .replace(/\(\?:\/\(\[[^\]]+\]\)\)/g, '/:param')
        .replace(/\/\?\(\?=\/\|\$\)/, '')
        .replace(/\/\?$/, '')
        .replace(/\(\?:\.\*\)/g, ':rest');
      const nested = layer.handle;
      const clean = literal === '/' || literal === '' ? prefix : prefix + literal;
      found.push(...routesOf({ _router: nested }, clean));
    }
  }
  return found;
}

/** The paths the client actually calls, read out of its own API client. */
function clientPaths() {
  const source = readFileSync('client/src/api.js', 'utf8');
  const paths = new Set();
  for (const match of source.matchAll(/(?:request|post|patch|put|del)\(\s*[`'"]([^`'"]+)[`'"]/g)) {
    const path = match[1].split('?')[0].replace(/\$\{[^}]*\}/g, ':param');
    if (path.startsWith('/')) paths.add(path);
  }
  return [...paths].sort();
}

const matches = (pattern, path) => {
  const asParts = (value) => value.split('/').filter(Boolean);
  const patternParts = asParts(pattern);
  const pathParts = asParts(path);
  if (patternParts.length !== pathParts.length) return false;
  return patternParts.every((part, index) => part.startsWith(':') || part === pathParts[index]);
};

const gateway = createGateway({ session: { secret: 'wiring-check-only' }, production: false });
const services = {
  auth: routesOf(createAuth({ mongoUri: 'mongodb://127.0.0.1:27017/wiring_check' })),
  rooms: routesOf(createRooms({ mongoUri: 'mongodb://127.0.0.1:27017/wiring_check' })),
  bookings: routesOf(createBookings({ mongoUri: 'mongodb://127.0.0.1:27017/wiring_check' })),
};

// Where the gateway sends each public prefix, as the gateway itself declares it.
const MOUNTS = [
  ['/auth', 'auth'],
  ['/account', 'auth'],
  ['/staff/team', 'auth'],
  ['/hotel-details', 'rooms'],
  ['/room-types', 'rooms'],
  ['/availability', 'rooms'],
  ['/staff/room-types', 'rooms'],
  ['/staff/hotel-details', 'rooms'],
  ['/bookings', 'bookings'],
  ['/staff/bookings', 'bookings'],
  ['/staff/dashboard', 'bookings'],
  ['/paypal', 'bookings'],
];

const gatewayRoutes = routesOf(gateway).filter((route) => route.includes('/api/v1'));

if (process.argv.includes('--list')) {
  for (const [name, list] of Object.entries(services)) {
    console.log(`--- ${name}`);
    list.filter((route) => !route.includes('/internal')).forEach((route) => console.log(`  ${route}`));
  }
  console.log('--- gateway');
  gatewayRoutes.forEach((route) => console.log(`  ${route}`));
  process.exit(0);
}

const unresolved = [];
const resolved = [];
const handledByGateway = (path) => gatewayRoutes.some((route) => {
  const [, pattern] = route.split(' ');
  return matches(pattern.replace(/^\/api\/v1/, ''), path);
});

for (const path of clientPaths()) {
  if (handledByGateway(path)) {
    resolved.push(`${path} → the gateway itself`);
    continue;
  }
  const mount = MOUNTS.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  if (!mount) {
    unresolved.push(`${path} — no gateway mount carries it`);
    continue;
  }
  const [prefix, service] = mount;
  const wanted = path.slice(prefix.length) || '/';
  const hit = services[service].some((route) => {
    const [, pattern] = route.split(' ');
    const servicePath = pattern.replace(/^\/v1/, '');
    return matches(servicePath, `${prefix}${wanted}`) || matches(servicePath, wanted);
  });
  if (hit) resolved.push(`${path} → ${service}`);
  else unresolved.push(`${path} → ${service}${wanted} — no route in ${service}`);
}

console.log(`gateway routes under /api/v1: ${gatewayRoutes.length}`);
console.log(`client calls checked: ${resolved.length + unresolved.length}`);
resolved.forEach((line) => console.log(`  ok   ${line}`));
unresolved.forEach((line) => console.log(`  MISS ${line}`));

if (unresolved.length) {
  console.error(`\n${unresolved.length} client call(s) reach nothing.`);
  process.exit(1);
}
console.log('\nEvery call the client makes reaches a mounted route in the service that answers it.');
console.log(`express is available to both scripts and the services: ${typeof express === 'function'}`);
