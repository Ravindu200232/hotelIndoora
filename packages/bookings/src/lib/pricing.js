/**
 * The money, in one place.
 *
 * The nightly rate is the final price: the total is the rate for every night
 * with nothing added - no tax, no cleaning fee, no service fee. Changing a stay
 * charges or refunds only the difference, and cancelling always refunds the
 * whole amount paid.
 */
export const DAY_MS = 86400000;

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/** A `Date` or a date string, as the `YYYY-MM-DD` key the counting works on. */
const dayKey = (value) => (value instanceof Date
  ? value.toISOString().slice(0, 10)
  : String(value ?? '').slice(0, 10));

export function nightsBetween(checkIn, checkOut) {
  const start = new Date(`${dayKey(checkIn)}T00:00:00.000Z`).getTime();
  const end = new Date(`${dayKey(checkOut)}T00:00:00.000Z`).getTime();
  return Math.max(0, Math.round((end - start) / DAY_MS));
}

export function totalFor(nightlyRate, nights) {
  return round2(Number(nightlyRate) * Number(nights));
}

/** What the guest has actually paid: completed charges less completed refunds. */
export function paidTotal(payments = []) {
  let paid = 0;
  for (const payment of payments) {
    if (payment.status !== 'completed') continue;
    paid += payment.type === 'refund' ? -Number(payment.amount) : Number(payment.amount);
  }
  return round2(paid);
}

/**
 * The difference a change settles. Nothing to settle is `none`, never a
 * zero-value charge through PayPal.
 */
export function differenceFor(newTotal, alreadyPaid) {
  const delta = round2(Number(newTotal) - Number(alreadyPaid));
  if (delta > 0) return { direction: 'charge', amount: delta };
  if (delta < 0) return { direction: 'refund', amount: round2(Math.abs(delta)) };
  return { direction: 'none', amount: 0 };
}
