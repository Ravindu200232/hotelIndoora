import mongoose from 'mongoose';

/**
 * The three things every suite that touches MongoDB needs, written once.
 *
 * Copied into each test file instead, they drift: one file forgets to clear
 * between tests, another connects per test and exhausts the pool, and the
 * failures read as product bugs in whichever suite happens to run second.
 *
 * Tests get a database of their own. This helper deliberately does NOT read
 * `MONGODB_URI`: that is the application's database, and `clearCollections()`
 * deletes every document in whatever it is connected to. Set `TEST_MONGODB_URI`
 * to use another server; its database name must end in `_test`, and anything else
 * is refused before a single document is touched.
 */
const TEST_URI = process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/examplehotel_test';

const databaseName = (uri) => decodeURIComponent(uri.split('?')[0].replace(/\/+$/, '').split('/').pop() ?? '');

function assertTestDatabase(name) {
  if (!name.endsWith('_test')) {
    throw new Error(
      `Refusing to use database "${name}": a test database's name must end in "_test". `
      + 'Unset TEST_MONGODB_URI, or point it at a database such as "myapp_test".',
    );
  }
}

/** Connect once per process. `readyState` 1 is connected, 0 is disconnected. */
export async function connectTestDb(uri = TEST_URI) {
  assertTestDatabase(databaseName(uri));
  if (mongoose.connection.readyState === 1) {
    // A suite that asks for another database must not inherit the one an earlier
    // suite in the same process left open: it would then clear that suite's
    // fixtures as if they were its own, and the failure reads as a product bug.
    if (mongoose.connection.name === databaseName(uri)) return mongoose.connection;
    await mongoose.disconnect();
  }
  await mongoose.connect(uri);
  return mongoose.connection;
}

/**
 * Empty every collection.
 *
 * Call it in `beforeEach`, not `beforeAll`: a document left behind changes the
 * next test's result, and that failure reads as a defect in the code under
 * test rather than in the fixture.
 */
export async function clearCollections() {
  assertTestDatabase(mongoose.connection.name);
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

/** Close in `afterAll`, or the runner hangs on an open handle. */
export async function closeTestDb() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

/**
 * The same server and credentials, with a database of this suite's own.
 *
 * The suites of the three services run together, and every one of them clears
 * every collection between its tests. Sharing one database means one suite wipes
 * another's fixtures mid-test, and the failures read as product defects, so each
 * suite derives its own name from TEST_MONGODB_URI — keeping the host, the
 * credentials and any connection options, and ending in `_test` as required.
 */
export function ownTestDatabase(uri, suite, fallback = 'mongodb://127.0.0.1:27017/examplehotel_test') {
  const source = String(uri ?? '').trim() || fallback;
  const [beforeQuery, ...queryParts] = source.split('?');
  const query = queryParts.length ? `?${queryParts.join('?')}` : '';
  const lastSlash = beforeQuery.lastIndexOf('/');
  const authority = lastSlash > 'mongodb://'.length ? beforeQuery.slice(0, lastSlash + 1) : `${beforeQuery.replace(/\/+$/, '')}/`;
  const name = decodeURIComponent(beforeQuery.slice(lastSlash + 1)) || 'examplehotel_test';
  return `${authority}${name.replace(/_test$/, '')}_${suite}_test${query}`;
}

/**
 * A service's app is a value, so a suite drives it with supertest and never
 * binds a port. `createApp()` in each service is what makes this possible.
 */
export { default as request } from 'supertest';
