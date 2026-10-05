import { Link } from 'react-router-dom';
import { Alert, KvList, MiniMap, Panel } from '../index.jsx';

/**
 * Where the house is, how to reach it, and how the day runs — the same panel as
 * the approved prototype, filled with the hotel's own details as staff keep them
 * current on Hotel Details.
 */
export function HotelDetailsPanel({ hotel, loading, error, onRetry }) {
  if (loading) {
    return (
      <section className="section" aria-labelledby="hotel-details-title">
        <div className="wrap">
          <h2 id="hotel-details-title">Hotel details</h2>
          <span className="skeleton skeleton--lg" style={{ display: 'block', width: '40%' }} />
          <span className="skeleton" style={{ display: 'block', width: '70%', marginTop: 'var(--space-3)' }} />
        </div>
      </section>
    );
  }

  if (error || !hotel) {
    return (
      <section className="section" aria-labelledby="hotel-details-title">
        <div className="wrap">
          <h2 id="hotel-details-title">Hotel details</h2>
          <Alert kind="error" title="We could not load the hotel details">
            The address, phone number and check-in times are not showing right now.
            <div className="row" style={{ marginTop: 'var(--space-3)' }}>
              <button className="btn btn--ghost btn--sm" type="button" onClick={onRetry}>Try again</button>
            </div>
          </Alert>
        </div>
      </section>
    );
  }

  const rules = String(hotel.house_rules ?? '')
    .split(/(?<=\.)\s+/)
    .map((rule) => rule.trim())
    .filter(Boolean);

  return (
    <section className="section" aria-labelledby="hotel-details-title">
      <div className="wrap">
        <div className="section__head">
          <div>
            <h2 id="hotel-details-title">Hotel details</h2>
            <p>Where the house is, how to reach us, and how the day runs.</p>
          </div>
        </div>
        <div className="split--even">
          <Panel>
            <h3>{hotel.hotel_name}</h3>
            <KvList stacked rows={[
              ['Hotel', hotel.hotel_name],
              ['Address', hotel.address],
              ['Phone', hotel.phone_number],
              ['Email', hotel.email_address],
              ['Check-in', `From ${hotel.check_in_time}`],
              ['Check-out', `By ${hotel.check_out_time}`],
            ]} />
            <MiniMap title="Finding the house">
              <p>
                Harbour Lane runs behind the quay. The gate is the deep-green one, opposite the old net store, and there
                is a loading bay outside for dropping bags.
              </p>
            </MiniMap>
          </Panel>
          <Panel tint>
            <h4>House rules</h4>
            <ul>
              {rules.map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
            <Link className="btn btn--quiet btn--sm" to="/login">Sign in to book</Link>
          </Panel>
        </div>
      </div>
    </section>
  );
}
