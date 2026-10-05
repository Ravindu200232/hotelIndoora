import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { connectDb } from './db.js';

// The only file that binds a port. scripts/dev-all.mjs looks for exactly this
// path when it discovers the services to start.
const config = loadConfig();
if (!config.paypal.clientId || !config.paypal.clientSecret) {
  console.warn(`[bookings] PayPal (${config.paypal.environment}) is not connected yet: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set before a payment can be taken`);
}
if (!config.mail.apiKey) {
  console.warn('[bookings] EMAIL_API_KEY is not set: booking confirmations, change notices and payment links will report a clear failure until the hotel supplies the key');
}
await connectDb(config.mongoUri);
createApp(config).listen(config.port, '127.0.0.1', () => {
  console.log('bookings service listening on ' + config.port);
});
