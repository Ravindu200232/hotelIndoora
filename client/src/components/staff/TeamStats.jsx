import { Stat, Stats } from '../index.jsx';

/**
 * The desk's team in four figures: how many accounts there are, how many are
 * active, how many have been invited and not set a password yet, and how many
 * levels of access the product has — one.
 */
export function TeamStats({ members = [] }) {
  const invited = members.filter((member) => member.status === 'invited').length;
  const active = members.filter((member) => member.status === 'active').length;

  return (
    <Stats>
      <Stat label="Staff accounts" value={members.length} />
      <Stat
        label="Active"
        value={active}
        foot={invited
          ? `${invited} still to set a password`
          : 'everyone has set a password'}
      />
      <Stat
        accent
        label="Invited, password not set"
        value={invited}
        foot={invited ? 'invitation expires after 72 hours' : 'nothing waiting on a colleague'}
      />
      <Stat label="Levels of access" value={1} foot="every account the same" />
    </Stats>
  );
}
