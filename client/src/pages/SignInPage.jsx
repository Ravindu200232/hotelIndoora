import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert } from '../components/index.jsx';
import { SignInForm, DemoAccountsPanel } from '../components/auth/SignInForm.jsx';
import { InviteAcceptForm } from '../components/auth/InviteAcceptForm.jsx';
import { showSampleAccounts } from '../sampleAccounts.js';
import { useSession } from '../session.jsx';

/**
 * Sign In: one page for guests and hotel staff. The invitation a colleague is
 * emailed also lands here, with ?invite=<token>, and opens the step where that
 * colleague sets a password of their own.
 *
 * Everything that is here only so the product can be reviewed — the two sample
 * accounts that sign in with one press, and the panel listing every guest page —
 * is shown only when the build asks for it, so the hotel's own live sign-in page
 * is the form, the way to Create Account and the messages.
 */
export function SignInPage() {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [demo, setDemo] = useState({ working: false, error: null });

  const inviteToken = params.get('invite');

  const signInAs = async (account) => {
    setDemo({ working: true, error: null });
    try {
      await signIn(account.email, account.password);
      const wanted = location.state?.from;
      navigate(wanted && wanted !== '/login' ? wanted : (account.role === 'hotel_staff' ? '/staff' : '/my-bookings'), { replace: true });
    } catch (error) {
      setDemo({ working: false, error: `${error.message}. The review account may not have been seeded yet — run the seed, or sign in with an account you created.` });
    }
  };

  return (
    <main id="main">
      <div className="wrap">
        <div className="auth-card">
          <div className="auth-card__body">
            {inviteToken ? <InviteAcceptForm token={inviteToken} /> : (
              <>
                <h1>Sign in</h1>
                <p className="lead">
                  Book a room directly with hotelIndoora and keep every stay in one place. Guests and hotel staff sign in
                  right here with the same email address and password.
                </p>

                <SignInForm demoEmail={showSampleAccounts ? 'hotel.staff@example.com' : undefined} />

                {demo.error ? (
                  <Alert kind="error" title="We could not sign you in">{demo.error}</Alert>
                ) : null}

                {showSampleAccounts ? (
                  <div className="demo-login-host">
                    <DemoAccountsPanel onSignIn={signInAs} working={demo.working} />
                  </div>
                ) : null}

                {showSampleAccounts ? (
                  <section className="panel panel--tint" style={{ marginTop: 'var(--space-5)' }}>
                    <h4>Review access and the guest pages</h4>
                    <p className="small muted">
                      Sign in as hotel staff to open the desk's pages, or as a guest to open a booking and the guest's own
                      account. Every screen of the guest side is also reachable from here.
                    </p>
                    <div className="row">
                      <Link className="btn btn--ghost btn--sm" to="/rooms">Rooms</Link>
                      <Link className="btn btn--ghost btn--sm" to="/bookings/new">Booking Details</Link>
                      <Link className="btn btn--ghost btn--sm" to="/bookings/new/payment">Payment</Link>
                      <Link className="btn btn--ghost btn--sm" to="/bookings/HID-0000/confirmed">Booking Confirmed</Link>
                      <Link className="btn btn--ghost btn--sm" to="/my-bookings">My Bookings</Link>
                      <Link className="btn btn--ghost btn--sm" to="/account">My Account</Link>
                      <Link className="btn btn--ghost btn--sm" to="/account/delete">Delete My Account</Link>
                    </div>
                  </section>
                ) : null}

                <p className="small muted" style={{ marginTop: 'var(--space-4)' }}>
                  No account yet? <Link to="/register">Create Account</Link>
                </p>
              </>
            )}
          </div>

          <aside className="auth-card__aside">
            <h3>One sign-in, both sides of the house</h3>
            <p>
              Every stay you book here is held on your own account, with its dates, room type, status and every payment
              and refund. Hotel staff sign in on this same page and land on their own dashboard.
            </p>
            <ul>
              <li>Book one room of one room type for your dates and pay the full amount through PayPal.</li>
              <li>Change the dates or the room type yourself, with any difference charged or refunded through PayPal.</li>
              <li>Cancel whenever you like — the whole amount comes back, arrival day included.</li>
              <li>Delete your own account and personal details whenever you choose.</li>
            </ul>
            <p><Link to="/rooms">See what is free for your dates</Link></p>
          </aside>
        </div>
      </div>
    </main>
  );
}
