/**
 * Make every end-to-end allowance include the sign-in page's expected session
 * probe, so a journey that declares one extra status does not lose the other.
 * Run once; it edits nothing but e2e/journeys.spec.js.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const file = 'e2e/journeys.spec.js';
let text = readFileSync(file, 'utf8');
text = text.replaceAll('test.use({ allowedStatuses: [502] })', 'test.use({ allowedStatuses: [401, 502] })');
text = text.replaceAll('test.use({ allowedStatuses: [400] })', 'test.use({ allowedStatuses: [401, 400] })');
writeFileSync(file, text);

text.split('\n').forEach((line, index) => {
  if (line.includes('allowedStatuses')) console.log(`${index + 1}: ${line.trim()}`);
});
