/**
 * What a stay at hotelIndoora includes, and how the house runs: the same ten
 * facts, with the same marks, as the approved prototype.
 */
const FEATURES = [
  ['9', '9 rooms', 'A nine-room house on the harbour lane.'],
  ['€', 'Priced per night', 'The nightly rate is the whole price — no fees added at checkout.'],
  ['☕', 'Breakfast by the courtyard', 'Served in the courtyard from 07:30 to 10:00.'],
  ['⚓', 'Ten minutes from the quay', 'On foot, and two streets from the Saturday market.'],
  ['15', 'Check-in from 15:00', 'Check-out is by 11:00.'],
  ['🌿', 'Courtyard open all day', 'Open to guests, with no smoking indoors.'],
  ['🌙', 'Quiet hours', '22:00 to 07:00.'],
  ['🛏', 'Cots on request', 'Children of every age are welcome.'],
  ['🔑', 'Arriving after 22:00', 'Call ahead and the key is left in the entrance box.'],
  ['P', 'Pay with PayPal', 'The full amount is paid through PayPal when booking.'],
];

export function FeatureGrid({ photosFailed, children }) {
  return (
    <section className="section section--tint" aria-labelledby="features-title">
      <div className="wrap">
        <div className="section__head">
          <div>
            <h3 id="features-title">Hotel features</h3>
            <p>What a stay at hotelIndoora includes, and how the house runs.</p>
          </div>
        </div>
        <ul className="feature-list">
          {FEATURES.map(([mark, title, note]) => (
            <li key={title}>
              <span className="dot" aria-hidden="true">{mark}</span>
              <span><b>{title}</b><span>{note}</span></span>
            </li>
          ))}
        </ul>

        {/* Only shown when a photograph really did not load. */}
        <div className="alert alert--error" id="photos-error" hidden={!photosFailed}>
          <span className="alert__icon" aria-hidden="true">!</span>
          <div className="alert__body">
            <span className="alert__title">Hotel photographs did not load</span>
            The description and the hotel features still show.
            <a href="/">Try again</a>
          </div>
        </div>

        {children}
      </div>
    </section>
  );
}
