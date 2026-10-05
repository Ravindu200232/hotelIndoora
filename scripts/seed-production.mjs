/**
 * The hotel's *production* starting data, and the first staff account.
 *
 * It writes only what a running hotel needs to open:
 *   - the hotel's own public details, and
 *   - the room types it sells, with the rooms each one has.
 *
 * It writes nothing demo: no demo guests, no demo bookings, no demo password —
 * a public address never gets demo accounts. Every write is an upsert keyed on
 * something unique, so running it twice changes nothing, and it never drops a
 * collection, never deletes a document and never sets a password.
 *
 * The first staff account has no password at all: an invitation is created (or
 * re-issued) and the application's own mailer sends the single-use link that
 * lets the hotel set its own password. Nothing here can read that password.
 *
 * Run it with MONGODB_URI, STAFF_EMAIL, STAFF_NAME and the mail settings in the
 * environment, and SITE_URL naming the address the invitation should point at:
 *
 *   node scripts/seed-production.mjs
 */
import mongoose from 'mongoose';
import { existsSync, readFileSync } from 'node:fs';

import { loadConfig as loadAuthConfig } from '../packages/auth/src/config.js';
import { StaffAccount } from '../packages/auth/src/models/StaffAccount.js';
import { RoomType } from '../packages/rooms/src/models/RoomType.js';
import { HotelDetails } from '../packages/rooms/src/models/HotelDetails.js';
import { createToken, inviteLink } from '../packages/auth/src/lib/tokens.js';
import { inviteEmail, sendMail } from '../packages/auth/src/lib/mailer.js';
import { HOTEL, ROOM_TYPES } from './seed.mjs';

function mongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue;
    const match = readFileSync(file, 'utf8').match(/^\s*(?:export\s+)?MONGODB_URI\s*=\s*['"]?(.*?)['"]?\s*$/m);
    if (match) return match[1];
  }
  return '';
}

const uri = mongoUri();
if (!uri) {
  console.error('MONGODB_URI is not set: nothing is written. The deployed services need a real, internet-reachable cluster.');
  process.exit(1);
}
if (/127\.0\.0\.1|localhost/i.test(uri)) {
  console.error('MONGODB_URI points at this computer: a production database must be reachable from the host. Nothing is written.');
  process.exit(1);
}

const staffEmail = String(process.env.STAFF_EMAIL ?? '').trim().toLowerCase();
const staffName = String(process.env.STAFF_NAME ?? '').trim();
if (!staffEmail || !staffEmail.includes('@') || !staffName) {
  console.error('STAFF_EMAIL and STAFF_NAME must both be set: they are the first staff account, and there is no public staff sign-up. Nothing is written.');
  process.exit(1);
}
const siteUrl = String(process.env.SITE_URL ?? '').trim().replace(/\/+$/, '');

const config = loadAuthConfig(process.env);

async function seed() {
  await mongoose.connect(uri);
  const counts = {};

  // ---- the hotel's own public details: one record, always the same one ------
  await HotelDetails.findOneAndUpdate({}, HOTEL, { upsert: true, new: true, setDefaultsOnInsert: true });
  counts.hotel_details = 1;

  // ---- the room types the hotel sells, and how many rooms each has ----------
  for (const roomType of ROOM_TYPES) {
    await RoomType.findOneAndUpdate({ name: roomType.name }, roomType, { upsert: true, new: true, setDefaultsOnInsert: true });
  }
  counts.room_types = ROOM_TYPES.length;

  // ---- the first staff account: invited, never given a password -------------
  const existing = await StaffAccount.findOne({ email: staffEmail });
  if (existing?.status === 'active' && existing.password_hash !== undefined) {
    counts.staff_account = 'already active: left exactly as it is';
  } else {
    const { token, expiresAt } = createToken(config.inviteHours);
    if (existing) {
      existing.full_name = staffName;
      existing.invite_token = token;
      existing.invite_expires_at = expiresAt;
      await existing.save();
      counts.staff_account = 'invitation re-issued';
    } else {
      await StaffAccount.create({
        full_name: staffName,
        email: staffEmail,
        invite_token: token,
        invite_expires_at: expiresAt,
        added_at: new Date(),
        status: 'invited',
      });
      counts.staff_account = 'invited';
    }

    // The application's own mailer sends it; a refusal is reported, never
    // swapped for a success.
    await sendMail(
      {
        to: staffEmail,
        ...inviteEmail({
          hotelName: config.mail.hotelName,
          fullName: staffName,
          invitedBy: `${config.mail.hotelName} itself, at the first deployment`,
          link: inviteLink(token, siteUrl),
        }),
      },
      config,
    );
    counts.invitation_email = 'sent to the address given for the first staff account';
  }

  console.log('production starting data written:');
  for (const [key, value] of Object.entries(counts)) console.log(`  ${key}: ${value}`);
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error('the production starting data could not be written:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
