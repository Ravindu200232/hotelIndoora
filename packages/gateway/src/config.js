/**
 * The gateway owns the only public port. Every service address is internal and
 * discovered from configuration, never hardcoded at a call site.
 */
export function loadConfig(env = process.env) {
  const url = (name, port) => env[`${name}_URL`] ?? `http://127.0.0.1:${env[`${name}_PORT`] ?? port}`;
  return {
    port: Number(env.PORT ?? 4000),
    production: env.NODE_ENV === 'production',
    session: {
      // A signed httpOnly cookie carries the session. Without a secret the
      // gateway must not pretend: it refuses to start in production.
      secret: env.SESSION_SECRET ?? '',
      cookieName: 'hi_session',
      absoluteMinutes: 12 * 60,
      idleMinutes: 60,
    },
    services: {
      auth: url('AUTH', 4001),
      rooms: url('ROOMS', 4002),
      bookings: url('BOOKINGS', 4003),
    },
  };
}
