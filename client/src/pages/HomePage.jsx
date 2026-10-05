import { useState } from 'react';
import { api } from '../api.js';
import { useHotel } from '../hotel.jsx';
import { useAsync } from '../hooks/useAsync.jsx';
import { Hero } from '../components/home/Hero.jsx';
import { FeatureGrid } from '../components/home/FeatureGrid.jsx';
import { AvailabilitySearch } from '../components/home/AvailabilitySearch.jsx';
import { FeaturedRoomTypes } from '../components/home/FeaturedRoomTypes.jsx';
import { HotelDetailsPanel } from '../components/home/HotelDetailsPanel.jsx';

/**
 * Home: what the hotel is, what a stay includes, the dates-and-guests search
 * that starts a booking, the room types on sale, and the hotel's own details.
 *
 * The room types, the rates and the hotel's details are the real ones; the
 * photographs are the approved prototype's own, reuse and all.
 */
export function HomePage() {
  const { hotel, loading: hotelLoading, error: hotelError, reload: reloadHotel } = useHotel();
  const [photosFailed, setPhotosFailed] = useState(false);
  const roomTypes = useAsync(() => api.roomTypes(), []);

  return (
    <>
      <Hero onImageError={() => setPhotosFailed(true)} />
      <FeatureGrid photosFailed={photosFailed} />
      <section className="section" aria-labelledby="search-title">
        <div className="wrap">
          <AvailabilitySearch />
        </div>
      </section>
      <FeaturedRoomTypes
        roomTypes={roomTypes.data?.room_types ?? []}
        loading={roomTypes.loading}
        error={roomTypes.error}
        onRetry={roomTypes.reload}
      />
      <HotelDetailsPanel
        hotel={hotel}
        loading={hotelLoading}
        error={hotelError}
        onRetry={reloadHotel}
      />
    </>
  );
}
