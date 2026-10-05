import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ROUTES } from './routes.jsx';
import { SessionProvider, useSession, homeFor } from './session.jsx';
import { HotelProvider, useHotel } from './hotel.jsx';
import { ToastProvider, Alert, LoadingBlock } from './components/ui/feedback.jsx';
import { SiteShell } from './components/layout/Shell.jsx';
import { AuthFrame } from './components/layout/headers.jsx';
import { PendingPage, NotFoundPage } from './pages/NotFoundPage.jsx';
import { api } from './api.js';

/**
 * The application's own door: one route table, one shell per kind of page, and
 * the two rules the specification asks for - a signed-out person is sent to
 * sign in and returned to the page they asked for, and a signed-in person whose
 * role may not open a page gets a clear 403 with a way back.
 */
function NoAccessPage({ route }) {
  return (
    <div className="wrap section" style={{ paddingTop: 'var(--space-6)' }}>
      <h1>You don't have access to that page</h1>
      <p className="lead">
        Your account may not open <b>{route?.name}</b>. These are the pages your account can use.
      </p>
      <div className="row">
        <a className="btn btn--primary" href="/">Back to Home</a>
      </div>
    </div>
  );
}

/** Sent to sign in, and returned to the page they were on their way to. */
function SignInFirst({ route }) {
  const location = useLocation();
  return <Navigate to="/login" replace state={{ from: location.pathname, wants: route?.name }} />;
}

/**
 * Whether a page needs a session at all.
 *
 * The route table carries the roles a page is for, and a page a visitor may open
 * is public; everything else is behind the session. Reading it from the table
 * means a page cannot be marked protected in one place and public in another.
 */
const needsSession = (route) => {
  if (typeof route.signedIn === 'boolean') return route.signedIn;
  const roles = Array.isArray(route.roles) ? route.roles : [];
  return roles.length > 0 && !roles.includes('visitor');
};

function Guarded({ route, children }) {
  const { status, signedIn, role } = useSession();
  const guarded = needsSession(route);
  if (guarded && status === 'loading') return <div className="wrap section"><LoadingBlock label="Checking your session…" lines={2} /></div>;
  if (guarded && !signedIn) return <SignInFirst route={route} />;
  if (signedIn && Array.isArray(route.roles) && !route.roles.includes(role)) return <NoAccessPage route={route} />;
  return children;
}

function Router() {
  const { hotel, error: hotelError } = useHotel();
  const { status } = useSession();

  return (
    <Routes>
      {ROUTES.map((route) => {
        const page = route.Page ? <route.Page /> : <PendingPage route={route} />;
        const guarded = <Guarded route={route}>{page}</Guarded>;
        const body = route.shell === 'auth' ? <AuthFrame hotel={hotel}>{guarded}</AuthFrame> : guarded;
        return (
          <Route
            key={route.path}
            path={route.path}
            element={(
              <SiteShell shell={route.shell} hotel={hotel}>
                {!hotel && hotelError && route.shell !== 'auth' ? (
                  <div className="wrap" style={{ paddingTop: 'var(--space-5)' }}>
                    <Alert kind="warn" title="We could not load the hotel details">
                      {hotelError} — the page still works, and the details come back as soon as the service answers.
                    </Alert>
                  </div>
                ) : null}
                {body}
              </SiteShell>
            )}
          />
        );
      })}
      <Route path="*" element={<SiteShell shell="public" hotel={hotel}><NotFoundPage /></SiteShell>} />
    </Routes>
  );
}

export function App() {
  // The session is read once per page load, before anything decides what a
  // person may see; nothing about the account is kept in the browser.
  const ready = typeof window !== 'undefined';
  return (
    <SessionProvider>
      <HotelProvider>
        <ToastProvider>
          {ready ? (
            <BrowserRouter>
              <Router />
            </BrowserRouter>
          ) : null}
        </ToastProvider>
      </HotelProvider>
    </SessionProvider>
  );
}
