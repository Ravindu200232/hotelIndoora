/**
 * Every value this service needs, read once, with a default that works on a
 * developer machine. Reading process.env deeper in the code is what makes a
 * service impossible to test.
 */
export function loadConfig(env = process.env) {
  return {
    port: Number(env.SERVICE_PORT ?? env.AUTH_PORT ?? 4001),
    mongoUri: env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/examplehotel',
    // The account deletion is the only thing here that touches another service:
    // a guest's future bookings must be cancelled and refunded before any
    // personal detail is erased, and that is the bookings service's job.
    bookingsUrl: env.BOOKINGS_URL ?? `http://127.0.0.1:${env.BOOKINGS_PORT ?? 4003}`,
    internalToken: env.SESSION_SECRET ?? 'development-only-secret',
    mail: {
      provider: env.EMAIL_PROVIDER ?? 'resend',
      apiKey: env.EMAIL_API_KEY ?? '',
      from: env.MAIL_FROM ?? 'stay@hotelindoora.com',
      hotelName: env.HOTEL_NAME ?? 'hotelIndoora',
    },
    confirmationHours: 24,
    inviteHours: 72,
    resendLimitPerHour: 5,
    signInAttempts: 5,
    lockoutMinutes: 15,
  };
}
