import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
if (!config.session.secret) {
  if (config.production) {
    // A gateway that signs cookies with a throwaway secret would log every
    // visitor out on restart and let anyone forge a session.
    throw new Error('SESSION_SECRET must be set in production');
  }
  console.warn('[gateway] SESSION_SECRET is not set: using a development-only secret');
}
createApp(config).listen(config.port, '127.0.0.1', () => {
  console.log('gateway listening on http://127.0.0.1:' + config.port);
});
