import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

/**
 * The hotel's own public details — name, address, phone, email, check-in and
 * check-out times and house rules — read once and shared by every page that
 * shows them and by the footer of every shell.
 *
 * They are kept in one place because the hotel changes them from Hotel Details
 * and the whole site must move together.
 */
const HotelContext = createContext({ hotel: null, error: null, loading: true, reload: async () => {} });

export function HotelProvider({ children }) {
  const [state, setState] = useState({ hotel: null, error: null, loading: true });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const payload = await api.hotelDetails();
      setState({ hotel: payload.hotel_details, error: null, loading: false });
    } catch (error) {
      setState({ hotel: null, error: error.message, loading: false });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const value = useMemo(() => ({ ...state, reload: load }), [state, load]);
  return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>;
}

export const useHotel = () => useContext(HotelContext);
