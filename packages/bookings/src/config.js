/**
 * Every value this service needs, read once, with a default that works on a
 * developer machine.
 */
export function loadConfig(env = process.env) {
  return {
    port: Number(env.SERVICE_PORT ?? env.BOOKINGS_PORT ?? 4003),
    mongoUri: env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/examplehotel',
    // The address the site is served on. PayPal returns the guest to it after a
    // payment, so it must be the address the guest really sees - behind nginx
    // and CloudFront the request's own host is the origin, not the site.
    siteUrl: String(env.SITE_URL ?? '').trim().replace(/\/+$/, ''),
    // Room types, availability and the hotel's details belong to the rooms
    // service; the guest's own name and confirmation state belong to auth.
    roomsUrl: env.ROOMS_URL ?? `http://127.0.0.1:${env.ROOMS_PORT ?? 4002}`,
    authUrl: env.AUTH_URL ?? `http://127.0.0.1:${env.AUTH_PORT ?? 4001}`,
    internalToken: env.SESSION_SECRET ?? 'development-only-secret',
    paypal: {
      // Sandbox first. The live base is the same API with the other host, so
      // the hotel only has to change PAYPAL_ENV and its credentials.
      environment: env.PAYPAL_ENV ?? 'sandbox',
      clientId: env.PAYPAL_CLIENT_ID ?? '',
      clientSecret: env.PAYPAL_CLIENT_SECRET ?? '',
      webhookId: env.PAYPAL_WEBHOOK_ID ?? '',
      currency: 'EUR',
      timeoutMs: 15000,
    },
    mail: {
      provider: env.EMAIL_PROVIDER ?? 'resend',
      apiKey: env.EMAIL_API_KEY ?? '',
      from: env.MAIL_FROM ?? 'stay@hotelindoora.com',
      hotelName: env.HOTEL_NAME ?? 'hotelIndoora',
    },
    // The specification's own numbers.
    holdMinutes: 30,
    refundConfirmationSeconds: 30,
    paymentLinkDays: 7,
  };
}
