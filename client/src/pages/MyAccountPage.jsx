import { Link } from 'react-router-dom';
import { useSession } from '../session.jsx';
import { LoadingBlock } from '../components/index.jsx';
import { DetailsForm, PasswordForm, DeleteAccountPanel } from '../components/account/AccountForms.jsx';

/**
 * My Account: the guest's own name, phone number and password, kept up to date
 * by the guest themselves, with the step that closes the account.
 *
 * The email address is shown but is not theirs to change here: it is what the
 * confirmation state hangs on, and the hotel's sign-in is by address.
 */
export function MyAccountPage() {
  const { account, status } = useSession();

  if (status === 'loading' || !account) {
    return <main id="main"><div className="wrap section"><LoadingBlock label="Loading the name and phone number on your account…" lines={2} /></div></main>;
  }

  return (
    <main id="main">
      <div className="wrap page-head">
        <div className="page-head__grid">
          <div>
            <h1>My Account</h1>
            <p className="lead">Keep the name and phone number the hotel uses to reach you, and your password, up to date.</p>
          </div>
          <Link className="btn btn--ghost btn--sm" to="/my-bookings">My Bookings</Link>
        </div>
      </div>

      <section className="section" style={{ paddingTop: 'var(--space-3)' }}>
        <div className="wrap stack">
          <DetailsForm account={account} />
          <PasswordForm />
          <DeleteAccountPanel />
        </div>
      </section>
    </main>
  );
}
