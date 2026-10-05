import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import { useSession } from '../session.jsx';
import { Alert, Badge, LoadingBlock } from '../components/index.jsx';
import {
  ErasedList, KeptList, DeleteConfirm, DeletedNotice, nextUpcomingBooking,
} from '../components/account/DeleteAccount.jsx';

/**
 * Delete My Account: exactly what is erased and exactly what is kept, then the
 * guest's own password to confirm it.
 *
 * Nothing is erased while a refund is outstanding: any upcoming confirmed stay
 * is cancelled and refunded through PayPal first, and if PayPal has not reported
 * the refund completed the account and its details stay exactly as they are and
 * the guest is told which booking is holding it up.
 */
export function DeleteAccountPage() {
  const { account, status } = useSession();
  const bookings = useAsync(() => api.myBookings(), []);
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'idle', message: null, outstanding: [] });

  const upcoming = nextUpcomingBooking(bookings.data);

  const remove = async (password) => {
    if (!password) {
      setState({ status: 'refused', message: 'Enter your password to delete this account.', outstanding: [] });
      return;
    }
    setState({ status: 'working', message: null, outstanding: [] });
    try {
      await api.deleteAccount(password);
      setState({ status: 'deleted', message: null, outstanding: [] });
    } catch (error) {
      if (error.code === 'refund_unconfirmed') {
        setState({
          status: 'refund_unconfirmed',
          message: error.message,
          outstanding: error.payload?.outstanding ?? [],
        });
        return;
      }
      if (error.code === 'wrong_password' || error.status === 403) {
        setState({ status: 'refused', message: error.message, outstanding: [] });
        return;
      }
      setState({ status: 'refused', message: error.message, outstanding: [] });
    }
  };

  if (status === 'loading' || !account) {
    return <main id="main"><div className="wrap section"><LoadingBlock label="Loading your account…" lines={2} /></div></main>;
  }

  if (state.status === 'deleted') {
    return (
      <main id="main">
        <div className="wrap page-head">
          <h1>Delete My Account</h1>
          <p>Signed in as <b>{account.full_name}</b> · {account.email} <Badge kind="neutral">Guest</Badge></p>
        </div>
        <section className="section" style={{ paddingTop: 'var(--space-3)' }}>
          <div className="wrap">
            <DeletedNotice email={account.email} />
            <p className="small muted" style={{ marginTop: 'var(--space-4)' }}>
              You are signed out everywhere. You can create a new account at any time, and sign in with it.
            </p>
            <div className="row" style={{ marginTop: 'var(--space-3)' }}>
              <button className="btn btn--primary" type="button" onClick={() => navigate('/login', { replace: true })}>Go to Sign In</button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main id="main">
      <div className="wrap page-head">
        <h1>Delete My Account</h1>
        <p>Signed in as <b>{account.full_name}</b> · {account.email} <Badge kind="neutral">Guest</Badge></p>
      </div>

      <section className="section" style={{ paddingTop: 'var(--space-3)' }}>
        <div className="wrap split">
          <div>
            <div className="grid grid--2">
              <ErasedList account={account} />
              <KeptList />
            </div>

            {bookings.failed ? (
              <Alert kind="warn" title="We could not check your upcoming stays" style={{ marginTop: 'var(--space-5)' }}>
                {bookings.error.message} — the deletion still checks with PayPal before anything is erased, and it will
                stop if a refund is outstanding.
              </Alert>
            ) : null}

            <section className="panel" aria-labelledby="delete-states" style={{ marginTop: 'var(--space-5)' }}>
              <h3 id="delete-states">What happens when you confirm</h3>
              <p className="small muted">
                Deleting your account cannot be undone. If you would rather keep it, go back to My Account at any time.
              </p>
              <p className="small muted">
                Past bookings stay for accounting, with your name, phone number, email address and special requests
                removed and the link to your account cleared. Payments stay with their amounts and PayPal transaction IDs.
              </p>
              <p className="small muted" style={{ marginBottom: 0 }}>
                <Link to="/account">Keep my account</Link> · <Link to="/my-bookings">My Bookings</Link>
              </p>
            </section>
          </div>

          <DeleteConfirm onDelete={remove} state={state} upcoming={upcoming} />
        </div>
      </section>
    </main>
  );
}
