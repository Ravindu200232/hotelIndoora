/**
 * Every value this service needs, read once, with a default that works on a
 * developer machine.
 */
export function loadConfig(env = process.env) {
  return {
    port: Number(env.SERVICE_PORT ?? env.ROOMS_PORT ?? 4002),
    mongoUri: env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/examplehotel',
    // Availability needs what is booked, and bookings belong to the bookings
    // service: this service asks for the counts rather than reading its data.
    bookingsUrl: env.BOOKINGS_URL ?? `http://127.0.0.1:${env.BOOKINGS_PORT ?? 4003}`,
    internalToken: env.SESSION_SECRET ?? 'development-only-secret',
    photos: {
      // Room type photographs are stored in one Supabase Storage bucket; the
      // room type document keeps the object path. The service-role key is read
      // here, on the server, and never travels to the browser.
      supabaseUrl: env.SUPABASE_URL ?? '',
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      bucket: env.ROOM_PHOTOS_BUCKET ?? 'room-type-photos',
      maxPerRoomType: 10,
      maxBytes: 5 * 1024 * 1024,
      formats: ['image/jpeg', 'image/png', 'image/webp'],
    },
  };
}
