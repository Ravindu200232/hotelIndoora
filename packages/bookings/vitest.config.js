import { defineConfig } from 'vitest/config';
import { ownTestDatabase } from 'testing';

/**
 * The bookings suite, against a database of its own — see the auth config for why.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    env: { TEST_MONGODB_URI: ownTestDatabase(process.env.TEST_MONGODB_URI, 'bookings') },
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
