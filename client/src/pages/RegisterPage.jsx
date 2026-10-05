import { Link } from 'react-router-dom';
import { SignUpForm } from '../components/auth/SignUpForm.jsx';

/**
 * Create Account: a full name, an email address and a password, then Confirm
 * Your Email. The account is a guest account — the hotel's staff accounts are
 * made from inside the site by staff, not from here.
 */
export function RegisterPage() {
  return (
    <main id="main">
      <div className="wrap">
        <div className="auth-card">
          <div className="auth-card__body">
            <h1>Create your account</h1>
            <p className="lead">
              One account books your stay straight with the hotel. You confirm your email address next, then booking
              takes a minute.
            </p>

            <div className="panel panel--tint" style={{ marginBottom: 'var(--space-5)' }}>
              <p>
                <b>Your dates and room type are kept</b> while you set up your account, and come back to your booking
                details once your email address is confirmed.
              </p>
              <p className="small muted" style={{ marginBottom: 0 }}>
                One booking covers one room of one room type, and the nightly rate is the final price.
              </p>
            </div>

            <SignUpForm />

            <section className="panel panel--tint" style={{ marginTop: 'var(--space-5)' }}>
              <h4>Your email address must be confirmed first</h4>
              <p className="small muted">
                We email a confirmation link as soon as your account is made. Open it, and your dates and room type come
                back to your booking details.
              </p>
              <div className="row">
                <Link className="btn btn--primary btn--sm" to="/confirm-email">Confirm Your Email</Link>
                <Link className="btn btn--ghost btn--sm" to="/rooms">Rooms</Link>
                <Link className="btn btn--ghost btn--sm" to="/login">Sign In</Link>
              </div>
            </section>

            <p className="small muted">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </div>

          <aside className="auth-card__aside">
            <h3>What your account gives you</h3>
            <ul>
              <li>Book one room of one room type directly with the hotel, paying through PayPal.</li>
              <li>See every stay you have booked, upcoming and past, with its status and total.</li>
              <li>Move a stay to other dates or another room type, with the difference settled through PayPal.</li>
              <li>Cancel whenever you like and be refunded in full.</li>
              <li>Keep your name, phone number and password up to date, and delete the account whenever you choose.</li>
            </ul>
            <p><Link to="/confirm-email">Next: confirm your email address</Link></p>
          </aside>
        </div>
      </div>
    </main>
  );
}
