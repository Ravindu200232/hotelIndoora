import { Badge, Caption, Table, TableWrap, Tbody, Td, Thead, Tr } from '../index.jsx';
import { formatDate } from '../../api.js';

/**
 * Every staff account the hotel has, with the two things that matter about it: the
 * state of the account, and who added the colleague.
 *
 * An invited account has been added but its owner has not set a password from the
 * emailed link yet; once they have, the account is active. Accounts are kept for
 * good — there is no way to remove or deactivate one, which is why the list shows
 * every account ever added.
 */
export function TeamTable({ members = [] }) {
  return (
    <TableWrap>
      <Table>
        <Caption hidden>Every staff account, with its status and who added it</Caption>
        <Thead columns={['Full name', 'Email address', 'Account status', 'Added by', 'Date added']} />
        <Tbody>
          {members.map((member) => (
            <Tr key={member.id}>
              <Td label="Full name">{member.full_name}</Td>
              <Td label="Email address">{member.email}</Td>
              <Td label="Account status">
                <Badge kind={member.status === 'active' ? 'confirmed' : 'pending'}>
                  {member.status === 'active' ? 'Active' : 'Invited'}
                </Badge>
              </Td>
              <Td label="Added by">{member.added_by ?? '—'}</Td>
              <Td label="Date added">{formatDate(member.added_at).slice(4)}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableWrap>
  );
}
