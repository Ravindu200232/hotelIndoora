import { useState } from 'react';
import { Dialog, Img } from '../index.jsx';
import { photoAt } from '../ui/media.jsx';

/**
 * The photographs of one room type: one large, five thumbnails, and any one of
 * them opening larger. The larger view steps through the photographs, so the
 * Previous and Next controls the prototype draws really move.
 */
export function RoomGallery({ name, photos = [] }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const source = (photo, width) => photoAt(photo, width);
  const captions = [
    'the balcony over the courtyard', 'the queen bed seen from the window side', 'the bathroom with its walk-in rain shower',
    'the balcony, with a table for two', 'the reading nook beside the window',
  ];

  return (
    <>
      <div className="gallery">
        <div className="gallery__main">
          <Img
            src={source(photos[index], 1400)}
            alt={`${name}: ${captions[index] ?? `photograph ${index + 1}`}`}
            width={1400}
            height={900}
            lazy={false}
            onClick={() => setOpen(true)}
            style={{ cursor: 'zoom-in' }}
          />
        </div>
        <div className="gallery__thumbs">
          {photos.map((photo, position) => (
            <button
              key={photo}
              type="button"
              aria-current={position === index ? 'true' : 'false'}
              onClick={() => setIndex(position)}
            >
              <Img
                src={source(photo, 400)}
                alt={`${name}: ${captions[position] ?? `photograph ${position + 1}`}`}
                width={400}
                height={300}
              />
            </button>
          ))}
        </div>
        <p className="small muted">
          Photograph {index + 1} of {photos.length || 1} — select any photograph to open it larger.
        </p>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        label="Photograph"
        footer={(
          <>
            <button
              className="btn btn--ghost btn--sm"
              type="button"
              disabled={index === 0}
              onClick={() => setIndex((current) => Math.max(0, current - 1))}
            >
              Previous
            </button>
            <button
              className="btn btn--ghost btn--sm"
              type="button"
              disabled={index >= photos.length - 1}
              onClick={() => setIndex((current) => Math.min(photos.length - 1, current + 1))}
            >
              Next
            </button>
            <button className="btn btn--primary btn--sm" type="button" onClick={() => setOpen(false)}>Close</button>
          </>
        )}
      >
        <Img
          src={source(photos[index], 1400)}
          alt={`${name}: ${captions[index] ?? `photograph ${index + 1}`}`}
          width={1400}
          height={900}
          lazy={false}
        />
        <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
          Photograph {index + 1} of {photos.length || 1} · {captions[index] ?? ''}
        </p>
      </Dialog>
    </>
  );
}
