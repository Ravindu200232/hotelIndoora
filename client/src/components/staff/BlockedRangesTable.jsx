import { Button, Caption, RowActions, Table, TableWrap, Tbody, Td, Thead, Tr } from '../index.jsx';
import { formatShortDate, formatTime } from '../../api.js';

const dayOf = (value) => String(value).slice(0, 10);
const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Every range of nights this room type's rooms are out of service, with the
 * reason the desk wrote, who blocked it and when, and a way to take it off again.
 *
 * The list is the hotel's own record: a block already finished stays on it, so
 * the desk can see what happened to the room type, and each row can be removed.
 */
export function BlockedRangesTable({ blocks = [], roomTypeName, onRemove }) {
  return (
    <TableWrap>
      <Table className="blocks-table">
        <Caption hidden>
          Every range of nights the {roomTypeName} rooms are out of service.
        </Caption>
        <Thead columns={[
          'First night out of service',
          'Last night out of service',
          'Nights',
          'Reason',
          'Blocked by',
          'Blocked on',
          'Actions',
        ]} />
        <Tbody>
          {blocks.map((block) => {
            const ahead = dayOf(block.last_night) >= todayIso();
            return (
              <Tr key={block.id}>
                <Td label="First night out of service">{formatShortDate(block.first_night).slice(4)}</Td>
                <Td label="Last night out of service">{formatShortDate(block.last_night).slice(4)}</Td>
                <Td label="Nights">{block.nights}</Td>
                <Td label="Reason">{block.reason}</Td>
                <Td label="Blocked by">{block.blocked_by ?? 'The desk'}</Td>
                <Td label="Blocked on">
                  {formatShortDate(block.blocked_at).slice(4)}, {formatTime(block.blocked_at)}
                </Td>
                <Td label="Actions">
                  <RowActions>
                    <Button kind="ghost" size="sm" type="button" onClick={() => onRemove(block)}>
                      {ahead ? 'Remove block' : 'Remove this past block'}
                    </Button>
                  </RowActions>
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </TableWrap>
  );
}
