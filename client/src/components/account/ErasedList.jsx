import { Panel, PlainList } from '../index.jsx';

/**
 * Exactly what is erased, field by field, with the guest's real values in front
 * of them — named rather than described.
 */
export function ErasedList({ account }) {
  return (
    <Panel as="section" aria-labelledby="erased-title">
      <h3 id="erased-title">What will be erased</h3>
      <PlainList>
        <li><span><b>Full name</b></span><span>{account?.full_name ?? '—'}</span></li>
        <li><span><b>Email address</b></span><span>{account?.email ?? '—'}</span></li>
        <li><span><b>Phone number</b></span><span>{account?.phone_number || 'Not given'}</span></li>
        <li><span><b>Password</b></span><span>Deleted — you can no longer sign in with this account</span></li>
        <li><span><b>Active sign-in sessions</b></span><span>Ended — you are signed out on every device</span></li>
      </PlainList>
    </Panel>
  );
}
