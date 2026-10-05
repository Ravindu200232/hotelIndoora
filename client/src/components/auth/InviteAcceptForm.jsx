import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Field, Input } from '../index.jsx';
import { PasswordRules } from './SignUpForm.jsx';
import { api } from '../../api.js';
import { useSession } from '../../session.jsx';

/**
 * The invitation, accepted.
 *
 * A colleague added from Team has an account and no password, and the only way
 * in is the link in the invitation email, which lands on the sign-in page with
 * ?invite=<token>. This is what that link finds: the person chooses their own
 * password here — nobody at the hotel, and nobody who made the deployment, ever
 * sets it for them — and the same request signs them in, so they arrive on the
 * dashboard.
 *
 * The link works once and stops working after 72 hours, and both of those are
 * said in the server's own words rather than invented here. The token is taken
 * out of the address as soon as it has been used, so a reload cannot replay it.
 */
export function InviteAcceptForm({ token }) {
  const { refresh } = useSession();
  const navigate = useNavigate();
  const [values, setValues] = useState({ password: '', confirm: '' });
  const [state, setState] = useState({ status: 'idle', errors: {}, message: null, code: null });

  const set = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setState((current) => ({ ...current, status: 'idle', errors: { ...current.errors, [field]: undefined }, message: null, code: null }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const errors = {};
    if (values.password.length < 10 || !/[A-Za-z]/.test(values.password) || !/[0-9]/.test(values.password)) {
      errors.password = 'Use at least 10 characters, with at least one letter and one digit.';
    }
    if (values.confirm !== values.password) {
      errors.confirm = 'Both passwords must be the same.';
    }
    if (Object.keys(errors).length) {
      setState({ status: 'refused', errors, code: 'validation', message: 'Check the form' });
      return;
    }

    setState({ status: 'working', errors: {}, message: null, code: null });
    try {
      await api.setStaffPassword(token, values.password);
      // The server has issued the session for this account, so the fresh
      // identity is read back before the dashboard is opened.
      await refresh();
      setState({ status: 'done', errors: {}, message: null, code: null });
      navigate('/staff', { replace: true });
    } catch (error) {
      setState({
        status: 'refused',
        errors: error.errors ?? {},
        code: error.code ?? 'failed',
        message: error.message,
      });
    }
  };

  return (
    <>
      <h1>Set your password</h1>
      <p className="lead">
        You were invited to the hotel&rsquo;s staff pages. Choose your own password here and you are signed in
        straight away: it is yours alone, and nobody else has ever seen it.
      </p>

      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="invite-password">New password</label>
          <input
            id="invite-password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={set('password')}
            aria-invalid={state.errors.password ? 'true' : undefined}
          />
          {state.errors.password ? <span className="field__error">{state.errors.password}</span> : null}
          <PasswordRules value={values.password} />
        </div>

        <div className="field" style={{ marginTop: 'var(--space-4)' }}>
          <label htmlFor="invite-confirm">Confirm your password</label>
          <input
            id="invite-confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            value={values.confirm}
            onChange={set('confirm')}
            aria-invalid={state.errors.confirm ? 'true' : undefined}
          />
          {state.errors.confirm ? <span className="field__error">{state.errors.confirm}</span> : null}
        </div>

        <p style={{ marginTop: 'var(--space-5)' }}>
          <button className="btn btn--primary btn--block" type="submit" aria-busy={state.status === 'working'}>
            {state.status === 'working' ? 'Setting your password…' : 'Set my password and sign in'}
          </button>
        </p>
      </form>

      {state.code === 'invite_used' || state.code === 'invite_expired' ? (
        <Alert kind="error" title={state.code === 'invite_expired' ? 'That invitation has run out' : 'That invitation has already been used'}>
          {state.message} A colleague who is already signed in can add you again from Team, and a new link is
          emailed to you.
        </Alert>
      ) : null}

      {state.code === 'validation' ? (
        <Alert kind="error" title="Check the form">
          The field that needs changing is marked above, and everything you typed has been kept.
        </Alert>
      ) : null}

      {state.code === 'failed' ? (
        <Alert kind="error" title="We could not set your password">
          {state.message} — nothing has changed on your account. Try again in a moment.
        </Alert>
      ) : null}
    </>
  );
}
