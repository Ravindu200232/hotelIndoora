import { Link } from 'react-router-dom';
import { Badge, Card, CardBody, CardFlag, CardFoot, CardMedia, CardMeta, CardTitle, Img, Price } from '../index.jsx';
import { photoAt, firstSentence } from '../ui/media.jsx';

/**
 * One room type free for the chosen nights, with its photograph, its nightly
 * rate and the total for the whole stay, exactly as the prototype's results
 * list shows it.
 */
export function RoomResultCard({ roomType, nights, description }) {
  const total = roomType.total ?? Number((Number(roomType.nightly_rate) * nights).toFixed(2));
  return (
    <Card className="room-card">
      <CardMedia>
        <Img
          src={photoAt(roomType.photos?.[0], 800)}
          alt={`${roomType.name}: ${firstSentence(roomType.description) || 'a room at hotelIndoora'}`}
          width={800}
          height={550}
        />
        <CardFlag>
          {roomType.free_rooms === 1 ? '1 room free' : `${roomType.free_rooms} rooms free`}
        </CardFlag>
      </CardMedia>
      <CardBody>
        <CardTitle to={`/rooms/${roomType.id}`}>{roomType.name}</CardTitle>
        <CardMeta>
          {[roomType.bed_type_and_size, roomType.room_size_sqm ? `${roomType.room_size_sqm} m²` : null,
            `up to ${roomType.max_guests} guests`].filter(Boolean).join(' · ')}
        </CardMeta>
        <ul className="room-card__stats">
          <li><b>Nightly rate</b> €{Number(roomType.nightly_rate).toFixed(2)}</li>
          <li><b>Total for {nights} nights</b> €{Number(total).toFixed(2)}</li>
        </ul>
        <p className="small muted">{description ?? firstSentence(roomType.description)}</p>
      </CardBody>
      <CardFoot>
        <Badge kind="sale">Free for your dates</Badge>
        <Link className="arrow-link link-arrow" to={`/rooms/${roomType.id}`}>View room type</Link>
      </CardFoot>
    </Card>
  );
}
