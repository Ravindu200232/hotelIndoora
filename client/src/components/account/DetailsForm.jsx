import { useState } from 'react';
import { Alert, Button, Panel, Ref } from '../index.jsx';
import { api } from '../../api.js';
import { useSession } from '../../session.jsx';

/**
 * The guest's own details: their name and the phone number the hotel reaches
 * them on. The email address is shown but not editable — it is what the
 * confirmation state hangs on — and the page says so rather than leaving a field
 * that refuses silently.
 */
export function DetailsForm({ account }) {
  const { refresh } = useSession();
  const [values, setValues] = useState({
    full_name: account?.full_name ?? '',
    phone_number: account?.phone_number ?? '',
  });
  const [state, setState] = useState({ status: 'idle', errors: {} });

  const set = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setState((current) => ({ status: 'idle', errors: { ...current.errors, [field]: undefined } }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const errors = {};
    const name = values.full_name.trim();
    if (name.length < 2 || name.length > 120) errors.full_name = 'Enter between 2 and 120 characters.';
    if (values.phone_number.trim() && !/^[+0-9][0-9\s\-()]{5,29}$/.test(values.phone_number.trim())) {
      errors.phone_number = 'Enter a phone number with digits, spaces, hyphens or a leading plus.';
    }
    if (Object.keys(errors).length) {
      setState({ status: 'refused', errors });
      return;
    }
    setState({ status: 'saving', errors: {} });
    try {
      await api.saveAccount({ full_name: name, phone_number: values.phone_number.trim() });
      await refresh();
      setState({ status: 'saved', errors: {} });
    } catch (error) {
      setState({ status: 'refused', errors: error.errors ?? {}, message: error.message });
    }
  };

  return (
    <Panel as="section" aria-labelledby="details-title">
      <div className="section__head">
        <div>
          <h2 id="details-title">Your details</h2>
          <p>These appear on your bookings and are how the hotel reaches you about a stay.</p>
        </div>
      </div>

      {state.status === 'saved' ? (
        <Alert kind="success" title="Saved">Your name and phone number are up to date.</Alert>
      ) : null}

      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          <div className={`field${state.errors.full_name ? ' field--invalid' : ''}`}>
            <label htmlFor="acc-name">Full name</label>
            <input
              type="text"
              id="acc-name"
              name="full_name"
              autoComplete="name"
              value={values.full_name}
              aria-invalid={state.errors.full_name ? 'true' : undefined}
              onChange={set('full_name')}
            />
            {state.errors.full_name ? <span className="field__error">{state.errors.full_name}</span> : null}
          </div>

          <div className="field">
            <label htmlFor="acc-email">Email address</label>
            <p style={{ margin: 0 }}><Ref>{account?.email}</Ref></p>
            <p className="field__hint">
              This address is {account?.email_confirmed ? 'confirmed' : 'not confirmed yet'}, and it cannot be changed
              here.
            </p>
          </div>

          <div className={`field${state.errors.phone_number ? ' field--invalid' : ''}`}>
            <label htmlFor="acc-phone">Phone number</label>
            <input
              type="tel"
              id="acc-phone"
              name="phone_number"
              autoComplete="tel"
              value={values.phone_number}
              aria-invalid={state.errors.phone_number ? 'true' : undefined}
              onChange={set('phone_number')}
            />
            {state.errors.phone_number ? <span className="field__error">{state.errors.phone_number}</span> : null}
          </div>
        </div>

        <p className="small muted">
          Your name, email address and phone number are held only to run your account and your bookings, and go to no one
          else but PayPal, for a payment or a refund.
        </p>

        <Button kind="primary" type="submit" disabled={state.status === 'saving'} aria-busy={state.status === 'saving'}>
          {state.status === 'saving' ? 'Saving…' : 'Save details'}
        </Button>
      </form>

      {state.status === 'refused' && !Object.keys(state.errors).length ? (
        <Alert kind="error" title="Your details were not saved">
          {state.message} — nothing has changed. Try again in a moment.
        </Alert>
      ) : null}
      {state.status === 'refused' && Object.keys(state.errors).length ? (
        <Alert kind="error" title="Your details were not saved">
          Enter your full name and a phone number with digits, spaces, hyphens or a leading plus, then save again. The
          field that needs changing is marked above.
        </Alert>
      ) : null}
    </Panel>
  );
}
