import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, formatTime } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import { useHotel } from '../hotel.jsx';
import { Alert, Button, LoadingBlock, Panel, Skeleton, Stack, Topbar } from '../components/index.jsx';
import { HotelDetailsForm, validateHotelDetails } from '../components/staff/HotelDetailsForm.jsx';

/**
 * Hotel Details: the one set of public details the hotel keeps.
 *
 * Whatever is saved here is what the guest site shows and what the booking emails
 * carry, so saving reloads the hotel's details across the application at once —
 * the header, the footer, Home, every room type page and the booking emails all
 * read the same record. There is no second set to add or delete.
 */
export function HotelDetailsPage() {
  const hotel = useAsync(() => api.staffHotelDetails(), []);
  const { reload: reloadHotel } = useHotel();
  const [values, setValues] = useState(null);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ status: 'idle', message: null });

  const loaded = hotel.data?.hotel_details ?? null;

  useEffect(() => {
    if (!loaded || values) return;
    setValues({
      hotel_name: loaded.hotel_name ?? '',
      address: loaded.address ?? '',
      phone_number: loaded.phone_number ?? '',
      email_address: loaded.email_address ?? '',
      check_in_time: loaded.check_in_time ?? '',
      check_out_time: loaded.check_out_time ?? '',
      house_rules: loaded.house_rules ?? '',
    });
  }, [loaded, values]);

  const change = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setState((current) => (current.status === 'saved' ? { status: 'idle', message: null } : current));
  };

  const save = async () => {
    const problems = validateHotelDetails(values);
    setErrors(problems);
    if (Object.keys(problems).length) {
      setState({ status: 'idle', message: null });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setState({ status: 'saving', message: null });
    try {
      const payload = await api.saveHotelDetails({
        hotel_name: values.hotel_name.trim(),
        address: values.address.trim(),
        phone_number: values.phone_number.trim(),
        email_address: values.email_address.trim(),
        check_in_time: values.check_in_time.trim(),
        check_out_time: values.check_out_time.trim(),
        house_rules: values.house_rules,
      });
      setValues((current) => ({ ...current, ...payload.hotel_details, house_rules: payload.hotel_details.house_rules ?? '' }));
      setErrors({});
      setState({ status: 'saved', message: null });
      hotel.reload();
      // The header, the footer and every guest page read the same record.
      await reloadHotel();
    } catch (error) {
      setErrors(error.errors ?? {});
      setState(error.errors ? { status: 'idle', message: null } : { status: 'failed', message: error.message });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (hotel.failed) {
    return (
      <>
        <Topbar title="Hotel details" note="Nothing has been changed." actions={<Link className="btn btn--ghost" to="/staff">Dashboard</Link>} />
        <Alert kind="error" title="The hotel details could not be loaded">
          {hotel.error.message} — the site keeps showing the details it already has.
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Button kind="primary" size="sm" type="button" onClick={hotel.reload}>Try again</Button>
            <Link className="btn btn--ghost btn--sm" to="/staff">Dashboard</Link>
          </div>
        </Alert>
      </>
    );
  }

  if (hotel.loading || !values) {
    return (
      <>
        <Topbar title="Hotel details" note="Loading the hotel's public details…" actions={<Link className="btn btn--ghost" to="/staff">Dashboard</Link>} />
        <Panel>
          <p className="small muted" style={{ margin: 0 }}>Loading hotel details…</p>
          <Skeleton variant="lg" style={{ display: 'block', width: '45%', marginTop: 'var(--space-3)' }} />
          <Skeleton style={{ display: 'block', width: '70%', marginTop: 'var(--space-3)' }} />
          <Skeleton style={{ display: 'block', width: '55%', marginTop: 'var(--space-3)' }} />
        </Panel>
        <LoadingBlock label="Loading hotel details…" lines={2} />
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Hotel details"
        note="The name, address, phone number, email address, check-in and check-out times and house rules that guests see on the site and in the emails."
        actions={(
          <>
            <Button kind="primary" type="button" onClick={save} disabled={state.status === 'saving'} aria-busy={state.status === 'saving'}>
              {state.status === 'saving' ? 'Saving…' : 'Save hotel details'}
            </Button>
            <Link className="btn btn--ghost" to="/staff">Dashboard</Link>
          </>
        )}
      />

      {state.status === 'saved' ? (
        <Alert kind="success" title="Hotel details saved">
          Home, every room type page, the booking confirmation and the booking emails now show these details.
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Link className="btn btn--ghost btn--sm" to="/">View on the site</Link>
            <Link className="btn btn--quiet btn--sm" to="/rooms">See the rooms</Link>
          </div>
        </Alert>
      ) : null}

      {state.status === 'failed' ? (
        <Alert kind="error" title="The hotel details could not be saved">
          {state.message} Nothing was changed and the site still shows the old details.
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Button kind="ghost" size="sm" type="button" onClick={save}>Retry</Button>
          </div>
        </Alert>
      ) : null}

      <div className="split">
        <div>
          <HotelDetailsForm values={values} onChange={change} errors={errors} />

          <div className="row" style={{ marginTop: 'var(--space-5)' }}>
            <Button kind="primary" type="button" onClick={save} disabled={state.status === 'saving'} aria-busy={state.status === 'saving'}>
              {state.status === 'saving' ? 'Saving…' : 'Save hotel details'}
            </Button>
            <Link className="btn btn--ghost" to="/staff">Dashboard</Link>
          </div>
        </div>

        <Stack as="aside">
          <Panel accent>
            <h4>Last updated</h4>
            <p>
              {loaded?.updated_at
                ? `${formatDate(loaded.updated_at).slice(4)} at ${formatTime(loaded.updated_at)}`
                : 'Not recorded yet'}
            </p>
            <p className="small muted">
              The hotel keeps one single set of details — there is no second one to add or delete.
            </p>
          </Panel>

          <Panel>
            <h4>Where these details show</h4>
            <ul>
              <li>Home, under the search form.</li>
              <li>Every room type page, with the check-in and check-out times.</li>
              <li>Booking Confirmed and Payment Received.</li>
              <li>The booking confirmation and the PayPal payment link emails.</li>
            </ul>
          </Panel>

          <Panel tint>
            <h4>Go to</h4>
            <Link className="btn btn--ghost btn--block" to="/">View on the site</Link>
            <p style={{ marginTop: 'var(--space-3)' }}>
              <Link className="btn btn--ghost btn--block" to="/staff/room-types">Room Types</Link>
            </p>
            <p><Link className="btn btn--ghost btn--block" to="/staff">Dashboard</Link></p>
          </Panel>
        </Stack>
      </div>
    </>
  );
}
