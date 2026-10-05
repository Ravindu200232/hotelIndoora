import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAsync } from '../hooks/useAsync.jsx';
import { Alert, Button, EmptyState, Panel, SectionHead, Skeleton, Topbar } from '../components/index.jsx';
import { TeamStats } from '../components/staff/TeamStats.jsx';
import { TeamTable } from '../components/staff/TeamTable.jsx';

/**
 * Team: everyone who signs in as hotel staff.
 *
 * Any signed-in staff member can add a colleague, and the colleague sets their own
 * password from the emailed link — until then the account sits as invited. There is
 * exactly one level of access and no account is ever deleted or deactivated, so
 * this page is the record of the hotel's staff as much as it is a list.
 */
export function TeamPage() {
  const location = useLocation();
  const team = useAsync(() => api.team(), []);
  const members = team.data?.members ?? [];
  const added = location.state?.added;

  return (
    <>
      <Topbar
        title="Team"
        note="Everyone who signs in to hotelIndoora as hotel staff."
        actions={(
          <>
            <Link className="btn btn--primary" to="/staff/team/new">Add staff member</Link>
            <Link className="btn btn--ghost" to="/staff">Dashboard</Link>
          </>
        )}
      />

      {added ? (
        <Alert kind="success" title="Colleague added">
          {added.name ?? 'Your colleague'} was added and emailed a link to set their own password. They show below as
          Invited until they set it.
        </Alert>
      ) : null}

      {team.loading ? (
        <Panel style={{ marginTop: 'var(--space-5)' }}>
          <p className="small muted" style={{ margin: 0 }}>Loading staff accounts…</p>
          <Skeleton style={{ display: 'block', width: '80%', marginTop: 'var(--space-3)' }} />
          <Skeleton style={{ display: 'block', width: '65%', marginTop: 'var(--space-3)' }} />
          <Skeleton style={{ display: 'block', width: '50%', marginTop: 'var(--space-3)' }} />
        </Panel>
      ) : null}

      {team.failed ? (
        <Alert kind="error" title="We couldn't load the staff accounts" style={{ marginTop: 'var(--space-5)' }}>
          {team.error.message} — nothing has changed.
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <Button kind="primary" size="sm" type="button" onClick={team.reload}>Try again</Button>
            <Link className="btn btn--ghost btn--sm" to="/staff">Dashboard</Link>
          </div>
        </Alert>
      ) : null}

      {team.ready && members.length === 0 ? (
        <EmptyState
          title="No staff accounts yet"
          action={<Link className="btn btn--primary" to="/staff/team/new">Add staff member</Link>}
        >
          Add a colleague by name and email address, and they set their own password from the link we send them.
        </EmptyState>
      ) : null}

      {team.ready && members.length > 0 ? (
        <>
          <TeamStats members={members} />

          <section className="section" style={{ padding: 'var(--space-6) 0 0' }} aria-labelledby="accounts-title">
            <SectionHead
              title="Staff accounts"
              note="Added by records which staff account invited each colleague."
            />
            <TeamTable members={members} />
          </section>

          <Panel tint style={{ marginTop: 'var(--space-5)' }}>
            <h4>One level of access</h4>
            <p className="small muted">
              Every staff account manages room types, rates, blocked dates, bookings, team and hotel details with the same
              full access. There is no manager or owner level, and no staff account can be deleted or deactivated from
              here.
            </p>
            <div className="row">
              <Link className="btn btn--primary btn--sm" to="/staff/team/new">Add staff member</Link>
              <Link className="btn btn--ghost btn--sm" to="/staff/hotel">Hotel Details</Link>
            </div>
          </Panel>
        </>
      ) : null}
    </>
  );
}
