import { Link } from 'react-router-dom';
import { Badge, Card, CardBody, CardFlag, CardFoot, CardMedia, CardMeta, CardTitle, Img, Price, Skeleton } from '../index.jsx';
import { photoAt, firstSentence } from '../ui/media.jsx';

/**
 * The room types the hotel is selling, with their photographs, their rates and
 * what the room is. Three of them, exactly as the featured row on Home.
 *
 * The row has its own loading, empty and error state: a guest never sees a
 * blank page where the rooms should be.
 */
export function FeaturedRoomTypes({ roomTypes = [], loading, error, onRetry }) {
  const featured = roomTypes.slice(0, 3);

  return (
    <section className="section section--tint" aria-labelledby="featured-title">
      <div className="wrap">
        <div className="section__head">
          <div>
            <h2 id="featured-title">Featured room types</h2>
            <p>Rates are per night, for one room of one room type.</p>
          </div>
          <Link className="btn btn--ghost btn--sm" to="/rooms">See all rooms and rates</Link>
        </div>

        {loading ? (
          <div className="grid grid--3" aria-hidden="true">
            {[0, 1, 2].map((key) => (
              <Card key={key}><CardBody><Skeleton variant="card" /></CardBody></Card>
            ))}
          </div>
        ) : null}

        {!loading && error ? (
          <div className="alert alert--error" role="alert">
            <span className="alert__icon" aria-hidden="true">!</span>
            <div className="alert__body">
              <span className="alert__title">We could not load the room types</span>
              {error.message} — check your connection and try once more.
              <div className="row" style={{ marginTop: 'var(--space-3)' }}>
                <button className="btn btn--ghost btn--sm" type="button" onClick={onRetry}>Try again</button>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && !error && featured.length === 0 ? (
          <div className="empty">
            <h3>No rooms are on sale yet</h3>
            <p>
              All of the hotel's room types are off sale at the moment. Please try again later or call the hotel on
              +353 21 477 0128.
            </p>
            <Link className="btn btn--ghost" to="/rooms">Rooms</Link>
          </div>
        ) : null}

        {!loading && !error && featured.length > 0 ? (
          <div className="grid grid--3">
            {featured.map((roomType) => (
              <Card key={roomType.id} className="room-card">
                <CardMedia>
                  <Img
                    src={photoAt(roomType.photos?.[0], 800)}
                    alt={`${roomType.name}: ${firstSentence(roomType.description) || 'a room at hotelIndoora'}`}
                    width={800}
                    height={550}
                  />
                  <CardFlag>{roomType.room_count} rooms</CardFlag>
                </CardMedia>
                <CardBody>
                  <CardTitle to={`/rooms/${roomType.id}`}>{roomType.name}</CardTitle>
                  <CardMeta>
                    {[roomType.bed_type_and_size, roomType.room_size_sqm ? `${roomType.room_size_sqm} m²` : null,
                      `up to ${roomType.max_guests} guests`].filter(Boolean).join(' · ')}
                  </CardMeta>
                  <Price amount={`€${Number(roomType.nightly_rate).toFixed(2)}`} per="per night" />
                  <p className="small muted">{firstSentence(roomType.description)}</p>
                </CardBody>
                <CardFoot>
                  <Badge kind="sale">On sale</Badge>
                  <Link className="link-arrow" to={`/rooms/${roomType.id}`}>View room type</Link>
                </CardFoot>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
