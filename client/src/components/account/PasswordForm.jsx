import { useState } from 'react';
import { Alert, Button, Panel } from '../index.jsx';
import { api } from '../../api.js';

/**
 * Changing the password: the current one is required, the new one has to meet the
 * same rule as at registration, and a wrong current password changes nothing.
 */
export function PasswordForm() {
  const [values, setValues] = useState({ current: '', next: '' });
  const [show, setShow] = useState({ current: false, next: false });
  const [state, setState] = useState({ status: 'idle', errors: {} });

  const set = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setState((current) => ({ status: 'idle', errors: { ...current.errors, [field]: undefined } }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const errors = {};
    if (!values.current) errors.current_password = 'Enter the password you sign in with today.';
    if (values.next.length < 10 || !/[A-Za-z]/.test(values.next) || !/[0-9]/.test(values.next)) {
      errors.new_password = 'Use at least 10 characters, with at least one letter and one digit.';
    }
    if (Object.keys(errors).length) {
      setState({ status: 'refused', errors });
      return;
    }
    setState({ status: 'saving', errors: {} });
    try {
      await api.changePassword(values.current, values.next);
      setValues({ current: '', next: '' });
      setState({ status: 'changed', errors: {} });
    } catch (error) {
      setState({ status: 'refused', errors: error.errors ?? {}, message: error.message });
    }
  };

  return (
    <Panel as="section" aria-labelledby="password-title">
      <div className="section__head">
        <div>
          <h2 id="password-title">Your password</h2>
          <p>At least 10 characters, with at least one letter and one digit.</p>
        </div>
      </div>

      {state.status === 'changed' ? (
        <Alert kind="success" title="Password changed">Use your new password the next time you sign in.</Alert>
      ) : null}

      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          <div className={`field${state.errors.current_password ? ' field--invalid' : ''}`}>
            <label htmlFor="acc-current">Current password</label>
            <div className="password-row">
              <input
                type={show.current ? 'text' : 'password'}
                id="acc-current"
                name="current_password"
                autoComplete="current-password"
                value={values.current}
                aria-invalid={state.errors.current_password ? 'true' : undefined}
                onChange={set('current')}
              />
              <button
                className="toggle"
                type="button"
                aria-label={show.current ? 'Hide password' : 'Show password'}
                onClick={() => setShow((current) => ({ ...current, current: !current.current }))}
              >
                {show.current ? 'Hide' : 'Show'}
              </button>
            </div>
            <span className="field__hint">Type the password you sign in with today.</span>
            {state.errors.current_password ? <span className="field__error">{state.errors.current_password}</span> : null}
          </div>

          <div className={`field${state.errors.new_password ? ' field--invalid' : ''}`}>
            <label htmlFor="acc-new">New password</label>
            <div className="password-row">
              <input
                type={show.next ? 'text' : 'password'}
                id="acc-new"
                name="new_password"
                autoComplete="new-password"
                value={values.next}
                aria-invalid={state.errors.new_password ? 'true' : undefined}
                onChange={set('next')}
              />
              <button
                className="toggle"
                type="button"
                aria-label={show.next ? 'Hide password' : 'Show password'}
                onClick={() => setShow((current) => ({ ...current, next: !current.next }))}
              >
                {show.next ? 'Hide' : 'Show'}
              </button>
            </div>
            <span className="field__hint">At least 10 characters, including at least one letter and one digit.</span>
            {state.errors.new_password ? <span className="field__error">{state.errors.new_password}</span> : null}
          </div>
        </div>

        <Button kind="primary" type="submit" disabled={state.status === 'saving'} aria-busy={state.status === 'saving'}>
          {state.status === 'saving' ? 'Changing…' : 'Change password'}
        </Button>
      </form>

      {state.status === 'refused' ? (
        <Alert kind="error" title="Your password was not changed">
          {Object.keys(state.errors).length
            ? 'The field that needs changing is marked above.'
            : `${state.message} — nothing has changed.`}
        </Alert>
      ) : null}
    </Panel>
  );
}
