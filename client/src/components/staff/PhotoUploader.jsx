import { useRef, useState } from 'react';
import { Alert, Button, Img, ProgressTrack, Skeleton } from '../index.jsx';

/** The same limits the server holds a photograph to, checked here first. */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Why a chosen file cannot be added, or `null` when it can. */
export function photoProblem(file, { count = 0, max = 10 } = {}) {
  if (count >= max) return `A room type holds at most ${max} photographs. Remove one first.`;
  if (!PHOTO_TYPES.includes(file.type)) return 'The file is not a JPEG, PNG or WebP, so it was not added.';
  if (file.size > PHOTO_MAX_BYTES) return 'The file is larger than 5 MB, so it was not added.';
  return null;
}

const sizeLabel = (bytes) => (bytes ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : '');

/**
 * The photographs on a room type: what the guest sees first, what has gone up,
 * what is going up right now with its real progress, and what was refused and why.
 *
 * Files are chosen from the device or dropped onto the panel. The page decides
 * what happens next - a new room type holds them until it exists, an existing one
 * uploads them at once - so this component is the same on both.
 */
export function PhotoUploader({
  items = [],
  max = 10,
  onSelect,
  onRemove,
  onRetry,
  heading = 'Photographs',
  note = 'The first one is what guests see before they open the room type.',
  showCountInHeading = false,
}) {
  const input = useRef(null);
  const [dragging, setDragging] = useState(false);
  const added = items.filter((item) => item.status === 'added').length;
  const uploading = items.filter((item) => item.status === 'uploading').length;
  const failed = items.filter((item) => item.status === 'failed');

  const pick = (fileList) => {
    const files = [...(fileList ?? [])];
    if (files.length) onSelect(files);
  };

  return (
    <>
      <h2 id="photos-title">
        {heading}
        {showCountInHeading ? ` — ${added} of ${max}` : ''}
      </h2>
      <p className="small muted">
        {items.length
          ? `${added} ${added === 1 ? 'photograph' : 'photographs'} added${uploading ? `, ${uploading} uploading` : ''} — up to ${max} photographs of at most 5 MB each, in JPEG, PNG or WebP. ${note}`
          : `No photographs yet — up to ${max} photographs of at most 5 MB each, in JPEG, PNG or WebP. ${note}`}
      </p>

      <div
        className="panel panel--tint"
        style={{ textAlign: 'center', outline: dragging ? '2px solid var(--color-secondary)' : undefined }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          pick(event.dataTransfer?.files);
        }}
      >
        <p><b>Drag photographs here</b> or choose them from this device</p>
        <input
          ref={input}
          type="file"
          accept={PHOTO_TYPES.join(',')}
          multiple
          className="visually-hidden"
          id="photo-input"
          aria-label="Choose photographs from this device"
          onChange={(event) => {
            pick(event.target.files);
            event.target.value = '';
          }}
        />
        <Button kind="secondary" size="sm" type="button" onClick={() => input.current?.click()}>Choose photographs</Button>
      </div>

      {items.length ? (
        <div className="photo-strip" style={{ marginTop: 'var(--space-4)' }}>
          {items.map((item) => (
            <figure key={item.key}>
              {item.status === 'uploading' || (item.status === 'failed' && !item.url) ? (
                <Skeleton variant="card" style={{ display: 'block' }} />
              ) : (
                <Img
                  src={item.url}
                  alt={item.name}
                  width={400}
                  height={300}
                  lazy
                />
              )}
              <figcaption>
                {item.status === 'uploading' ? (
                  <>
                    {item.name} · uploading {item.percent ?? 0}%
                    <ProgressTrack percent={item.percent ?? 0} announce label={`Uploading ${item.name}`} />
                  </>
                ) : (
                  <>
                    {item.name}
                    {item.size ? ` · ${sizeLabel(item.size)}` : ''}
                    {item.status === 'failed' ? ` · ${item.error}` : ''}
                  </>
                )}
                <span className="row" style={{ marginTop: 'var(--space-2)' }}>
                  {item.status === 'failed' && onRetry ? (
                    <Button kind="ghost" size="sm" type="button" onClick={() => onRetry(item)}>Try again</Button>
                  ) : null}
                  {item.status !== 'uploading' && onRemove ? (
                    <Button kind="ghost" size="sm" type="button" onClick={() => onRemove(item)}>Remove</Button>
                  ) : null}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      {failed.length ? (
        <Alert kind="error" title={`${failed[0].name} did not upload`} style={{ marginTop: 'var(--space-4)' }}>
          {failed[0].error}
          {failed.length > 1 ? ` ${failed.length - 1} other ${failed.length === 2 ? 'photograph' : 'photographs'} could not be added either.` : ''}
          {onRetry ? (
            <div className="row" style={{ marginTop: 'var(--space-3)' }}>
              <Button kind="ghost" size="sm" type="button" onClick={() => onRetry(failed[0])}>Try again</Button>
            </div>
          ) : null}
        </Alert>
      ) : null}
    </>
  );
}
