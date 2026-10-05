import { Panel } from '../index.jsx';
import { formatDate } from '../../api.js';

/**
 * The full amount, night by night: the nightly rate for every night with
 * nothing added — no tax, no cleaning fee, no service fee, no commission. The
 * total is what PayPal will take, in one payment.
 */
export function AmountBreakdown({ booking }) {
  const rate = Number(booking.nightly_rate ?? 0);
  const nights = Number(booking.nights ?? 0);
  const start = new Date(booking.check_in_date);
  const rows = Array.from({ length: nights }).map((_, index) => {
    const night = new Date(start.getTime() + index * 86400000);
    return { label: `Night ${index + 1}`, date: formatDate(night), rate };
  });

  return (
    <Panel as="section" aria-labelledby="amount-title">
      <h2 id="amount-title">Full amount</h2>
      <div className="table-wrap">
        <table className="receipt">
          <caption>{nights} nights at €{rate.toFixed(2)} — the nightly rate for every night.</caption>
          <thead>
            <tr><th>Night</th><th>Date</th><th>Nightly rate</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td data-label="Night">{row.label}</td>
                <td data-label="Date">{row.date}</td>
                <td data-label="Nightly rate">€{row.rate.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td data-label="Total to pay">Total to pay</td>
              <td data-label="Amount">€{Number(booking.total_price).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
        Nothing is added: no tax, no cleaning fee, no service fee, no commission. You pay the full amount through PayPal,
        and the booking is confirmed straight away.
      </p>
    </Panel>
  );
}
