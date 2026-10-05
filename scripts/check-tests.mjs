/**
 * What the existing suites cover, so this phase adds business tests the app needs
 * rather than repeating what is already there. Read-only.
 */
import { readFileSync, existsSync } from 'node:fs';

const files = [
  'client/test/setup.js',
  'client/test/helpers.js',
  'client/test/api.test.js',
  'client/test/App.test.jsx',
  'packages/auth/test/auth.test.js',
  'packages/rooms/test/rooms.test.js',
  'packages/bookings/test/bookings.test.js',
  'packages/gateway/test/gateway.test.js',
  'packages/testing/index.js',
];

for (const file of files) {
  if (!existsSync(file)) {
    console.log(`${file}: MISSING`);
    continue;
  }
  const source = readFileSync(file, 'utf8');
  const names = [];
  const pattern = /(?:^|\n)\s*(?:it|test)\(\s*['"`](.+?)['"`]/g;
  let match = pattern.exec(source);
  while (match) {
    names.push(match[1]);
    match = pattern.exec(source);
  }
  console.log(`--- ${file} (${source.split('\n').length} lines, ${names.length} tests)`);
  names.slice(0, 60).forEach((name) => console.log(`    ${name}`));
}
