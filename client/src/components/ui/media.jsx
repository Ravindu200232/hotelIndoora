/**
 * Images, the gallery and the room-type photo strip.
 *
 * Every photograph the prototype uses is reused by its exact address, with its
 * width, height, lazy loading and alt text, and a photograph that cannot load
 * falls back to the hotel's own mark rather than leaving a broken frame.
 */
import { useEffect, useRef, useState } from 'react';

const LOGO = '/uploads/hotel-logo-template-background-58362974.jpg';

export function Img({ src, alt, width, height, lazy = true, fallback = LOGO, className, onClick, ...rest }) {
  const [source, setSource] = useState(src);
  useEffect(() => { setSource(src); }, [src]);
  return (
    <img
      src={source}
      alt={alt}
      width={width}
      height={height}
      loading={lazy ? 'lazy' : undefined}
      className={className}
      onClick={onClick}
      onError={() => { if (source !== fallback) setSource(fallback); }}
      {...rest}
    />
  );
}

/** The room type page gallery: one main photograph, five thumbnails, one dialog. */
export function Gallery({ photos = [], name = 'Room', onOpen }) {
  const [index, setIndex] = useState(0);
  const main = photos[index] ?? LOGO;
  return (
    <div className="gallery" data-gallery>
      <div className="gallery__main">
        <Img src={main} alt={`${name}: photograph ${index + 1}`} width={1400} height={900} lazy={false} onClick={() => onOpen?.(index)} />
      </div>
      <div className="gallery__thumbs">
        {photos.map((photo, position) => (
          <button
            key={photo}
            type="button"
            aria-current={position === index ? 'true' : 'false'}
            onClick={() => setIndex(position)}
          >
            <Img src={photo} alt={`${name}: photograph ${position + 1}`} width={400} height={300} />
          </button>
        ))}
      </div>
      <p className="small muted">Photograph {index + 1} of {photos.length} — select any photograph to open it larger.</p>
    </div>
  );
}

/** Staff-side thumbnails, each with the removal the desk expects. */
export function PhotoStrip({ photos = [], onRemove, children }) {
  return (
    <div className="photo-strip">
      {photos.map((photo) => (
        <figure key={photo.path ?? photo}>
          <Img src={photo.url ?? photo} alt={photo.caption ?? 'Room type photograph'} width={400} height={300} />
          <figcaption>
            {photo.caption ?? photo}
            {onRemove ? (
              <button className="btn btn--ghost btn--sm" type="button" onClick={() => onRemove(photo)}>Remove</button>
            ) : null}
          </figcaption>
        </figure>
      ))}
      {children}
    </div>
  );
}

/** The brand mark, on every shell: the uploaded hotel identity. */
export function BrandMark({ size = 40 }) {
  return <Img src={LOGO} alt="hotelIndoora house mark" width={size} height={size} lazy={false} className="brand__mark" />;
}

/**
 * The prototype uses the same photograph at different sizes on different
 * screens - 800 wide in a card, 1400 in the gallery. This reuses the photograph
 * the room type actually holds, at the width the approved page asks for, so a
 * card's crop matches the prototype exactly.
 */
export function photoAt(url, width) {
  const source = String(url ?? '');
  if (!source) return LOGO;
  return source.replace(/([?&]w=)\d+/, `$1${width}`);
}

/** The first sentence of a description, for the one-line summary under a card. */
export function firstSentence(text = '') {
  const clean = String(text ?? '').trim();
  if (!clean) return '';
  const stop = clean.indexOf('. ');
  return stop === -1 ? clean : clean.slice(0, stop + 1);
}

/** Scroll to the top of a page when the route changes, as a browser would. */
export function useScrollTopOnMount() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    window.scrollTo({ top: 0 });
  }, []);
}
