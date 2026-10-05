/**
 * The text of every button and link on the pages the journeys drive, read from
 * the components so the tests use the product's own words. Read-only.
 */
import { readFileSync, existsSync } from 'node:fs';

const files = [
  'client/src/components/rooms/StaySummary.jsx',
  'client/src/pages/MyBookingsPage.jsx',
  'client/src/pages/MyBookingPage.jsx',
  'client/src/pages/ChangeBookingPage.jsx',
  'client/src/pages/CancelBookingPage.jsx',
  'client/src/pages/MyAccountPage.jsx',
  'client/src/pages/DeleteAccountPage.jsx',
  'client/src/pages/StaffDashboardPage.jsx',
  'client/src/pages/RoomTypesPage.jsx',
  'client/src/pages/EditRoomTypePage.jsx',
  'client/src/pages/BlockedDatesPage.jsx',
  'client/src/pages/BlockRoomsPage.jsx',
  'client/src/pages/StaffBookingsPage.jsx',
  'client/src/pages/BookingRecordPage.jsx',
  'client/src/pages/EditBookingPage.jsx',
  'client/src/pages/NewBookingForGuestPage.jsx',
  'client/src/pages/SendPaymentLinkPage.jsx',
  'client/src/pages/TeamPage.jsx',
  'client/src/pages/AddStaffMemberPage.jsx',
  'client/src/pages/HotelDetailsPage.jsx',
];

const text = /(<button|<Link|>View|>Add|>Block|>Save|>Cancel|>Send|>Confirm|>Continue|>Edit|>Open|>Block rooms|>New)/;

for (const file of files) {
  if (!existsSync(file)) { console.log(`=== ${file}: MISSING`); continue; }
  console.log(`=== ${file}`);
  readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
    if (!text.test(line)) return;
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    console.log(`  ${index + 1}: ${trimmed.slice(0, 150)}`);
  });
}
