import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, readPhoto, uploadWithProgress } from '../api.js';
import { Alert, Button, Topbar } from '../components/index.jsx';
import { RoomTypeForm, validateRoomType } from '../components/staff/RoomTypeForm.jsx';
import { PhotoUploader, photoProblem } from '../components/staff/PhotoUploader.jsx';
import { AmenityEditor } from '../components/staff/AmenityEditor.jsx';
import { OnSaleToggle } from '../components/staff/OnSaleToggle.jsx';

const EMPTY = {
  name: '',
  nightly_rate: '',
  room_count: '',
  description: '',
  bed_type_and_size: '',
  room_size_sqm: '',
  max_guests: '',
  on_sale: true,
};

/**
 * New Room Type: everything the hotel needs before a room type can be sold.
 *
 * Photographs need the room type to exist before they can be stored, so they are
 * held here while the form is filled in and uploaded the moment the room type is
 * created - each one with its own real progress, and any that cannot be added
 * named with the reason. The desk is then taken to the room type it just made, so
 * a refused photograph can be put right without losing anything.
 */
export function NewRoomTypePage() {
  const navigate = useNavigate();
  const [values, setValues] = useState(EMPTY);
  const [amenities, setAmenities] = useState([]);
  const [items, setItems] = useState([]);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ status: 'idle', message: null });

  const change = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const select = (files) => {
    setItems((current) => {
      const next = [...current];
      for (const file of files) {
        const problem = photoProblem(file, { count: next.length });
        next.push({
          key: `${file.name}-${file.size}-${Date.now()}-${next.length}`,
          name: file.name,
          size: file.size,
          file,
          url: problem ? null : URL.createObjectURL(file),
          status: problem ? 'failed' : 'pending',
          percent: 0,
          error: problem ?? null,
        });
      }
      return next;
    });
  };

  const retry = (item) => {
    if (!item.file) return;
    const problem = photoProblem(item.file, { count: items.filter((one) => one !== item).length });
    setItems((current) => current.map((one) => (one.key === item.key
      ? { ...one, status: problem ? 'failed' : 'pending', error: problem ?? null, url: problem ? null : URL.createObjectURL(item.file) }
      : one)));
  };

  const remove = (item) => {
    if (item.url?.startsWith('blob:')) URL.revokeObjectURL(item.url);
    setItems((current) => current.filter((one) => one.key !== item.key));
  };

  const mark = (key, changes) => setItems((current) => current.map((one) => (one.key === key ? { ...one, ...changes } : one)));

  const save = async () => {
    const problems = validateRoomType(values);
    setErrors(problems);
    if (Object.keys(problems).length) {
      setState({ status: 'idle', message: null });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setState({ status: 'saving', message: null });
    let created;
    try {
      created = await api.staffCreateRoomType({
        name: values.name.trim(),
        nightly_rate: Number(values.nightly_rate),
        room_count: Number(values.room_count),
        description: values.description,
        bed_type_and_size: values.bed_type_and_size,
        amenities,
        photos: [],
        max_guests: Number(values.max_guests),
        ...(values.room_size_sqm === '' ? {} : { room_size_sqm: Number(values.room_size_sqm) }),
        on_sale: values.on_sale,
      });
    } catch (error) {
      setErrors(error.errors ?? {});
      setState({ status: 'failed', message: error.errors ? null : error.message });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const id = created.room_type.id;
    const failures = [];
    for (const item of items.filter((one) => one.status === 'pending')) {
      mark(item.key, { status: 'uploading', percent: 0 });
      try {
        const data = await readPhoto(item.file);
        await uploadWithProgress(
          `/staff/room-types/${id}/photos`,
          { filename: item.name, content_type: item.file.type, data },
          (percent) => mark(item.key, { percent }),
        );
        mark(item.key, { status: 'added' });
        if (item.url?.startsWith('blob:')) URL.revokeObjectURL(item.url);
      } catch (error) {
        mark(item.key, { status: 'failed', error: error.message });
        failures.push({ name: item.name, error: error.message });
      }
    }

    navigate(`/staff/room-types/${id}`, { state: { created: created.room_type.name, photoFailures: failures } });
  };

  return (
    <>
      <Topbar
        trail={[{ label: 'Room Types', to: '/staff/room-types' }, { label: 'New room type' }]}
        title="New Room Type"
        note="A room type is what a guest books: its rate, how many rooms of it the hotel has, and everything shown on its page."
        actions={(
          <>
            <Link className="btn btn--ghost" to="/staff/room-types">Cancel</Link>
            <Button kind="primary" type="button" onClick={save} disabled={state.status === 'saving'} aria-busy={state.status === 'saving'}>
              {state.status === 'saving' ? 'Saving…' : 'Save room type'}
            </Button>
          </>
        )}
      />

      {state.status === 'saving' ? (
        <Alert kind="info" title="Saving this room type">
          {items.filter((item) => item.status === 'pending').length
            ? 'The room type is being created and then its photographs are going up. Anything you typed is still here.'
            : 'The room type is being created. Anything you typed is still here.'}
        </Alert>
      ) : null}

      {state.status === 'failed' && state.message ? (
        <Alert kind="error" title="We could not save this room type">
          {state.message} Nothing was saved and everything you typed is still here, so you can put it right and save
          again.
        </Alert>
      ) : null}

      <RoomTypeForm
        mode="create"
        values={values}
        onChange={change}
        errors={errors}
        saving={state.status === 'saving'}
        onSubmit={save}
        photos={(
          <PhotoUploader
            items={items}
            onSelect={select}
            onRemove={remove}
            onRetry={retry}
            note="The first one is what guests see before they open the room type."
          />
        )}
        amenities={<AmenityEditor amenities={amenities} onChange={setAmenities} />}
        onSale={<OnSaleToggle checked={values.on_sale} onChange={(checked) => change('on_sale', checked)} />}
        actions={(
          <>
            <Button kind="primary" type="submit" disabled={state.status === 'saving'} aria-busy={state.status === 'saving'}>
              {state.status === 'saving' ? 'Saving…' : 'Save room type'}
            </Button>
            <Link className="btn btn--ghost" to="/staff/room-types">Cancel</Link>
          </>
        )}
        alerts={(
          <p className="small muted">
            Cancel leaves this form without creating a room type. A room type is never deleted — take it off sale instead.
          </p>
        )}
      />
    </>
  );
}
