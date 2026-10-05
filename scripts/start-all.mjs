import { spawn } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { freePort } from './port-guard.mjs';

/**
 * Start every service and the gateway in production, as one process tree.
 *
 * `npm start` runs the gateway alone, which is right where a process manager
 * starts each service itself - on EC2 every service gets its own systemd unit.
 * A platform that runs one command for the whole app, like an Azure App
 * Service, would start the gateway and nothing behind it: a front door
 * proxying to ports where nobody is listening.
 *
 * The host gives one public port in PORT. The gateway takes it; each service
 * gets an internal port of its own and the gateway is told where it is, using
 * the same `<NAME>_PORT` names its config already reads.
 */
const packagesDir = 'packages';
const isGateway = (name) => name.includes('gateway');

const found = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory()
    && existsSync(path.join(packagesDir, entry.name, 'src/server.js')))
  .map((entry) => entry.name);

const gateway = found.find(isGateway);
const services = found.filter((name) => !isGateway(name));

if (!gateway) {
  console.error('No gateway found. The gateway is packages/<name>-gateway/src/server.js');
  process.exit(1);
}

// Internal ports, one per service, away from the public one. Every process is
// told where the others are, by the same `<NAME>_PORT` names each config already
// reads: a service that cannot reach the service beside it answers 503 for data
// it owns none of — availability that never counts the rooms already booked, an
// account deletion that cannot ask for its refund — and the gateway cannot fix
// that from where it stands.
const FIRST_INTERNAL = Number(process.env.INTERNAL_PORT_BASE ?? 4001);
const addresses = {};
services.forEach((name, index) => {
  addresses[name] = FIRST_INTERNAL + index;
});

const internalEnv = {};
for (const [name, port] of Object.entries(addresses)) {
  internalEnv[`${name.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}_PORT`] = String(port);
}

await Promise.all([
  freePort(Number(process.env.PORT ?? 4000)),
  ...Object.values(addresses).map(freePort),
]);

const children = [];
let stopping = false;

function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) { try { child.kill(); } catch { /* already gone */ } }
  process.exit(code);
}

function start(name, env) {
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: path.join(packagesDir, name),
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? 'production', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stdout.write('[' + name + '] ' + chunk));
  child.stderr.on('data', (chunk) => process.stderr.write('[' + name + '] ' + chunk));
  // One dead service takes the tree down, so the host restarts the whole app.
  // A gateway still answering while the service behind it is gone returns 502s
  // that look like a networking fault instead of a crash.
  child.on('exit', (code) => {
    if (!stopping) console.error('[' + name + '] exited with code ' + code);
    stopAll(code ?? 1);
  });
  children.push(child);
}

for (const name of services) {
  start(name, { ...internalEnv, SERVICE_PORT: String(addresses[name]) });
}

// The gateway goes last: a client that reaches it before the services are
// listening sees avoidable 503s.
const gatewayEnv = { ...internalEnv, PORT: String(process.env.PORT ?? 4000) };
start(gateway, gatewayEnv);

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
