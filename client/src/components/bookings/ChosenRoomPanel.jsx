import { Link } from 'react-router-dom';
import { Img, KvList, Panel } from '../index.jsx';
import { photoAt, firstSentence } from '../ui/media.jsx';

/**
 * The room type and the stay the guest chose, kept beside the details form so
 * they can see what they are booking while they fill it in — with its
 * photograph, its rate and the total for the whole stay.
 */
export function ChosenRoomPanel({ roomType, stay }) {
  const rate = Number(roomType?.nightly_rate ?? 0);
  const total = Number((rate * (stay?.nights ?? 0)).toFixed(2));
  return (
    <Panel accent aria-labelledby="chosen-title">
      {roomType?.photos?.[0] ? (
        <div className="card__media" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 'var(--space-3)' }}>
          <Img
            src={photoAt(roomType.photos[0], 800)}
            alt={`${roomType.name}: ${firstSentence(roomType.description) || 'a room at hotelIndoora'}`}
            width={800}
            height={550}
          />
        </div>
      ) : null}
      <h3 id="chosen-title"><Link to={`/rooms/${roomType?.id ?? ''}`}>{roomType?.name ?? '—'}</Link></h3>
      <p className="small muted">
        {[roomType?.bed_type_and_size, roomType?.room_size_sqm ? `${roomType.room_size_sqm} m²` : null,
          roomType?.max_guests ? `up to ${roomType.max_guests} guests` : null].filter(Boolean).join(' · ')}
      </p>
      <KvList rows={[
        ['Check-in', `${stay?.checkInLabel ?? '—'}`],
        ['Check-out', `${stay?.checkOutLabel ?? '—'}`],
        ['Nights', stay?.nights ?? 0],
        ['Nightly rate', `€${rate.toFixed(2)}`],
        ['Total', `€${total.toFixed(2)}`],
      ]} />
      <p className="small muted">
        The nightly rate is the final price. Nothing is added at checkout, and you pay the full amount through PayPal on
        the next step.
      </p>
      <div className="row">
        <Link className="btn btn--ghost btn--sm" to="/rooms">Change dates or room type</Link>
        <Link className="btn btn--quiet btn--sm" to={`/rooms/${roomType?.id ?? ''}`}>Back to room type</Link>
      </div>
      <hr />
      <p className="small muted" style={{ margin: 0 }}>
        One booking covers one room of one room type. Booking two rooms means making two bookings.
      </p>
    </Panel>
  );
}
