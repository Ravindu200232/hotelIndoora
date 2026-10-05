import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatLongDate } from '../api.js';
import { Alert, Panel, Topbar } from '../components/index.jsx';
import { InviteForm, validateInvite } from '../components/staff/InviteForm.jsx';

/**
 * Add Staff Member: a colleague joins by name and email address.
 *
 * Nothing is set for them — the invitation carries a single-use link that expires
 * after 72 hours and the colleague chooses their own password. The account sits as
 * invited on the Team list until they do, and it has the same full access as every
 * other staff account, with the person who added it recorded against it.
 */
export function AddStaffMemberPage() {
  const [values, setValues] = useState({ full_name: '', email: '' });
  const [errors, setErrors] = useState({});
  const [duplicate, setDuplicate] = useState(false);
  const [state, setState] = useState({ status: 'idle', member: null, mail: null, retrying: false });

  const change = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setDuplicate(false);
    setState((current) => ({ ...current, status: current.status === 'sent' ? 'idle' : current.status }));
  };

  const invite = async () => {
    const problems = validateInvite(values);
    setErrors(problems);
    if (Object.keys(problems).length) {
      setState({ status: 'idle', member: null, mail: null, retrying: false });
      return;
    }

    setState({ status: 'saving', member: null, mail: null, retrying: false });
    try {
      const payload = await api.addStaffMember({
        full_name: values.full_name.trim(),
        email: values.email.trim(),
      });
      setErrors({});
      setDuplicate(false);
      setState({
        status: payload.mail?.status === 'failed' ? 'not_sent' : 'sent',
        member: payload.member,
        mail: payload.mail,
        retrying: false,
      });
    } catch (error) {
      setErrors(error.errors ?? {});
      setDuplicate(error.code === 'email_taken');
      setState({
        status: error.errors ? 'idle' : 'failed',
        member: null,
        mail: null,
        retrying: false,
        message: error.errors ? null : error.message,
      });
    }
  };

  const retry = async () => {
    if (!state.member?.id) {
      await invite();
      return;
    }
    setState((current) => ({ ...current, retrying: true }));
    try {
      const payload = await api.staffResendInvite(state.member.id);
      setState({
        status: payload.mail?.status === 'failed' ? 'not_sent' : 'sent',
        member: payload.member,
        mail: payload.mail,
        retrying: false,
      });
    } catch (error) {
      setState({
        status: 'not_sent',
        member: state.member,
        mail: { status: 'failed', error: error.message },
        retrying: false,
      });
    }
  };

  return (
    <>
      <p><Link className="link-arrow" to="/staff/team" style={{ textDecoration: 'none' }}>← Back to Team</Link></p>

      <Topbar
        title="Add staff member"
        note="A colleague joins with the same full access as everyone: rooms, rates, blocked dates, bookings, team and hotel details."
        actions={<Link className="btn btn--ghost" to="/staff/team">Back to Team</Link>}
      />

      {state.status === 'failed' && state.message ? (
        <Alert kind="error" title="The colleague could not be added">
          {state.message} Nothing was created and no invitation was sent.
        </Alert>
      ) : null}

      <div className="split">
        <InviteForm
          values={values}
          onChange={change}
          errors={errors}
          duplicate={duplicate}
          saving={state.status === 'saving'}
          onSave={invite}
          state={state}
          onRetry={retry}
        />

        <Panel as="aside" accent aria-labelledby="next-title">
          <h3 id="next-title">What happens next</h3>
          <ul>
            <li>We email <b>{values.email.trim() || 'the address you enter'}</b> a link to set their own password.</li>
            <li>The link works once and expires after 72 hours.</li>
            <li>Until they set a password the account sits as invited on the Team list.</li>
            <li>Every staff account has the same full access: rooms, rates, blocked dates, bookings, team and hotel details.</li>
            <li>You are recorded as the person who added the account, with today's date — {formatLongDate()}.</li>
          </ul>
          <p className="small muted">A staff account cannot be deleted or deactivated from inside the site.</p>
          <Link className="btn btn--ghost btn--block" to="/staff/team">Back to Team</Link>
        </Panel>
      </div>
    </>
  );
}
