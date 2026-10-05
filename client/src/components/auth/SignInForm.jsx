import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Alert, Field, Input } from '../index.jsx';
import { useSession, homeFor } from '../../session.jsx';

/**
 * One sign-in form for guests and hotel staff, as the specification asks: an
 * email address and a password, one generic message when they do not match
 * (never which one was wrong, and never whether the address has an account), a
 * clear message when the attempt limit is reached, and the way onward when the
 * email address has not been confirmed yet.
 *
 * Where it goes is decided here only for the page they were on their way to;
 * everything else is the role's own home, which the server already decided.
 */
export function SignInForm({ demoEmail }) {
  const { signIn, refresh } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState({ email: demoEmail ?? '', password: '' });
  const [state, setState] = useState({ status: 'idle', message: null, code: null });
  const [showPassword, setShowPassword] = useState(false);

  const set = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setState({ status: 'idle', message: null, code: null });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!values.email || !values.password) {
      setState({ status: 'error', message: 'Enter your email address and password.', code: 'missing' });
      return;
    }
    setState({ status: 'working', message: null, code: null });
    try {
      const account = await signIn(values.email.trim(), values.password);
      setState({ status: 'signed_in', message: null, code: null });
      const wanted = location.state?.from;
      // The page they were on their way to, otherwise their role's own home.
      navigate(wanted && wanted !== '/login' ? wanted : homeFor(account?.role), { replace: true });
    } catch (error) {
      const code = error.code ?? (error.status === 401 ? 'invalid_credentials' : 'failed');
      if (code === 'invalid_credentials' || error.status === 401) {
        setState({ status: 'error', code: 'invalid_credentials', message: 'That email and password don\'t match' });
      } else if (code === 'locked') {
        setState({ status: 'error', code: 'locked', message: error.message });
      } else if (code === 'email_unconfirmed') {
        setState({ status: 'error', code: 'email_unconfirmed', message: error.message });
      } else if (code === 'invite_pending') {
        setState({ status: 'error', code: 'invite_pending', message: error.message });
      } else {
        setState({ status: 'error', code: 'failed', message: error.message });
      }
    }
  };

  return (
    <>
      <form onSubmit={submit} noValidate>
        <Field label="Email address" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="name@example.com"
            value={values.email}
            onChange={set('email')}
          />
        </Field>
        <div className="field" style={{ marginTop: 'var(--space-4)' }}>
          <label htmlFor="password">Password</label>
          <div className="password-row">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={values.password}
              onChange={set('password')}
            />
            <button
              className="toggle"
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        <p style={{ marginTop: 'var(--space-5)' }}>
          <button className="btn btn--primary btn--block" type="submit" aria-busy={state.status === 'working'}>
            {state.status === 'working' ? 'Signing in…' : 'Sign in'}
          </button>
        </p>
        <p className="small muted">
          Taking you back to the page you were on, or to your own home: My Bookings for guests, Dashboard for hotel
          staff.
        </p>
      </form>

      {state.status === 'working' ? (
        <Alert kind="info" title="Signing in…">
          Hold on while we check your email address and password. Sign in can't be pressed again until this finishes.
        </Alert>
      ) : null}

      {state.status === 'error' && state.code === 'invalid_credentials' ? (
        <Alert kind="error" title="That email and password don't match">
          Check both and try again — for your safety we don't say which one was wrong.
        </Alert>
      ) : null}

      {state.status === 'error' && state.code === 'locked' ? (
        <Alert kind="warn" title="Too many attempts. Try again in a few minutes.">
          Sign-in is paused for 15 minutes after five failed tries on the same email address.
        </Alert>
      ) : null}

      {state.status === 'error' && state.code === 'email_unconfirmed' ? (
        <Alert kind="info" title="Your email address isn't confirmed yet">
          We sent a confirmation link when you created your account. Open that link, then sign in here to book.
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Link className="btn btn--quiet btn--sm" to="/confirm-email">Confirm your email</Link>
            <Link className="btn btn--ghost btn--sm" to="/confirm-email">Resend the confirmation email</Link>
          </div>
        </Alert>
      ) : null}

      {state.status === 'error' && state.code === 'invite_pending' ? (
        <Alert kind="warn" title="That account has not set a password yet">
          Open the link in the invitation email to set your own password, then sign in here.
        </Alert>
      ) : null}

      {state.status === 'error' && state.code === 'failed' ? (
        <Alert kind="error" title="We could not sign you in">
          {state.message} — nothing has changed on your account. Try again in a moment.
        </Alert>
      ) : null}

      {state.status === 'signed_in' ? (
        <Alert kind="success" title="Signed in">Opening your own home now.</Alert>
      ) : null}
    </>
  );
}

/**
 * The review accounts, as buttons. The credentials are the seeded ones and are
 * never printed on the page: pressing a button signs in for the person reading
 * it, so the whole product can be walked without typing a password.
 */
const DEMO_ACCOUNTS = [
  {
    role: 'hotel_staff',
    label: 'Continue as Hotel Staff',
    hint: 'Opens the Staff Dashboard: rooms, rates, blocked dates, every booking, team and hotel details.',
    email: 'hotel.staff@example.com',
    password: 'Demo!2026',
  },
  {
    role: 'guest',
    label: 'Continue as Guest',
    hint: 'Opens My Bookings for a guest who already has stays with the hotel.',
    email: 'marta.ferreira@example.com',
    password: 'Demo!2026',
  },
];

export function DemoAccountsPanel({ onSignIn, working }) {
  return (
    <div className="demo-login">
      <span className="demo-login__title">Review accounts — one press, no password to type</span>
      {DEMO_ACCOUNTS.map((account) => (
        <button
          key={account.role}
          className="demo-login__btn"
          type="button"
          disabled={working}
          onClick={() => onSignIn(account)}
        >
          <span>
            <span className="demo-login__role">{account.label}</span>
            <span className="demo-login__hint">{account.hint}</span>
          </span>
          <span aria-hidden="true">→</span>
        </button>
      ))}
      <p className="small muted" style={{ marginBottom: 0 }}>
        These accounts are fictitious and exist so the whole product can be reviewed. In the real hotel they are replaced
        by the hotel's own accounts, and the desk adds colleagues from Team.
      </p>
    </div>
  );
}
