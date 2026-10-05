import { Link } from 'react-router-dom';
import { Eyebrow, Img } from '../index.jsx';

/**
 * Home opens on one huge banner: a single full-bleed photograph with the
 * hotel's copy centred over it on a dark scrim, and the three smaller approved
 * photographs in a strip under it.
 *
 * The banner and its lines arrive together, on the design's own motion: the
 * photograph settles from a slight swell, the scrim fades in, and the eyebrow,
 * the heading, the lead and the two calls to action drop in one after the other
 * from --motion-drop-start. Every one of those moves is a transform or an
 * opacity, so nothing shifts the layout around it.
 *
 * The photographs are the prototype's own, with its crops and its alt text; a
 * photograph that cannot load falls back to the hotel's mark, and the page says
 * so instead of leaving a broken frame.
 */
export function Hero({ onImageError }) {
  return (
    <section className="hero">
      <div className="hero__banner">
        <Img
          className="hero__bg"
          src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2000&q=70"
          alt="The hotelIndoora facade on Harbour Lane, with its deep-green shutters and courtyard gate"
          width={2000}
          height={1333}
          lazy={false}
          onError={onImageError}
        />
        <span className="hero__scrim" aria-hidden="true" />
        <div className="hero__content">
          <Eyebrow className="font-drop" style={{ '--drop-line': 0 }}>A nine-room house in Kinsale</Eyebrow>
          <h1 className="font-drop" style={{ '--drop-line': 1 }}>A nine-room house on Harbour Lane, ten minutes from the quay</h1>
          <p className="lead font-drop" style={{ '--drop-line': 2 }}>
            hotelIndoora is a small hotel on Harbour Lane, a short walk from the harbour and two streets from the
            Saturday market. Every room is priced per night, that nightly rate is the whole price, and nothing is added
            at checkout. Book here and pay the full amount through PayPal.
          </p>
          <p className="hero__actions font-drop" style={{ '--drop-line': 3 }}>
            <Link className="btn btn--primary" to="/rooms">Search availability</Link>
            <Link className="btn btn--ghost" to="/rooms">See all rooms and rates</Link>
          </p>
        </div>
      </div>
      <div className="wrap hero__strip">
        <div className="hero__thumbs">
          <Img
            src="https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=600&q=70"
            alt="The courtyard where breakfast is served"
            width={600}
            height={450}
            onError={onImageError}
          />
          <Img
            src="https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=600&q=70"
            alt="A guest room with a queen bed and morning light"
            width={600}
            height={450}
            onError={onImageError}
          />
          <Img
            src="https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=600&q=70"
            alt="Breakfast laid out on a courtyard table"
            width={600}
            height={450}
            onError={onImageError}
          />
        </div>
      </div>
    </section>
  );
}
