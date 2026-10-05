import { Button, Dialog } from '../index.jsx';
import { formatShortDate } from '../../api.js';

/**
 * The confirmation before a block is taken off, because removing one puts those
 * nights straight back on sale.
 *
 * It says what is about to happen, in the range's own numbers, and that bookings
 * already made for those nights are left exactly as they are — nothing is moved
 * or cancelled by removing a block.
 */
export function RemoveBlockDialog({ block, roomTypeName, removing, failed, removedBy, onClose, onConfirm }) {
  const nights = block?.nights ?? 0;

  return (
    <Dialog
      open={Boolean(block)}
      onClose={onClose}
      title="Remove this block?"
      footer={(
        <>
          <Button kind="ghost" size="sm" type="button" onClick={onClose} disabled={removing}>Keep the block</Button>
          <Button kind="primary" size="sm" type="button" onClick={onConfirm} disabled={removing} aria-busy={removing}>
            {removing ? 'Removing…' : 'Remove block'}
          </Button>
        </>
      )}
    >
      {block ? (
        <>
          <p>
            {formatShortDate(block.first_night).slice(4)} to {formatShortDate(block.last_night).slice(4)} — {nights}{' '}
            {nights === 1 ? 'night goes' : 'nights go'} back on sale for {roomTypeName} as soon as you remove the block.
          </p>
          <p className="small muted">
            Bookings already made for these nights are left exactly as they are. Removed by <b>{removedBy}</b>.
          </p>
          {failed ? (
            <p className="field__error" role="alert">
              {failed} The block is still in place — try again.
            </p>
          ) : null}
        </>
      ) : null}
    </Dialog>
  );
}
