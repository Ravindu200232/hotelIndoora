/**
 * The labels, ids and control names the end-to-end journeys have to drive, read
 * out of the components themselves so nothing is guessed. Read-only.
 */
import { readFileSync, existsSync } from 'node:fs';

const files = [
  'client/src/components/auth/SignInForm.jsx',
  'client/src/components/auth/SignUpForm.jsx',
  'client/src/components/home/AvailabilitySearch.jsx',
  'client/src/components/rooms/RoomResultCard.jsx',
  'client/src/components/rooms/StaySummary.jsx',
  'client/src/pages/RoomTypePage.jsx',
  'client/src/components/bookings/BookingDetailsForm.jsx',
  'client/src/components/bookings/ChosenRoomPanel.jsx',
];

const interest = /(htmlFor=|id="|placeholder=|<label|>{\s*['"`]|button|Button|link-arrow|className="btn|type="submit"|aria-label)/i;

for (const file of files) {
  if (!existsSync(file)) {
    console.log(`=== ${file}: MISSING`);
    continue;
  }
  console.log(`=== ${file}`);
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (interest.test(line)) console.log(`  ${index + 1}: ${line.trim().slice(0, 160)}`);
  });
}
