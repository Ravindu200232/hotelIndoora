import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { connectDb } from './db.js';

// The only file that binds a port. scripts/dev-all.mjs looks for exactly this
// path when it discovers the services to start.
const config = loadConfig();
if (!config.photos.supabaseUrl || !config.photos.serviceRoleKey) {
  console.warn('[rooms] room photographs are not connected yet: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set before staff can upload one');
}
await connectDb(config.mongoUri);
createApp(config).listen(config.port, '127.0.0.1', () => {
  console.log('rooms service listening on ' + config.port);
});
