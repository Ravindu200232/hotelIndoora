import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

/**
 * Who is signed in, and what they may do.
 *
 * The answer comes from the server - the session cookie is read there, never by
 * this code - so the navigation a page shows and the access the server allows
 * are decided by the same fact. The role is used for presentation only; every
 * request is checked again on the server.
 */
const SessionContext = createContext({
  status: 'loading', account: null, role: null,
  signIn: async () => {}, signOut: async () => {}, register: async () => {}, refresh: async () => {},
});

export function SessionProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', account: null });

  const refresh = useCallback(async () => {
    try {
      const payload = await api.session();
      setState({ status: 'ready', account: payload?.account ?? null });
      return payload?.account ?? null;
    } catch (error) {
      // A refusal here means "not signed in", which is a normal state of the
      // product rather than an error to show.
      if (error.status === 401 || error.status === 403) {
        setState({ status: 'ready', account: null });
        return null;
      }
      setState({ status: 'ready', account: null });
      return null;
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({
    status: state.status,
    account: state.account,
    role: state.account?.role ?? 'visitor',
    signedIn: Boolean(state.account),
    refresh,
    async signIn(email, password) {
      const payload = await api.signIn(email, password);
      setState({ status: 'ready', account: payload.account });
      return payload.account;
    },
    async register(body) {
      const payload = await api.register(body);
      setState({ status: 'ready', account: payload.account });
      return payload;
    },
    async signOut() {
      try { await api.signOut(); } catch { /* the cookie is cleared server-side either way */ }
      setState({ status: 'ready', account: null });
    },
  }), [state, refresh]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

/** The first page each role lands on once signed in, per the specification. */
export const homeFor = (role) => (role === 'hotel_staff' ? '/staff' : role === 'guest' ? '/my-bookings' : '/');
