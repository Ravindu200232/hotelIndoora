/**
 * The last labels and button texts the journeys need, read from the components.
 * Read-only.
 */
import { readFileSync } from 'node:fs';

const files = [
  ['client/src/components/auth/SignUpForm.jsx', /<label|type="submit"|Create account|Creating/],
  ['client/src/pages/ConfirmEmailPage.jsx', /<h1|<h2|button|Resend|label|type="submit"|Confirm/],
  ['client/src/components/bookings/BookingDetailsForm.jsx', /type="submit"|state\.status ===|Continue|Payment/],
  ['client/src/components/bookings/PayPalPanel.jsx', /<h[1-4]|button|PayPal|type="submit"|not connected/],
  ['client/src/pages/MyBookingPage.jsx', /Change booking|change|panel--tint|<h3|Actions|Cancel booking|Payment/],
  ['client/src/components/rooms/RoomResultCard.jsx', /<h|free|night|total|€/],
];

for (const [file, pattern] of files) {
  console.log(`=== ${file}`);
  readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
    if (pattern.test(line)) console.log(`  ${index + 1}: ${line.trim().slice(0, 150)}`);
  });
}
