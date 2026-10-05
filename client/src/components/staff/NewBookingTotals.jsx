import { Link } from 'react-router-dom';
import { Alert, Button, Img, KvList, Panel, ProgressTrack } from '../index.jsx';
import { formatDate, money } from '../../api.js';
import { photoAt, firstSentence } from '../ui/media.jsx';

/**
 * The total for the stay the desk is taking, beside the room type it is for.
 *
 * Nothing is added at checkout — the nightly rate is the whole price — and the
 * room is held from the moment the booking is taken, while the guest pays the
 * emailed link.
 */
export function NewBookingTotals({
  roomType,
  checkIn,
  checkOut,
  nights,
  guests,
  arrival,
  total,
  onContinue,
  saving,
  failed,
  onRetry,
}) {
  return (
    <Panel as="aside" accent aria-labelledby="total-title">
      <h2 id="total-title">Total for the stay</h2>

      {roomType?.photos?.[0] ? (
        <Img
          src={photoAt(roomType.photos[0], 800)}
          alt={`${roomType.name}: ${firstSentence(roomType.description) || 'a room at hotelIndoora'}`}
          width={800}
          height={550}
          style={{ borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}
        />
      ) : null}

      <h3>{roomType?.name ?? 'Choose a room type'}</h3>
      <KvList rows={[
        ['Check-in', formatDate(checkIn)],
        ['Check-out', formatDate(checkOut)],
        ['Nights', nights || '—'],
        ['Nightly rate', roomType ? money(roomType.nightly_rate) : '—'],
        ['Guests', guests],
        ['Expected arrival', arrival || '—'],
        ['Total', roomType ? money(total) : '—'],
      ]} />
      <p className="small muted">The nightly rate is the final price — no tax, cleaning or service fee is added.</p>

      <Button
        kind="primary"
        block
        type="button"
        onClick={onContinue}
        disabled={saving || !roomType}
        aria-busy={saving}
      >
        {saving ? 'Taking the booking…' : 'Continue to send payment link'}
      </Button>

      {saving ? (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <ProgressTrack percent={55} announce label="Taking the booking" />
        </div>
      ) : null}

      {failed ? (
        <Alert kind="error" title="The booking could not be taken" style={{ marginTop: 'var(--space-4)' }}>
          {failed} Nothing has been booked and no room is held.
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Button kind="ghost" size="sm" type="button" onClick={onRetry}>Try again</Button>
          </div>
        </Alert>
      ) : null}

      <p style={{ marginTop: 'var(--space-3)' }}>
        <Link className="btn btn--ghost btn--block" to="/staff/bookings">Cancel</Link>
      </p>
      <p className="small muted">
        The room is held and the guest is emailed a PayPal link for {roomType ? money(total) : 'the total'}. The booking
        shows as waiting for payment until they pay.
      </p>
    </Panel>
  );
}
