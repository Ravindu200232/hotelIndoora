import { Badge, Caption, Panel, Table, TableWrap, Tbody, Td, Thead, Tr } from '../index.jsx';
import { formatShortDate, formatTime, money } from '../../api.js';

const STATUS = {
  completed: { kind: 'confirmed', label: 'Completed' },
  pending: { kind: 'pending', label: 'Pending' },
  failed: { kind: 'cancelled', label: 'Failed' },
};

/**
 * Every charge and refund against the booking, with the PayPal transaction each
 * one carries - the hotel's own record of the money, and the only place card or
 * bank details would ever be, which they are not.
 */
export function PaymentLinesTable({ payments = [] }) {
  const paid = payments
    .filter((payment) => payment.status === 'completed')
    .reduce((sum, payment) => sum + (payment.type === 'refund' ? -Number(payment.amount) : Number(payment.amount)), 0);

  return (
    <Panel as="section" aria-labelledby="payments-title" style={{ marginTop: 'var(--space-5)' }}>
      <h2 id="payments-title">Payments and refunds</h2>
      {payments.length === 0 ? (
        <p className="small muted">
          Nothing has been paid on this booking yet. A booking waiting for payment holds its room until the guest pays,
          and nothing is held on the site but what PayPal tells us.
        </p>
      ) : (
        <>
          <TableWrap>
            <Table receipt>
              <Caption hidden>Every charge and refund against this booking</Caption>
              <Thead columns={['Type', 'Amount', 'PayPal transaction ID', 'Status', 'Date and time']} />
              <Tbody>
                {payments.map((payment) => {
                  const shape = STATUS[payment.status] ?? { kind: 'neutral', label: payment.status };
                  return (
                    <Tr key={payment.id}>
                      <Td label="Type">{payment.type === 'refund' ? 'Refund' : 'Charge'}</Td>
                      <Td label="Amount">{money(payment.amount)}</Td>
                      <Td label="PayPal transaction ID">{payment.paypal_transaction_id ?? 'Not issued yet'}</Td>
                      <Td label="Status"><Badge kind={shape.kind}>{shape.label}</Badge></Td>
                      <Td label="Date and time">
                        {formatShortDate(payment.created_at).slice(4)}, {formatTime(payment.created_at)}
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </TableWrap>
          <p className="small muted">
            {paid === 0
              ? 'Every charge has been refunded, so nothing of this booking is held by the hotel.'
              : `${money(paid)} stands against this booking. Nothing was added at checkout, and no card or bank details are held on the site.`}
          </p>
        </>
      )}
    </Panel>
  );
}
