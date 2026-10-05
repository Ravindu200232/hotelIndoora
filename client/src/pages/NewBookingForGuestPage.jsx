import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, todayIso, addDays, nightsBetween } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import { useHotel } from '../hotel.jsx';
import { Alert, Steps, Topbar } from '../components/index.jsx';
import { DatesRoomPicker, validateStay } from '../components/staff/DatesRoomPicker.jsx';
import { GuestStayForm, validateGuest } from '../components/staff/GuestStayForm.jsx';
import { NewBookingTotals } from '../components/staff/NewBookingTotals.jsx';

const STEPS = ['Dates and room', 'Guest and stay', 'Send payment link'];

/**
 * New Booking for a Guest: taking a stay for someone who phoned or walked in.
 *
 * The desk checks what is free for the nights, picks one room of one room type,
 * takes the guest's own details and the booking is created as waiting for payment
 * — which holds the room while the guest pays the emailed PayPal link. It confirms
 * with its reference the moment they pay.
 */
export function NewBookingForGuestPage() {
  const navigate = useNavigate();
  const { hotel } = useHotel();
  const [values, setValues] = useState({
    check_in_date: todayIso(),
    check_out_date: addDays(todayIso(), 2),
    guest_count: 2,
    lead_guest_name: '',
    guest_email: '',
    contact_phone: '',
    expected_arrival_time: hotel?.check_in_time ?? '15:00',
    special_requests: '',
  });
  const [errors, setErrors] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [state, setState] = useState({ status: 'idle', message: null });
  const [checked, setChecked] = useState(false);

  const roomTypes = useAsync(() => api.staffRoomTypes(), []);
  const onSale = useMemo(
    () => (roomTypes.data?.room_types ?? []).filter((roomType) => roomType.on_sale),
    [roomTypes.data],
  );

  const nights = nightsBetween(values.check_in_date, values.check_out_date);
  const loadAvailability = useCallback(
    () => api.availability({
      checkIn: values.check_in_date,
      checkOut: values.check_out_date,
      guests: values.guest_count,
    }),
    [values.check_in_date, values.check_out_date, values.guest_count],
  );
  const availability = useAsync(loadAvailability, [loadAvailability]);
  const freeRows = availability.data?.room_types ?? [];
  const chosenRow = freeRows.find((row) => String(row.room_type_id) === String(selectedId)) ?? null;
  const chosenRoomType = onSale.find((roomType) => String(roomType.id) === String(selectedId)) ?? null;
  const total = chosenRow ? Number(chosenRow.total) : 0;

  // A room type the desk chose that is no longer free for the dates it has since
  // typed is dropped, so the total beside the form always belongs to a real
  // choice that can still be sold.
  useEffect(() => {
    if (!checked || availability.loading) return;
    if (selectedId && !freeRows.some((row) => String(row.room_type_id) === String(selectedId))) {
      setSelectedId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability.loading, availability.data, checked, selectedId]);

  const change = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  // A room type the desk has chosen that is no longer free for changed dates is
  // dropped, so the total beside the form always belongs to a real choice.
  const check = () => {
    const problems = validateStay(values);
    setErrors(problems);
    setChecked(true);
    setState({ status: 'idle', message: null });
    availability.reload();
  };

  const take = async () => {
    const problems = {
      ...validateStay(values),
      ...validateGuest(values, { maxGuests: chosenRoomType?.max_guests, checkInTime: hotel?.check_in_time }),
    };
    if (!chosenRow) problems.room_type_id = 'Choose a room type that is free for these nights.';
    setErrors(problems);
    if (Object.keys(problems).length) {
      setState({ status: 'idle', message: null });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setState({ status: 'saving', message: null });
    try {
      const payload = await api.staffCreateBooking({
        room_type_id: selectedId,
        check_in_date: values.check_in_date,
        check_out_date: values.check_out_date,
        lead_guest_name: values.lead_guest_name.trim(),
        guest_email: values.guest_email.trim(),
        contact_phone: values.contact_phone.trim(),
        guest_count: Number(values.guest_count),
        expected_arrival_time: values.expected_arrival_time.trim(),
        special_requests: values.special_requests,
      });
      navigate(`/staff/bookings/new/payment?booking_id=${payload.booking.id}`);
    } catch (error) {
      setErrors(error.errors ?? {});
      setState({ status: 'failed', message: error.errors ? null : error.message });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <>
      <Topbar
        trail={[{ label: 'Bookings', to: '/staff/bookings' }, { label: 'New booking for a guest' }]}
        title="New booking for a guest"
        note="For a guest who phoned or walked in. The payment link and the confirmation both go to the email address below."
        actions={<Link className="btn btn--ghost" to="/staff/bookings">Back to Bookings</Link>}
      />

      <Steps steps={STEPS} current={0} />

      {Object.keys(errors).length ? (
        <Alert kind="error" title="Check the form before taking this booking">
          <ul>
            {Object.entries(errors).map(([field, message]) => (
              <li key={field}>
                {/* A refused room choice belongs to the dates it was checked for. */}
                <a href={`#${field === 'room_type_id' ? 'dates-title' : field}`}>{message}</a>
              </li>
            ))}
          </ul>
          Nothing has been booked, so nothing is held and nothing is charged.
        </Alert>
      ) : null}

      {state.status === 'failed' && state.message ? (
        <Alert kind="error" title="The booking could not be taken">
          {state.message} Nothing has been booked and no room is held.
        </Alert>
      ) : null}

      <div className="split">
        <div>
          <DatesRoomPicker
            values={values}
            onChange={change}
            errors={errors}
            onCheck={check}
            checking={availability.loading}
            nights={nights}
            allRoomTypes={onSale}
            freeRoomTypes={freeRows}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setState({ status: 'idle', message: null });
            }}
            noneFree={checked && !availability.loading && freeRows.length === 0}
          />

          {availability.failed ? (
            <Alert kind="error" title="We could not check what is free" style={{ marginTop: 'var(--space-5)' }}>
              {availability.error.message} — no room is held and nothing has been booked.
              <div className="row" style={{ marginTop: 'var(--space-3)' }}>
                <button className="btn btn--ghost btn--sm" type="button" onClick={availability.reload}>Try again</button>
              </div>
            </Alert>
          ) : null}

          <GuestStayForm
            values={values}
            onChange={change}
            errors={errors}
            checkInTime={hotel?.check_in_time}
            maxGuests={chosenRoomType?.max_guests}
          />
        </div>

        <NewBookingTotals
          roomType={chosenRoomType}
          checkIn={values.check_in_date}
          checkOut={values.check_out_date}
          nights={nights}
          guests={values.guest_count}
          arrival={values.expected_arrival_time}
          total={total}
          onContinue={take}
          saving={state.status === 'saving'}
          failed={state.status === 'failed' ? state.message : null}
          onRetry={take}
        />
      </div>

      <p className="small muted">
        Two rooms for the same guest? Make one booking, then come back here for the second — each booking holds one room
        of one room type. Room types taking fewer guests than the party are left out of the list.
      </p>
    </>
  );
}
