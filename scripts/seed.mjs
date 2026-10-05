import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * The hotel's starting data, and the prototype's demo account.
 *
 * Every write is an upsert keyed on something unique, so running this twice
 * changes nothing and running it after a real booking does not touch that
 * booking. It never drops a collection and never deletes a document: the
 * connected database is the hotel's, and it persists across previews.
 *
 * The sample data is the approved prototype's own: the same hotel details, the
 * same six room types with the same rates, room counts, sizes and photographs,
 * the same guest's bookings and payments, and the same blocked nights - so the
 * pages open filled exactly as the prototype does.
 */
import { loadConfig as loadAuthConfig } from '../packages/auth/src/config.js';
import { GuestAccount } from '../packages/auth/src/models/GuestAccount.js';
import { StaffAccount } from '../packages/auth/src/models/StaffAccount.js';
import { RoomType } from '../packages/rooms/src/models/RoomType.js';
import { RoomBlock } from '../packages/rooms/src/models/RoomBlock.js';
import { HotelDetails } from '../packages/rooms/src/models/HotelDetails.js';
import { Booking } from '../packages/bookings/src/models/Booking.js';
import { Payment } from '../packages/bookings/src/models/Payment.js';

function mongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue;
    const match = readFileSync(file, 'utf8').match(/^\s*(?:export\s+)?MONGODB_URI\s*=\s*['"]?(.*?)['"]?\s*$/m);
    if (match) return match[1];
  }
  return 'mongodb://127.0.0.1:27017/examplehotel';
}

const DEMO_PASSWORD = 'Demo!2026';
const hashed = (password) => bcrypt.hashSync(password, 12);

/** The hotel's own public details; the production seed reuses exactly these. */
export const HOTEL = {
  hotel_name: 'hotelIndoora',
  address: '14 Harbour Lane, Kinsale, Co. Cork, Ireland',
  phone_number: '+353 21 477 0128',
  email_address: 'stay@hotelindoora.com',
  check_in_time: '15:00',
  check_out_time: '11:00',
  house_rules: 'No smoking indoors. Quiet hours 22:00 to 07:00. Children of every age are welcome; cots on request. Arriving after 22:00, call ahead and the key is left in the entrance box. Breakfast is served in the courtyard from 07:30 to 10:00.',
};

/** The prototype's six room types; the production seed reuses exactly these. */
export const ROOM_TYPES = [
  {
    name: 'Garden Double', nightly_rate: 180, room_count: 6, max_guests: 3, room_size_sqm: 24, on_sale: true,
    bed_type_and_size: 'Queen bed, 160 × 200 cm',
    description: 'The Garden Double opens onto the courtyard through its own balcony door, planted either side with rosemary and bay, with a table for two that takes the morning sun. Inside, a queen bed dressed in Irish linen sits beside a window reading nook. The bathroom has a walk-in rain shower, underfloor heating and a deep shelf for your things.',
    amenities: ['Free Wi-Fi', 'Air conditioning', 'Rain shower and underfloor heating', 'Nespresso machine and kettle', 'Balcony over the courtyard', 'Smart TV', 'In-room safe', 'Daily housekeeping', 'Blackout curtains', 'Mini fridge with fresh milk'],
    photos: [
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1400&q=70',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=70',
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1400&q=70',
      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=70',
      'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1400&q=70',
    ],
  },
  {
    name: 'Sea View King', nightly_rate: 228.5, room_count: 4, max_guests: 3, room_size_sqm: 28, on_sale: true,
    bed_type_and_size: 'King bed, 180 × 200 cm',
    description: 'A calm corner room on the harbour side, with a wide window over the water and the morning sun. A king bed dressed in linen, a desk and a reading chair, and a bath with a walk-in shower.',
    amenities: ['Free Wi-Fi', 'Air conditioning', 'Sea view', 'Walk-in shower', 'Nespresso machine', 'Daily housekeeping'],
    photos: ['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=70'],
  },
  {
    name: 'Courtyard Twin', nightly_rate: 140, room_count: 5, max_guests: 2, room_size_sqm: 22, on_sale: true,
    bed_type_and_size: 'Two single beds, 90 × 200 cm',
    description: 'Two single beds on the quiet, ground-floor side of the house, looking into the courtyard where breakfast is served.',
    amenities: ['Free Wi-Fi', 'Two single beds', 'Courtyard view', 'Blackout curtains'],
    photos: ['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1400&q=70'],
  },
  {
    name: 'Rooftop Suite', nightly_rate: 260, room_count: 3, max_guests: 4, room_size_sqm: 42, on_sale: true,
    bed_type_and_size: 'King bed, 180 × 200 cm',
    description: 'The top floor of the house: a sitting room, a king bed and its own roof terrace looking out over the harbour.',
    amenities: ['Free Wi-Fi', 'Roof terrace', 'Sitting room', 'Air conditioning', 'Walk-in shower'],
    photos: ['https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1400&q=70'],
  },
  {
    name: 'Attic Single', nightly_rate: 118, room_count: 4, max_guests: 1, room_size_sqm: 16, on_sale: false,
    bed_type_and_size: 'Single bed, 90 × 200 cm',
    description: 'A small single room under the eaves, off sale while the rooflights are replaced.',
    amenities: ['Free Wi-Fi', 'Single bed'],
    photos: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=70'],
  },
  {
    name: 'Loft Twin', nightly_rate: 152, room_count: 3, max_guests: 2, room_size_sqm: 26, on_sale: false,
    bed_type_and_size: 'Two single beds, 90 × 200 cm',
    description: 'A twin room on the top landing, off sale at the moment while the house takes a long let.',
    amenities: ['Free Wi-Fi', 'Two single beds'],
    photos: ['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1400&q=70'],
  },
];

const day = (iso) => new Date(`${iso}T00:00:00.000Z`);
const plusDays = (iso, days) => new Date(day(iso).getTime() + days * 86400000);

/** The guest the prototype's own pages show, and the stays in its tables. */
const GUEST = { full_name: 'Marta Ferreira', email: 'marta.ferreira@example.com', phone_number: '+351 912 447 220' };

const BOOKINGS = [
  {
    booking_reference: 'HID-7742', room: 'Garden Double', checkIn: '2026-06-12', nights: 2, status: 'confirmed',
    rate: 180, guests: 2, arrival: '18:00', notes: 'A quiet room away from the lift if you have one.',
    charge: { amount: 540, id: '8XK92014LP338211D', on: '2026-02-02T19:04:00Z', note: 'Original booking, 3 nights' },
    refunds: [{ amount: 180, id: '5RN77120QP004183K', on: '2026-02-09T10:22:00Z', note: 'Price difference after the change to 2 nights' }],
  },
  {
    booking_reference: 'HID-7751', room: 'Courtyard Twin', checkIn: '2026-06-19', nights: 2, status: 'pending_payment',
    rate: 140, guests: 2, arrival: '16:00', notes: '',
    charge: null, refunds: [],
  },
  {
    booking_reference: 'HID-7763', room: 'Rooftop Suite', checkIn: '2026-07-10', nights: 3, status: 'confirmed',
    rate: 260, guests: 3, arrival: '15:30', notes: 'Celebrating an anniversary; a later check-out would be welcome.',
    charge: { amount: 780, id: '7QP11882LM550341B', on: '2026-05-04T11:12:00Z', note: 'Paid in full through PayPal when booking' },
    refunds: [],
  },
  {
    booking_reference: 'HID-7702', room: 'Courtyard Twin', checkIn: '2025-11-07', nights: 2, status: 'cancelled',
    rate: 140, guests: 2, arrival: '17:00', notes: '',
    charge: { amount: 280, id: '3LK55210QP884203M', on: '2025-09-20T09:31:00Z', note: 'Paid in full through PayPal when booking' },
    refunds: [{ amount: 280, id: '9QW44120LD772901F', on: '2025-11-06T09:15:00Z', note: 'Cancelled: the whole amount refunded, with no fee kept back' }],
  },
  {
    booking_reference: 'HID-7688', room: 'Sea View King', checkIn: '2025-09-26', nights: 2, status: 'confirmed',
    rate: 228.5, guests: 2, arrival: '19:00', notes: '',
    charge: { amount: 457, id: '4RT22981KK113490D', on: '2025-09-12T14:02:00Z', note: 'Paid in full through PayPal when booking' },
    refunds: [],
  },
  {
    booking_reference: 'HID-7671', room: 'Garden Double', checkIn: '2025-08-14', nights: 3, status: 'confirmed',
    rate: 180, guests: 2, arrival: '16:30', notes: 'Top floor if one is free.',
    charge: { amount: 540, id: '2ZX99110PP447281C', on: '2025-07-30T08:45:00Z', note: 'Paid in full through PayPal when booking' },
    refunds: [],
  },
];

/**
 * The nights out of service, anchored to the day the seed is run so the blocked
 * dates the prototype shows are ahead rather than behind. The four ranges and
 * the reasons are the prototype's own; each is matched on its reason, so running
 * the seed again moves the same four ranges rather than adding more.
 */
function relativeBlocks(today) {
  return [
    { first: shiftFrom(today, 7), last: shiftFrom(today, 10), reason: 'Painting the corridor outside rooms 12–14', by: 'Amara Osei' },
    { first: shiftFrom(today, 28), last: shiftFrom(today, 35), reason: 'Long let — held off sale for a returning company booking', by: 'Tomas Beck' },
    { first: shiftFrom(today, 44), last: shiftFrom(today, 45), reason: 'Carpet cleaning after a leak in room 11', by: 'Amara Osei' },
    { first: shiftFrom(today, 70), last: shiftFrom(today, 83), reason: 'Refurbishment — new bathrooms', by: 'Priya Raman' },
  ];
}

const isoOf = (date) => date.toISOString().slice(0, 10);
const shiftFrom = (iso, days) => isoOf(new Date(day(iso).getTime() + days * 86400000));

/**
 * The desk's own day, anchored to the day the seed is run: guests arriving today,
 * guests leaving today, stays coming up and bookings still waiting to be paid for.
 *
 * Without these the dashboard's Today board would be empty on most days — the
 * prototype shows it filled — so the dates are counted from today and the same
 * bookings are updated rather than duplicated when the seed is run again.
 */
function relativeBookings(today) {
  const back = (days) => shiftFrom(today, -days);
  const on = (days) => shiftFrom(today, days);
  return [
    // --- arriving today -----------------------------------------------------
    { booking_reference: 'HID-5001', room: 'Garden Double', checkIn: today, nights: 2, status: 'confirmed', rate: 180, guests: 2, arrival: '14:00', lead: 'Niamh Kelleher', email: 'niamh.kelleher@example.com', phone: '+353 87 220 4413', notes: 'Quiet room away from the lift, and one extra pillow if you have a spare one.', paid: true },
    { booking_reference: 'HID-5002', room: 'Courtyard Twin', checkIn: today, nights: 4, status: 'confirmed', rate: 140, guests: 2, arrival: '16:30', lead: 'Tomás Ferreira', email: 'tomas.ferreira@example.com', phone: '+353 86 771 2098', notes: '', paid: true },
    { booking_reference: 'HID-5003', room: 'Rooftop Suite', checkIn: today, nights: 1, status: 'confirmed', rate: 260, guests: 2, arrival: '18:00', lead: 'Grace O\'Donnell', email: 'grace.odonnell@example.com', phone: '+353 85 449 6620', notes: 'Arriving late from Cork; please keep the key box ready.', paid: true },
    { booking_reference: 'HID-5004', room: 'Garden Double', checkIn: today, nights: 3, status: 'confirmed', rate: 180, guests: 2, arrival: '19:15', lead: 'Daniel Okoye', email: 'daniel.okoye@example.com', phone: '+353 89 330 7714', notes: 'Travelling with a small dog.', paid: true },
    // --- leaving today ------------------------------------------------------
    { booking_reference: 'HID-5005', room: 'Courtyard Twin', checkIn: back(2), nights: 2, status: 'confirmed', rate: 140, guests: 2, arrival: '17:00', lead: 'Klaus Bauer', email: 'klaus.bauer@example.com', phone: '+49 151 220 8891', notes: '', paid: true },
    { booking_reference: 'HID-5006', room: 'Garden Double', checkIn: back(3), nights: 3, status: 'confirmed', rate: 180, guests: 2, arrival: '16:00', lead: 'Ruth Ayodele', email: 'ruth.ayodele@example.com', phone: '+353 87 664 1120', notes: 'Please leave the balcony door closed in the evening.', paid: true },
    { booking_reference: 'HID-5007', room: 'Sea View King', checkIn: back(2), nights: 2, status: 'confirmed', rate: 228.5, guests: 2, arrival: '19:00', lead: 'Yusuf Demir', email: 'yusuf.demir@example.com', phone: '+90 532 118 4407', notes: '', paid: true },
    // --- coming up ----------------------------------------------------------
    { booking_reference: 'HID-5008', room: 'Garden Double', checkIn: on(1), nights: 2, status: 'confirmed', rate: 180, guests: 2, arrival: '15:30', lead: 'Lena Kovacs', email: 'lena.kovacs@example.com', phone: '+36 30 447 2288', notes: '', paid: true },
    { booking_reference: 'HID-5009', room: 'Sea View King', checkIn: on(5), nights: 2, status: 'confirmed', rate: 228.5, guests: 2, arrival: '18:45', lead: 'Tomás Silva', email: 'tomas.silva@example.com', phone: '+351 966 220 713', notes: '', paid: true },
    { booking_reference: 'HID-5010', room: 'Courtyard Twin', checkIn: on(8), nights: 2, status: 'confirmed', rate: 140, guests: 2, arrival: '16:15', lead: 'Rebecca Adeyemi', email: 'rebecca.adeyemi@example.com', phone: '+44 7700 900233', notes: 'Two single beds made up separately, please.', paid: true },
    { booking_reference: 'HID-5011', room: 'Rooftop Suite', checkIn: on(11), nights: 2, status: 'confirmed', rate: 260, guests: 3, arrival: '17:30', lead: 'Jonas Bergström', email: 'jonas.bergstrom@example.com', phone: '+46 70 118 4420', notes: '', paid: true },
    // --- holding a room, waiting to be paid for -----------------------------
    { booking_reference: 'HID-5012', room: 'Garden Double', checkIn: on(2), nights: 2, status: 'pending_payment', rate: 180, guests: 2, arrival: '17:00', lead: 'Aoife Brennan', email: 'aoife.brennan@example.com', phone: '+353 87 331 9046', notes: '', takenBy: 'Priya Raman', bookedAt: '08:11' },
    { booking_reference: 'HID-5013', room: 'Rooftop Suite', checkIn: on(9), nights: 3, status: 'pending_payment', rate: 260, guests: 2, arrival: '16:00', lead: 'Mark Whelan', email: 'mark.whelan@example.com', phone: '+353 86 220 1187', notes: 'A table for two on the terrace if the weather allows.', takenBy: 'Priya Raman', bookedAt: '07:48' },
    { booking_reference: 'HID-5014', room: 'Courtyard Twin', checkIn: today, nights: 1, status: 'pending_payment', rate: 140, guests: 1, arrival: '21:00', lead: 'Priya Nair', email: 'priya.nair@example.com', phone: '+353 87 115 9032', notes: '', holdMinutes: 30, online: true },
  ];
}

const todayAt = (clock) => {
  const [hours, minutes] = String(clock).split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

async function seed() {
  const uri = mongoUri();
  await mongoose.connect(uri);
  const counts = {};

  // ---- the hotel's own public details: one record, always the same one -----
  await HotelDetails.findOneAndUpdate({}, HOTEL, { upsert: true, new: true, setDefaultsOnInsert: true });
  counts.hotel_details = 1;

  // ---- the room types the hotel sells --------------------------------------
  for (const roomType of ROOM_TYPES) {
    await RoomType.findOneAndUpdate({ name: roomType.name }, roomType, { upsert: true, new: true, setDefaultsOnInsert: true });
  }
  counts.room_types = ROOM_TYPES.length;

  // ---- the desk: the demo account, and colleagues for the Team list --------
  const staff = [
    { full_name: 'Demo Hotel Staff', email: 'hotel.staff@example.com', status: 'active', password: true },
    { full_name: 'Priya Raman', email: 'priya.raman@hotelindoora.com', status: 'active', password: true },
    { full_name: 'Marta Okafor', email: 'marta.okafor@hotelindoora.com', status: 'active', password: true },
    { full_name: 'Daniel Okafor', email: 'daniel.okafor@hotelindoora.com', status: 'active', password: true },
    { full_name: 'Hana Suzuki', email: 'hana.suzuki@hotelindoora.com', status: 'invited', password: false },
  ];
  for (const member of staff) {
    const update = {
      $set: {
        full_name: member.full_name,
        email: member.email,
        status: member.status,
        ...(member.password ? { password_hash: hashed(DEMO_PASSWORD) } : {}),
      },
      $setOnInsert: { added_at: new Date() },
    };
    await StaffAccount.findOneAndUpdate({ email: member.email }, update, { upsert: true, new: true, setDefaultsOnInsert: true });
  }
  counts.staff_accounts = staff.length;

  // ---- the guest whose bookings the prototype's pages show -----------------
  await GuestAccount.findOneAndUpdate(
    { email: GUEST.email },
    {
      $set: {
        full_name: GUEST.full_name,
        email: GUEST.email,
        phone_number: GUEST.phone_number,
        password_hash: hashed(DEMO_PASSWORD),
        email_confirmed: true,
        status: 'active',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const guest = await GuestAccount.findOne({ email: GUEST.email });
  counts.guest_accounts = 1;

  // ---- the stays and the money against them --------------------------------
  for (const entry of BOOKINGS) {
    const roomType = await RoomType.findOne({ name: entry.room });
    const checkIn = day(entry.checkIn);
    const checkOut = plusDays(entry.checkIn, entry.nights);
    const booking = await Booking.findOneAndUpdate(
      { booking_reference: entry.booking_reference },
      {
        $set: {
          booking_reference: entry.booking_reference,
          room_type_id: roomType._id,
          check_in_date: checkIn,
          check_out_date: checkOut,
          nights: entry.nights,
          nightly_rate: entry.rate,
          total_price: Number((entry.rate * entry.nights).toFixed(2)),
          lead_guest_name: GUEST.full_name,
          guest_email: GUEST.email,
          contact_phone: GUEST.phone_number,
          guest_count: entry.guests,
          expected_arrival_time: entry.arrival,
          special_requests: entry.notes,
          status: entry.status,
          booked_by_guest_account_id: guest._id,
          booked_at: entry.charge ? new Date(entry.charge.on) : new Date(),
        },
        $setOnInsert: {},
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    if (entry.charge) {
      await Payment.findOneAndUpdate(
        { paypal_transaction_id: entry.charge.id },
        {
          $set: {
            booking_id: booking._id,
            paypal_transaction_id: entry.charge.id,
            amount: entry.charge.amount,
            type: 'charge',
            status: 'completed',
            note: entry.charge.note,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
    for (const refund of entry.refunds ?? []) {
      await Payment.findOneAndUpdate(
        { paypal_transaction_id: refund.id },
        {
          $set: {
            booking_id: booking._id,
            paypal_transaction_id: refund.id,
            amount: refund.amount,
            type: 'refund',
            status: 'completed',
            note: refund.note,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
  }
  counts.bookings = BOOKINGS.length;

  // ---- the desk's own day: arrivals, departures and rooms still to be paid --
  const today = isoOf(new Date());
  const demoStaff = await StaffAccount.findOne({ email: 'hotel.staff@example.com' });
  const priya = await StaffAccount.findOne({ full_name: 'Priya Raman' });
  const relatives = relativeBookings(today);
  for (const entry of relatives) {
    const roomType = await RoomType.findOne({ name: entry.room });
    const total = Number((entry.rate * entry.nights).toFixed(2));

    // One of them was booked online by a guest, so that case is real too: the
    // guest has an account and the booking holds its room for half an hour.
    let onlineGuest = null;
    if (entry.online) {
      await GuestAccount.findOneAndUpdate(
        { email: entry.email },
        {
          $set: {
            full_name: entry.lead,
            email: entry.email,
            phone_number: entry.phone,
            password_hash: hashed(DEMO_PASSWORD),
            email_confirmed: true,
            status: 'active',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      onlineGuest = await GuestAccount.findOne({ email: entry.email });
    }

    const booking = await Booking.findOneAndUpdate(
      { booking_reference: entry.booking_reference },
      {
        $set: {
          booking_reference: entry.booking_reference,
          room_type_id: roomType._id,
          check_in_date: day(entry.checkIn),
          check_out_date: plusDays(entry.checkIn, entry.nights),
          nights: entry.nights,
          nightly_rate: entry.rate,
          total_price: total,
          lead_guest_name: entry.lead,
          guest_email: entry.email,
          contact_phone: entry.phone,
          guest_count: entry.guests,
          expected_arrival_time: entry.arrival,
          special_requests: entry.notes,
          status: entry.status,
          booked_at: entry.bookedAt ? todayAt(entry.bookedAt) : new Date(Date.now() - 86400000),
          ...(entry.online
            ? { booked_by_guest_account_id: onlineGuest._id }
            : {
              booked_by_staff_account_id: (entry.takenBy === 'Priya Raman' ? priya : demoStaff)?._id,
              booked_by_staff_name: entry.takenBy ?? 'Demo Hotel Staff',
            }),
          ...(entry.holdMinutes
            ? { hold_expires_at: new Date(Date.now() + entry.holdMinutes * 60000) }
            : {}),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    if (entry.paid) {
      await Payment.findOneAndUpdate(
        { paypal_transaction_id: `SEED-${entry.booking_reference}` },
        {
          $set: {
            booking_id: booking._id,
            paypal_transaction_id: `SEED-${entry.booking_reference}`,
            amount: total,
            type: 'charge',
            status: 'completed',
            note: 'Paid in full through PayPal when booking',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
  }
  counts.desk_bookings = relatives.length;
  counts.guest_accounts += relatives.filter((entry) => entry.online).length;

  // ---- the nights one room type's rooms are out of service -----------------
  const garden = await RoomType.findOne({ name: 'Garden Double' });
  const blocks = relativeBlocks(today);
  for (const block of blocks) {
    await RoomBlock.findOneAndUpdate(
      { room_type_id: garden._id, reason: block.reason },
      {
        $set: {
          room_type_id: garden._id,
          first_night: day(block.first),
          last_night: day(block.last),
          reason: block.reason,
          blocked_by_name: block.by,
          blocked_by_staff_account_id: (await StaffAccount.findOne({ full_name: block.by }))?._id
            ?? (await StaffAccount.findOne({ email: 'hotel.staff@example.com' }))._id,
          blocked_at: new Date(Date.now() - 8 * 86400000),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  counts.room_blocks = blocks.length;

  // The connection string is never printed: it carries the database password.
  const databaseName = decodeURIComponent(uri.split('?')[0].replace(/\/+$/, '').split('/').pop() ?? '');
  console.log(`Seeded database "${databaseName}": ${Object.entries(counts).map(([key, value]) => `${key} ${value}`).join(', ')}`);
  console.log(`Demo accounts: hotel.staff@example.com (hotel staff) and marta.ferreira@example.com (guest) — both ${DEMO_PASSWORD}`);
  await mongoose.disconnect();
}

// Run only when this file is the one being executed: the production seed
// imports HOTEL and ROOM_TYPES from here, and importing must never write the
// demo data anywhere.
const executedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedDirectly) {
  seed().catch(async (error) => {
    console.error('Seed failed:', error.message);
    try { await mongoose.disconnect(); } catch { /* already closed */ }
    process.exit(1);
  });
}
