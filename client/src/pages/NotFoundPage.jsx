import { useLocation } from 'react-router-dom';
import { Nav } from '../components/index.jsx';

/**
 * The route's screen arrives with the phase that builds it. Until then the
 * route says so plainly, with the shell, navigation and design system around
 * it, instead of showing a screen that is not the approved one.
 */
export function PendingPage({ route }) {
  return (
    <div className="wrap section" style={{ paddingTop: 'var(--space-6)' }}>
      <p className="breadcrumb">Foundation</p>
      <h1>{route?.name ?? 'This screen'}</h1>
      <p className="lead">
        The data, sign-in, session and shared design system behind this screen are in place. The screen itself is
        drawn in the phase that builds the prototype&rsquo;s pages, and will appear at <code>{route?.path}</code>.
      </p>
      <div className="panel panel--tint">
        <h4>What is ready</h4>
        <ul>
          <li>The seven collections of the specification, with their validation and indexes.</li>
          <li>Guest and staff sign-in, the httpOnly session cookie, roles and the demo accounts.</li>
          <li>PayPal payments and refunds, and emails through the transactional service.</li>
          <li>The shared layout, navigation and components, ported from the approved prototype.</li>
        </ul>
      </div>
    </div>
  );
}

/** A real not-found page: a wrong address still has a way onward. */
export function NotFoundPage() {
  const location = useLocation();
  return (
    <div className="wrap section" style={{ paddingTop: 'var(--space-6)' }}>
      <h1>We cannot find that page</h1>
      <p className="lead">
        Nothing lives at <code>{location.pathname}</code>. The address may have been mistyped, or a link may have
        been cut short.
      </p>
      <div className="row">
        <a className="btn btn--primary" href="/">Back to Home</a>
        <a className="btn btn--ghost" href="/rooms">See the rooms</a>
        <a className="btn btn--quiet" href="/login">Sign in</a>
      </div>
      <Nav.Link to="/rooms" className="link-arrow">Rooms and rates</Nav.Link>
    </div>
  );
}
