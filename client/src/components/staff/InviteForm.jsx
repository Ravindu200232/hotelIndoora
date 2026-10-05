import { Link } from 'react-router-dom';
import { Alert, Button, Field, Input, Panel, ProgressTrack } from '../index.jsx';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** The same rules the service holds a colleague's details to, checked here first. */
export function validateInvite(values = {}) {
  const errors = {};

  const name = String(values.full_name ?? '').trim();
  if (!name) errors.full_name = 'Enter a full name.';
  else if (name.length < 2 || name.length > 120) errors.full_name = 'Enter between 2 and 120 characters.';

  const email = String(values.email ?? '').trim();
  if (!email) errors.email = 'Enter an email address.';
  else if (!EMAIL.test(email)) errors.email = 'Enter an email address in the correct format, like name@example.com.';
  else if (email.length > 254) errors.email = 'That email address is too long.';

  return errors;
}

/**
 * Adding a colleague: their full name and their own email address, and nothing
 * else — nobody sets another person's password here. The invitation goes to that
 * address, works once and expires, and the account sits as invited until the
 * colleague sets their own password.
 */
export function InviteForm({ values, onChange, errors = {}, saving, duplicate, onSave, state, onRetry }) {
  return (
    <Panel as="section" aria-labelledby="colleague-title">
      <h2 id="colleague-title">Colleague's details</h2>

      {Object.keys(errors).length ? (
        <Alert kind="error" title={`${Object.keys(errors).length === 1 ? 'One field needs' : `${Object.keys(errors).length} fields need`} a change`}>
          <ul>
            {Object.entries(errors).map(([field, message]) => (
              <li key={field}><a href={`#${field}`}>{message}</a></li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <div className="form-grid">
          <Field
            label="Full name"
            htmlFor="full_name"
            hint="As the name should read on the Team list."
            error={errors.full_name}
          >
            <Input
              type="text"
              id="full_name"
              name="full_name"
              autoComplete="name"
              value={values.full_name}
              error={errors.full_name}
              onChange={(event) => onChange('full_name', event.target.value)}
            />
          </Field>
          <Field
            label="Email address"
            htmlFor="email"
            hint="The invitation link is sent to this address, so it must be the colleague's own."
            error={errors.email}
          >
            <Input
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              value={values.email}
              error={errors.email}
              onChange={(event) => onChange('email', event.target.value)}
            />
          </Field>
        </div>

        {duplicate ? (
          <Alert kind="error" title="That email address already belongs to a staff or guest account">
            This email address already belongs to a staff or guest account. Enter a different email address — one
            account, one person.
          </Alert>
        ) : null}

        <div className="row" style={{ marginTop: 'var(--space-5)' }}>
          <Button kind="primary" type="submit" disabled={saving} aria-busy={saving}>
            {saving ? 'Sending the invitation…' : 'Save and send invitation'}
          </Button>
          <Link className="btn btn--ghost" to="/staff/team">Cancel</Link>
        </div>
      </form>

      {saving ? (
        <Alert kind="info" title="Creating the account and sending the invitation" style={{ marginTop: 'var(--space-5)' }}>
          Creating the account and sending the invitation to {values.email}…
          <ProgressTrack percent={55} announce label="Sending the invitation" />
        </Alert>
      ) : null}

      {state.status === 'not_sent' ? (
        <Alert kind="error" title="The invitation email was not sent" style={{ marginTop: 'var(--space-5)' }}>
          The account for {state.member?.full_name ?? values.full_name} was created, but the email to{' '}
          {state.member?.email ?? values.email} did not go out: {state.mail?.error ?? 'the mail service refused it.'} The
          colleague still shows as invited on the Team list.
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Button
              kind="ghost"
              size="sm"
              type="button"
              onClick={onRetry}
              disabled={state.retrying}
              aria-busy={state.retrying}
            >
              {state.retrying ? 'Sending…' : 'Send the invitation again'}
            </Button>
            <Link className="btn btn--quiet btn--sm" to="/staff/team">Back to Team</Link>
          </div>
        </Alert>
      ) : null}

      {state.status === 'sent' ? (
        <Alert kind="success" title="Invitation sent" style={{ marginTop: 'var(--space-5)' }}>
          {state.member?.full_name ?? values.full_name} is on the Team list as Invited, and{' '}
          {state.member?.email ?? values.email} has a link to set their own password. They sign in on Sign In and land on
          the staff dashboard with the same full access as everyone else.
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Link
              className="btn btn--primary btn--sm"
              to="/staff/team"
              state={{ added: { name: state.member?.full_name ?? values.full_name } }}
            >
              Back to Team
            </Link>
            <Link className="btn btn--ghost btn--sm" to="/login">See the sign-in page</Link>
          </div>
        </Alert>
      ) : null}
    </Panel>
  );
}
