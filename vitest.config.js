import { defineConfig } from 'vitest/config';

/**
 * Root settings for `npm run test:coverage`. Which suites run, and how, is decided by
 * `vitest.workspace.js` (each package and the client bring their own config).
 *
 * Every source file is listed, tested or not, so a route or page nothing tests shows as 0 % instead
 * of being missing. `npm run qa:inventory` says which unit is untested.
 */
export default defineConfig({
  test: {
    // Every file runs one at a time across the whole suite.
    //
    // The service suites create, change and clear records in a real database, and
    // Vitest ignores `fileParallelism` set inside a project config when it runs
    // in workspace mode — so it has to be here, at the root, or two files clear
    // each other's fixtures and the failures read as product defects.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: '.agentforge/qa/coverage',
      include: ['packages/*/src/**/*.js', 'client/src/**/*.{js,jsx}'],
      exclude: ['**/*.test.*', '**/server.js', '**/main.jsx', '**/config.js', '**/db.js'],
    },
  },
});
