/**
 * Does this server reach the database, and what is in it?
 *
 * Read-only, and safe to run on a live server: it connects with the
 * environment's own MONGODB_URI, names the database it reached, and counts the
 * documents in the collections the site reads. It writes nothing, deletes
 * nothing and never prints a connection string - only the database's own name
 * and the counts, so a deployment can prove the deployed application reaches
 * the hotel's data rather than a copy of it.
 *
 *   set -a; . /etc/hotelindoora/env; set +a; node scripts/check-database.mjs
 */
import mongoose from 'mongoose';

const uri = String(process.env.MONGODB_URI ?? '').trim();
if (!uri) {
  console.error('MONGODB_URI is not set: nothing can be read.');
  process.exit(1);
}
if (/127\.0\.0\.1|localhost/i.test(uri)) {
  console.error('MONGODB_URI points at the machine itself, which is not a deployed database.');
  process.exit(1);
}

const collections = ['hoteldetails', 'roomtypes', 'roomblocks', 'bookings', 'payments', 'guestaccounts', 'staffaccounts'];

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const database = mongoose.connection.name;
  const db = mongoose.connection.db;
  const counts = {};
  for (const name of collections) counts[name] = await db.collection(name).countDocuments();
  console.log(`connected to the database "${database}"`);
  for (const [name, count] of Object.entries(counts)) console.log(`  ${name}: ${count}`);
  await mongoose.disconnect();
} catch (error) {
  console.error(`the database could not be reached: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
}
