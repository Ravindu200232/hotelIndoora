import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { connectDb } from './db.js';

// The only file that binds a port. scripts/dev-all.mjs looks for exactly this
// path when it discovers the services to start.
const config = loadConfig();
if (!config.mail.apiKey) {
  console.warn('[auth] EMAIL_API_KEY is not set: confirmation emails and staff invitations will report a clear failure until the hotel supplies the key');
}
await connectDb(config.mongoUri);
createApp(config).listen(config.port, '127.0.0.1', () => {
  console.log('auth service listening on ' + config.port);
});
