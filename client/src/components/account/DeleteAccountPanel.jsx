import { Link } from 'react-router-dom';
import { Panel } from '../index.jsx';

/** The way to closing the account, with what it means said before the step. */
export function DeleteAccountPanel() {
  return (
    <Panel as="section" aria-labelledby="delete-title">
      <div className="section__head">
        <div>
          <h2 id="delete-title">Deleting your account</h2>
          <p>You can close your account and take your personal details with you.</p>
        </div>
      </div>
      <div className="split--even">
        <div>
          <p>
            Deleting erases your full name, email address, phone number, password and your sign-in sessions, and signs
            you out for good. Past bookings are kept for accounting with those details removed.
          </p>
          <p className="small muted">
            You are shown exactly what is erased, and what is kept, before anything happens. Any upcoming confirmed stay
            is cancelled and refunded in full first.
          </p>
        </div>
        <div className="panel panel--tint">
          <h4>Close this account</h4>
          <p className="small muted">You will need your password on the next step. Nothing is erased until you confirm there.</p>
          <Link className="btn btn--danger btn--block" to="/account/delete">Delete my account</Link>
        </div>
      </div>
    </Panel>
  );
}
