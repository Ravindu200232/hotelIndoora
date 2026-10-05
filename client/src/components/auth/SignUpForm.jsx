import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Field, Input } from '../index.jsx';
import { useSession } from '../../session.jsx';

/**
 * The password rule, shown before anyone types and checked as they do: at least
 * ten characters, with at least one letter and one digit. Long passphrases are
 * welcome, so the rule never complains about length beyond the minimum.
 */
export function PasswordRules({ value = '' }) {
  const checks = [
    [value.length >= 10, 'At least 10 characters'],
    [/[A-Za-z]/.test(value), 'At least one letter'],
    [/[0-9]/.test(value), 'At least one digit'],
  ];
  const failed = value.length > 0 ? checks.filter(([ok]) => !ok).map(([, label]) => label) : [];
  return (
    <>
      <span className="field__hint">At least 10 characters, with at least one letter and one digit. Long passphrases are welcome.</span>
      {failed.length ? (
        <ul className="plain-list" style={{ marginTop: 'var(--space-2)' }}>
          {checks.map(([ok, label]) => (
            <li key={label}>
              <span>{ok ? '✓' : '•'} {label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/**
 * Create Account: a full name, an email address and a password. The address
 * belongs to one account in the whole hotel, so an address that already has one
 * is refused here with the way to sign in instead — and the account is created
 * only once the fields pass the same rules the server applies.
 *
 * Once it succeeds the guest is signed in and sent to Confirm Your Email, where
 * the confirmation link has to be opened before a booking can be made.
 */
export function SignUpForm() {
  const { register } = useSession();
  const navigate = useNavigate();
  const [values, setValues] = useState({ full_name: '', email: '', password: '' });
  const [state, setState] = useState({ status: 'idle', errors: {}, message: null, code: null });

  const set = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setState((current) => ({ ...current, status: 'idle', errors: { ...current.errors, [field]: undefined }, code: null, message: null }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const errors = {};
    const name = values.full_name.trim();
    if (name.length < 2 || name.length > 120) errors.full_name = 'Enter between 2 and 120 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) {
      errors.email = 'Enter an email address in the correct format, like name@example.com.';
    }
    if (values.password.length < 10 || !/[A-Za-z]/.test(values.password) || !/[0-9]/.test(values.password)) {
      errors.password = 'Use at least 10 characters, with at least one letter and one digit.';
    }
    if (Object.keys(errors).length) {
      setState({ status: 'refused', errors, code: 'validation', message: 'Check the form' });
      return;
    }

    setState({ status: 'working', errors: {}, code: null, message: null });
    try {
      const payload = await register({ full_name: name, email: values.email.trim(), password: values.password });
      // The address must be confirmed before the first booking, so this is
      // where the guest goes next; the mail result travels with them.
      navigate('/confirm-email', { replace: true, state: { email: values.email.trim(), mail: payload?.mail ?? null } });
    } catch (error) {
      const errorsFromServer = error.errors ?? {};
      setState({
        status: 'refused',
        errors: errorsFromServer,
        code: error.code ?? 'failed',
        message: error.message,
      });
    }
  };

  return (
    <>
      <form onSubmit={submit} noValidate>
        <Field
          label="Full name"
          htmlFor="full-name"
          error={state.errors.full_name}
        >
          <Input
            id="full-name"
            name="full_name"
            type="text"
            autoComplete="name"
            value={values.full_name}
            error={state.errors.full_name}
            onChange={set('full_name')}
          />
        </Field>

        <div className="field" style={{ marginTop: 'var(--space-4)' }}>
          <label htmlFor="reg-email">Email address</label>
          <Input
            id="reg-email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            error={state.errors.email}
            onChange={set('email')}
          />
          {state.errors.email ? <span className="field__error">{state.errors.email}</span> : null}
        </div>

        <div className="field" style={{ marginTop: 'var(--space-4)' }}>
          <label htmlFor="reg-password">Password</label>
          <div className="password-row">
            <input
              id="reg-password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={set('password')}
            />
          </div>
          {state.errors.password ? <span className="field__error">{state.errors.password}</span> : null}
          <PasswordRules value={values.password} />
        </div>

        <div className="panel panel--accent" style={{ marginTop: 'var(--space-5)' }}>
          <h4>How we use your details</h4>
          <p>
            Your full name, email address and password hold your account and your bookings, and nothing more. Your
            details are passed to no third party other than PayPal, and only to take a payment or send a refund.
          </p>
        </div>

        {state.code === 'email_taken' ? (
          <Alert kind="error" title="That email address is already registered">
            <Link to="/login">Sign in</Link> with it instead, or create your account with a different email address.
          </Alert>
        ) : null}

        {state.code === 'validation' || state.code === 'failed' ? (
          <Alert kind="error" title={state.code === 'validation' ? 'Check the form' : 'We could not create the account'}>
            {state.code === 'validation'
              ? 'The field that needs changing is marked above, and everything you typed has been kept.'
              : <>{state.message} — nothing has been created. Try again in a moment.</>}
          </Alert>
        ) : null}

        <p style={{ marginTop: 'var(--space-5)' }}>
          <button className="btn btn--primary btn--block" type="submit" aria-busy={state.status === 'working'}>
            {state.status === 'working' ? 'Creating account…' : 'Create account'}
          </button>
        </p>
      </form>

      {state.status === 'working' ? (
        <Alert kind="info" title="Setting up your account…">
          Please wait a moment and keep this page open.
        </Alert>
      ) : null}
    </>
  );
}
