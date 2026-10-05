import { defineConfig } from 'vitest/config';
import { ownTestDatabase } from 'testing';

/**
 * The auth suite, against a database of its own.
 *
 * The three service suites run together under one command, and every one of them
 * clears every collection between its tests: without a database each, one suite
 * wipes another's fixtures and the failures read as product defects.
 */
export default defineConfig({
  test: {
    // Server code runs in Node. Moving it into a browser-like environment to
    // make something pass hides the environment the code actually runs in.
    environment: 'node',
    include: ['test/**/*.test.js'],
    env: { TEST_MONGODB_URI: ownTestDatabase(process.env.TEST_MONGODB_URI, 'auth') },
    // Run the files in this suite sequentially as well: they share the database.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
