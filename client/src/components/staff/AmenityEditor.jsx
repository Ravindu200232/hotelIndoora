import { useState } from 'react';
import { Button, PlainList } from '../index.jsx';

const limit = 60;

/**
 * The amenities a room type offers, as the desk keeps them.
 *
 * They read as a plain list on the guest's page, so they are edited as one: each
 * is removed on its own, and a new one is added to the end. An empty list is a
 * real answer - a room type simply has nothing listed yet.
 */
export function AmenityEditor({ amenities = [], onChange, note, error }) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (value.length > limit || amenities.length >= limit) return;
    onChange([...amenities, value]);
    setDraft('');
  };

  return (
    <>
      <h2 id="amenities-title">Amenities</h2>
      <p className="small muted">
        These read as a list on the room type page. {amenities.length} added.
      </p>
      {amenities.length === 0 ? (
        <p className="small muted">Nothing listed yet. Add the first amenity below.</p>
      ) : (
        <PlainList>
          {amenities.map((amenity, index) => (
            <li key={`${amenity}-${index}`}>
              <span>{amenity}</span>
              <Button
                kind="ghost"
                size="sm"
                type="button"
                onClick={() => onChange(amenities.filter((_, position) => position !== index))}
              >
                Remove
              </Button>
            </li>
          ))}
        </PlainList>
      )}

      <div className="field" style={{ maxWidth: '420px' }}>
        <label htmlFor="amenity-new">Add an amenity</label>
        <div className="password-row">
          <input
            type="text"
            id="amenity-new"
            value={draft}
            maxLength={limit}
            placeholder="Add an amenity, for example Mini bar"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                add();
              }
            }}
          />
          <Button kind="ghost" size="sm" type="button" onClick={add} disabled={!draft.trim()}>
            Add
          </Button>
        </div>
        {error ? <span className="field__error">{error}</span> : null}
        <span className="field__hint">
          {amenities.length} added{note ? ` · ${note}` : ''}
        </span>
      </div>
    </>
  );
}
