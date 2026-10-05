import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api, formatShortDate, formatTime, readPhoto, uploadWithProgress } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import { Alert, Button, LoadingBlock, Topbar } from '../components/index.jsx';
import { RoomTypeForm, validateRoomType } from '../components/staff/RoomTypeForm.jsx';
import { PhotoUploader, photoProblem } from '../components/staff/PhotoUploader.jsx';
import { AmenityEditor } from '../components/staff/AmenityEditor.jsx';
import { OnSaleToggle } from '../components/staff/OnSaleToggle.jsx';
import { BlockedAheadPanel } from '../components/staff/BlockedAheadPanel.jsx';

/** What a photograph is called in the strip: the file's own name where we know it. */
function photoLabel(url, index) {
  const segment = String(url).split('?')[0].split('#')[0].split('/').filter(Boolean).pop() ?? '';
  const stored = segment.match(/^\d{13}-(.+)$/);
  if (stored) return stored[1];
  if (/^[a-z]{3,}-[0-9]/.test(segment)) return `Photograph ${index + 1}`;
  return decodeURIComponent(segment) || `Photograph ${index + 1}`;
}

/**
 * Edit Room Type: everything about one room type in one place.
 *
 * Its name, description, rate, rooms, guests, bed, size, photographs, amenities
 * and on-sale state, with the nights its rooms are out of service summarised at
 * the bottom and a way through to them. A rate change applies to bookings made
 * from now on; bookings already made keep the rate they were booked at, which is
 * why the rate lives on the booking rather than being read back from here.
 */
export function EditRoomTypePage() {
  const { roomTypeId } = useParams();
  const location = useLocation();
  const roomType = useAsync(() => api.staffRoomType(roomTypeId), [roomTypeId]);
  const blocks = useAsync(() => api.staffBlocks(roomTypeId), [roomTypeId]);

  const [values, setValues] = useState(null);
  const [amenities, setAmenities] = useState([]);
  const [items, setItems] = useState([]);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ status: 'idle', message: null });

  const loaded = roomType.data?.room_type ?? null;

  // The form starts from what the hotel has now.
  useEffect(() => {
    if (!loaded || values) return;
    setValues({
      name: loaded.name ?? '',
      description: loaded.description ?? '',
      nightly_rate: String(loaded.nightly_rate ?? ''),
      room_count: String(loaded.room_count ?? ''),
      max_guests: String(loaded.max_guests ?? ''),
      bed_type_and_size: loaded.bed_type_and_size ?? '',
      room_size_sqm: loaded.room_size_sqm == null ? '' : String(loaded.room_size_sqm),
      on_sale: Boolean(loaded.on_sale),
    });
    setAmenities(loaded.amenities ?? []);
  }, [loaded, values]);

  // The strip shows what is stored now, keeping anything in flight or refused.
  useEffect(() => {
    if (!loaded) return;
    setItems((current) => {
      const unsettled = current.filter((item) => item.status === 'uploading' || item.status === 'failed');
      const stored = (loaded.photos ?? []).map((url, index) => ({
        key: url,
        name: photoLabel(url, index),
        url,
        status: 'added',
      }));
      return [...stored, ...unsettled.filter((item) => !stored.some((one) => one.key === item.key))];
    });
  }, [loaded]);

  const change = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const upload = async (file) => {
    const problem = photoProblem(file, { count: items.filter((item) => item.status === 'added').length });
    const key = `${file.name}-${file.size}-${Date.now()}`;
    setItems((current) => [...current, {
      key,
      name: file.name,
      size: file.size,
      file,
      url: problem ? null : URL.createObjectURL(file),
      status: problem ? 'failed' : 'uploading',
      percent: 0,
      error: problem ?? null,
    }]);
    if (problem) return;
    try {
      const data = await readPhoto(file);
      await uploadWithProgress(
        `/staff/room-types/${roomTypeId}/photos`,
        { filename: file.name, content_type: file.type, data },
        (percent) => setItems((current) => current.map((item) => (item.key === key ? { ...item, percent } : item))),
      );
      setItems((current) => current.map((item) => (item.key === key ? { ...item, status: 'added' } : item)));
      roomType.reload();
    } catch (error) {
      setItems((current) => current.map((item) => (item.key === key ? { ...item, status: 'failed', error: error.message } : item)));
    }
  };

  const retryPhoto = async (item) => {
    if (!item.file) return;
    const problem = photoProblem(item.file, { count: items.filter((one) => one.status === 'added').length });
    setItems((current) => current.map((one) => (one.key === item.key
      ? { ...one, status: problem ? 'failed' : 'uploading', error: problem ?? null, url: problem ? null : URL.createObjectURL(item.file) }
      : one)));
    if (problem) return;
    try {
      const data = await readPhoto(item.file);
      await uploadWithProgress(
        `/staff/room-types/${roomTypeId}/photos`,
        { filename: item.name, content_type: item.file.type, data },
        (percent) => setItems((current) => current.map((one) => (one.key === item.key ? { ...one, percent } : one))),
      );
      setItems((current) => current.map((one) => (one.key === item.key ? { ...one, status: 'added' } : one)));
      roomType.reload();
    } catch (error) {
      setItems((current) => current.map((one) => (one.key === item.key ? { ...one, status: 'failed', error: error.message } : one)));
    }
  };

  const removePhoto = async (item) => {
    if (item.status !== 'added') {
      if (item.url?.startsWith('blob:')) URL.revokeObjectURL(item.url);
      setItems((current) => current.filter((one) => one.key !== item.key));
      return;
    }
    setState({ status: 'saving', message: null });
    try {
      await api.staffUpdateRoomType(roomTypeId, { remove_photo: item.url });
      setItems((current) => current.filter((one) => one.key !== item.key));
      setState({ status: 'saved', message: null });
      roomType.reload();
    } catch (error) {
      setState({ status: 'failed', message: error.message });
    }
  };

  const save = async () => {
    const problems = validateRoomType(values);
    setErrors(problems);
    if (Object.keys(problems).length) {
      setState({ status: 'idle', message: null });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setState({ status: 'saving', message: null });
    try {
      await api.staffUpdateRoomType(roomTypeId, {
        name: values.name.trim(),
        description: values.description,
        nightly_rate: Number(values.nightly_rate),
        room_count: Number(values.room_count),
        max_guests: Number(values.max_guests),
        bed_type_and_size: values.bed_type_and_size,
        ...(values.room_size_sqm === '' ? {} : { room_size_sqm: Number(values.room_size_sqm) }),
        amenities,
        on_sale: values.on_sale,
      });
      setState({ status: 'saved', message: null });
      roomType.reload();
    } catch (error) {
      setErrors(error.errors ?? {});
      setState({ status: 'failed', message: error.errors ? null : error.message });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (roomType.failed) {
    return (
      <>
        <Topbar
          trail={[{ label: 'Room Types', to: '/staff/room-types' }, { label: 'Room type' }]}
          title="Edit room type"
          note="Nothing has been changed."
        />
        <Alert kind="error" title="This room type could not be loaded">
          {roomType.error?.status === 404
            ? 'That room type is not one of ours, so there is nothing to change here.'
            : `${roomType.error?.message} — nothing has been changed.`}
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Button kind="primary" size="sm" type="button" onClick={roomType.reload}>Try again</Button>
            <Link className="btn btn--ghost btn--sm" to="/staff/room-types">Back to Room Types</Link>
          </div>
        </Alert>
      </>
    );
  }

  if (!values || roomType.loading) {
    return (
      <>
        <Topbar
          trail={[{ label: 'Room Types', to: '/staff/room-types' }, { label: 'Room type' }]}
          title="Edit room type"
          note="Loading this room type…"
        />
        <LoadingBlock label="Loading this room type…" lines={3} />
      </>
    );
  }

  const failures = location.state?.photoFailures ?? [];
  const created = location.state?.created ?? null;

  return (
    <>
      <Topbar
        trail={[{ label: 'Room Types', to: '/staff/room-types' }, { label: loaded.name }]}
        title="Edit room type"
        note={`${loaded.name} · ${loaded.room_count} ${loaded.room_count === 1 ? 'room' : 'rooms'} · last saved ${loaded.updated_at ? `${formatShortDate(loaded.updated_at).slice(4)} at ${formatTime(loaded.updated_at)}` : 'not recorded yet'}`}
        actions={(
          <>
            <Button kind="primary" type="button" onClick={save} disabled={state.status === 'saving'} aria-busy={state.status === 'saving'}>
              {state.status === 'saving' ? 'Saving…' : 'Save changes'}
            </Button>
            <Link className="btn btn--ghost" to="/staff/room-types">Back to Room Types</Link>
            <Link className="btn btn--quiet" to={`/rooms/${loaded.id}`}>View on the site</Link>
          </>
        )}
      />

      {created ? (
        <Alert kind="success" title="Room type saved">
          {created} is on sale and appears to guests on Available Rooms for every night it has a free room.{' '}
          <Link to="/staff/room-types">Back to Room Types</Link>
        </Alert>
      ) : null}

      {state.status === 'saved' ? (
        <Alert kind="success" title="Changes saved">
          {loaded.name} is up to date. The new nightly rate applies to bookings made from now on; bookings already made
          keep the rate they were booked at.
        </Alert>
      ) : null}

      {failures.length ? (
        <Alert kind="error" title={`${failures[0].name} did not upload`}>
          {failures[0].error} The room type itself is saved — add the photograph again from the section below.
        </Alert>
      ) : null}

      <RoomTypeForm
        mode="edit"
        values={values}
        onChange={change}
        errors={errors}
        saving={state.status === 'saving'}
        onSubmit={save}
        summaryTitle="Your changes were not saved"
        photos={(
          <PhotoUploader
            items={items}
            onSelect={(files) => files.forEach(upload)}
            onRemove={removePhoto}
            onRetry={retryPhoto}
            heading="Photographs"
            showCountInHeading
          />
        )}
        amenities={<AmenityEditor amenities={amenities} onChange={setAmenities} />}
        onSale={(
          <OnSaleToggle
            id="edit-on-sale-check"
            label="On sale"
            hint="Guests see and book this room type on Available Rooms for every night it has a free room. Turn it off to stop selling it; a room type is never deleted, and its bookings stay valid."
            checked={values.on_sale}
            onChange={(checked) => change('on_sale', checked)}
          />
        )}
        extra={(
          <BlockedAheadPanel
            roomTypeId={roomTypeId}
            data={blocks.data}
            loading={blocks.loading}
            failed={blocks.failed}
            error={blocks.error}
            onRetry={blocks.reload}
          />
        )}
        actions={(
          <>
            <Button kind="primary" type="submit" disabled={state.status === 'saving'} aria-busy={state.status === 'saving'}>
              {state.status === 'saving' ? 'Saving…' : 'Save changes'}
            </Button>
            <Link className="btn btn--ghost" to="/staff/room-types">Back to Room Types</Link>
          </>
        )}
      />
    </>
  );
}
