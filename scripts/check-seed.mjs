/**
 * A read-only look at what the seed put in the database, using the same queries
 * the desk's dashboard uses — a check that the pages open filled, not a write.
 */
import mongoose from 'mongoose';
import { existsSync, readFileSync } from 'node:fs';
import { Booking } from '../packages/bookings/src/models/Booking.js';
import { Payment } from '../packages/bookings/src/models/Payment.js';
import { RoomType } from '../packages/rooms/src/models/RoomType.js';
import { RoomBlock } from '../packages/rooms/src/models/RoomBlock.js';
import { GuestAccount } from '../packages/auth/src/models/GuestAccount.js';
import { StaffAccount } from '../packages/auth/src/models/StaffAccount.js';

function mongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue;
    const match = readFileSync(file, 'utf8').match(/^\s*(?:export\s+)?MONGODB_URI\s*=\s*['"]?(.*?)['"]?\s*$/m);
    if (match) return match[1];
  }
  return 'mongodb://127.0.0.1:27017/examplehotel';
}

const uri = mongoUri();
await mongoose.connect(uri);

const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
const tomorrow = new Date(today.getTime() + 86400000);

const arrivals = await Booking.countDocuments({ status: 'confirmed', check_in_date: { $gte: today, $lt: tomorrow } });
const departures = await Booking.countDocuments({ status: 'confirmed', check_out_date: { $gte: today, $lt: tomorrow } });
const upcoming = await Booking.countDocuments({ status: 'confirmed', check_in_date: { $gte: tomorrow } });
const waiting = await Booking.find({ status: 'pending_payment' });

console.log(`today ${today.toISOString().slice(0, 10)}`);
console.log(`dashboard: arrivals today ${arrivals} | departures today ${departures} | upcoming ${upcoming} | waiting ${waiting.length} (taken by staff ${waiting.filter((b) => b.booked_by_staff_account_id).length}, held on a timer ${waiting.filter((b) => b.hold_expires_at).length})`);
console.log(`bookings ${await Booking.countDocuments({})} across ${(await Booking.distinct('room_type_id')).length} room types | payments ${await Payment.countDocuments({})}`);
console.log(`room types ${await RoomType.countDocuments({})} (on sale ${await RoomType.countDocuments({ on_sale: true })}) | blocks ahead ${await RoomBlock.countDocuments({ last_night: { $gte: today } })}`);
console.log(`accounts: staff ${await StaffAccount.countDocuments({})}, guests ${await GuestAccount.countDocuments({})}`);
console.log(`demo staff can sign in: ${await StaffAccount.countDocuments({ email: 'hotel.staff@example.com', status: 'active' })} | demo guest can sign in: ${await GuestAccount.countDocuments({ email: 'marta.ferreira@example.com', email_confirmed: true })}`);
const guestBookings = await GuestAccount.findOne({ email: 'marta.ferreira@example.com' }).then((guest) => Booking.countDocuments({ booked_by_guest_account_id: guest._id }));
console.log(`the demo guest holds ${guestBookings} bookings`);

await mongoose.disconnect();
