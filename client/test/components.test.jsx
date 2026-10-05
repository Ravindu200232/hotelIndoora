import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AvailabilityChooser } from '../src/components/staff/AvailabilityChooser.jsx';
import { BookingPager } from '../src/components/staff/BookingPager.jsx';
import { PhotoUploader } from '../src/components/staff/PhotoUploader.jsx';
import { Dialog } from '../src/components/ui/overlays.jsx';
import { RecordActions } from '../src/components/staff/RecordActions.jsx';

/**
 * The components whose content is decided by what is true: which room types can
 * actually be taken, what the pager says about the rows on screen, what a dialog
 * does when it is closed, which action a booking offers, and what a photograph
 * that failed is telling the desk.
 */
const roomType = (overrides = {}) => ({
  id: '1',
  name: 'Garden Double',
  nightly_rate: 180,
  room_count: 6,
  max_guests: 3,
  on_sale: true,
  ...overrides,
});

const freeRow = (overrides = {}) => ({
  room_type_id: '1',
  name: 'Garden Double',
  nightly_rate: 180,
  room_count: 6,
  free_rooms: 4,
  max_guests: 3,
  nights: 3,
  total: 540,
  ...overrides,
});

describe('the room types the desk can put a booking into', () => {
  it('shows a free room type with its rate, rooms left and the total for the stay', () => {
    render(
      <AvailabilityChooser
        allRoomTypes={[roomType()]}
        freeRoomTypes={[freeRow()]}
        selectedId="1"
        onSelect={() => {}}
        nights={3}
        guests={2}
        currentRoomTypeId="1"
      />,
    );

    const option = screen.getByRole('radio', { name: /Garden Double/ });
    expect(option).toBeChecked();
    expect(option).not.toBeDisabled();
    expect(screen.getByText(/€180.00 a night · 4 rooms free · sleeps 3 · the room type on this booking now/)).toBeInTheDocument();
    expect(screen.getByText('€540.00')).toBeInTheDocument();
    expect(screen.getByText('3 nights')).toBeInTheDocument();
  });

  it('refuses a room type with no room free, and says why', async () => {
    const onSelect = vi.fn();
    render(
      <AvailabilityChooser
        allRoomTypes={[roomType(), roomType({ id: '2', name: 'Courtyard Twin', nightly_rate: 140, max_guests: 2 })]}
        freeRoomTypes={[freeRow()]}
        selectedId="1"
        onSelect={onSelect}
        nights={3}
        guests={2}
      />,
    );

    const twin = screen.getByRole('radio', { name: /Courtyard Twin/ });
    expect(twin).toBeDisabled();
    expect(screen.getByText('No room of this type is free for these nights.')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('not free')).toBeInTheDocument();

    await userEvent.click(twin);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('refuses a room type that takes fewer guests than are coming, in those words', () => {
    render(
      <AvailabilityChooser
        allRoomTypes={[roomType({ name: 'Attic Single', max_guests: 1 })]}
        freeRoomTypes={[freeRow({ free_rooms: 2 })]}
        selectedId={null}
        onSelect={() => {}}
        nights={2}
        guests={3}
      />,
    );

    expect(screen.getByRole('radio', { name: /Attic Single/ })).toBeDisabled();
    expect(screen.getByText(/Taken a guest too many — this booking has 3 people staying/)).toBeInTheDocument();
  });

  it('says so plainly when no room type is on sale at all', () => {
    render(
      <AvailabilityChooser allRoomTypes={[]} freeRoomTypes={[]} selectedId={null} onSelect={() => {}} nights={2} guests={2} />,
    );
    expect(screen.getByText('No room type is on sale at the moment, so there is nothing to book.')).toBeInTheDocument();
  });

  it('chooses the room type the desk picks', async () => {
    const onSelect = vi.fn();
    render(
      <AvailabilityChooser
        allRoomTypes={[roomType(), roomType({ id: '2', name: 'Sea View King', nightly_rate: 228.5 })]}
        freeRoomTypes={[freeRow(), freeRow({ room_type_id: '2', name: 'Sea View King', nightly_rate: 228.5, free_rooms: 2, total: 685.5 })]}
        selectedId="1"
        onSelect={onSelect}
        nights={3}
        guests={2}
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: /Sea View King/ }));
    expect(onSelect).toHaveBeenCalledWith('2');
  });
});

describe('the pager under a list of bookings', () => {
  it('says which rows are on screen when the results run over more than one page', async () => {
    const onPage = vi.fn();
    render(<BookingPager pages={2} page={1} onPage={onPage} total={26} perPage={25} filtered={false} />);

    expect(screen.getByText('26 bookings page 25 rows at a time. You are on page 1 of 2.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: '2' }));
    expect(onPage).toHaveBeenCalledWith(2);
  });

  it('says a filtered list fits one page, and that nothing matched when nothing did', () => {
    const { unmount } = render(<BookingPager pages={1} page={1} onPage={() => {}} total={13} perPage={25} filtered />);
    expect(screen.getByText('These 13 bookings fit one page. 25 rows per page.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    unmount();

    render(<BookingPager pages={1} page={1} onPage={() => {}} total={0} perPage={25} filtered />);
    expect(screen.getByText('No booking matches these filters.')).toBeInTheDocument();
  });
});

describe('a dialog', () => {
  // jsdom 25 has no showModal, so the browser's own modal is stood in for here:
  // what is under test is the component asking the element to open and to close,
  // and what the controls inside it do.
  const withModal = () => {
    HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function close() { this.removeAttribute('open'); };
  };

  it('opens itself when it is shown, and closes when it is taken away', () => {
    withModal();
    const { container, rerender } = render(
      <Dialog open onClose={() => {}} title="Remove this block?" footer={<button type="button">Keep the block</button>}>
        <p>4 nights go back on sale.</p>
      </Dialog>,
    );

    expect(container.querySelector('dialog')).toHaveAttribute('open');
    expect(screen.getByText('Remove this block?')).toBeInTheDocument();
    expect(screen.getByText('4 nights go back on sale.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep the block' })).toBeInTheDocument();

    rerender(<Dialog open={false} onClose={() => {}} title="Remove this block?">4 nights go back on sale.</Dialog>);
    expect(container.querySelector('dialog')).not.toHaveAttribute('open');
  });

  it('takes the way out when it is used, and a click on the backdrop as closing it', async () => {
    withModal();
    const onClose = vi.fn();
    const { container } = render(<Dialog open onClose={onClose} title="Cancel this booking?">Are you sure?</Dialog>);

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.click(container.querySelector('dialog'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('what the desk can do with one booking', () => {
  const booking = { id: 'b1', status: 'confirmed', booking_reference: 'HID-5039', guest_email: 'niamh.kelleher@example.com' };
  const renderActions = (props = {}) => render(
    <MemoryRouter>
      <RecordActions
        booking={booking}
        paid={360}
        sending={false}
        sent={false}
        sendError={null}
        onCancelPaid={() => {}}
        onCancelUnpaid={() => {}}
        onSendLink={() => {}}
        {...props}
      />
    </MemoryRouter>,
  );

  it('offers to cancel and refund the whole amount on a paid booking', () => {
    renderActions();
    expect(screen.getByRole('button', { name: 'Cancel and refund €360.00' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit booking' })).toHaveAttribute('href', '/staff/bookings/b1/edit');
    expect(screen.queryByRole('button', { name: 'Send payment link' })).not.toBeInTheDocument();
  });

  it('offers to free the room on a booking nobody has paid for, with the link to pay', () => {
    renderActions({ booking: { ...booking, status: 'pending_payment' }, paid: 0 });
    expect(screen.getByRole('button', { name: 'Cancel unpaid booking' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send payment link' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel and refund/ })).not.toBeInTheDocument();
  });

  it('offers nothing to cancel on a booking that is already cancelled, and says why', () => {
    renderActions({ booking: { ...booking, status: 'cancelled' }, paid: 0 });
    expect(screen.getByText(/nothing left to cancel, refund or move/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument();
  });

  it('confirms a link that went out, and hands back one that could not be emailed', () => {
    const { unmount } = renderActions({ sent: true });
    expect(screen.getByText('The PayPal link is on its way')).toBeInTheDocument();
    unmount();

    renderActions({
      booking: { ...booking, status: 'pending_payment' },
      paid: 0,
      sendError: { message: 'resend is not connected: EMAIL_API_KEY is not set', link: 'https://paypal.test/checkoutnow?token=1' },
    });
    expect(screen.getByText('The payment link could not be emailed')).toBeInTheDocument();
    expect(screen.getByText(/EMAIL_API_KEY is not set/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'open the PayPal link' })).toHaveAttribute('href', 'https://paypal.test/checkoutnow?token=1');
  });
});

describe('the photographs on a room type', () => {
  const item = (overrides = {}) => ({
    key: 'k1',
    name: 'garden-balcony-01.jpg',
    url: 'https://images.example/garden.jpg',
    status: 'added',
    percent: 0,
    error: null,
    ...overrides,
  });

  it('counts what has been added and what is going up just now', () => {
    render(
      <PhotoUploader
        items={[item(), item({ key: 'k2', name: 'balcony-view.jpg', url: null, status: 'uploading', percent: 46 })]}
        showCountInHeading
      />,
    );

    expect(screen.getByRole('heading', { name: 'Photographs — 1 of 10' })).toBeInTheDocument();
    expect(screen.getByText(/1 photograph added, 1 uploading/)).toBeInTheDocument();
    expect(screen.getByText(/balcony-view.jpg · uploading 46%/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Uploading balcony-view.jpg' })).toHaveAttribute('aria-valuenow', '46');
  });

  it('names a photograph that was refused, why, and offers to try it again', async () => {
    const onRetry = vi.fn();
    render(
      <PhotoUploader
        items={[item({ name: 'terrace-west.jpg', url: null, status: 'failed', error: 'The file is larger than 5 MB, so it was not added.' })]}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText('terrace-west.jpg did not upload')).toBeInTheDocument();
    expect(screen.getAllByText(/larger than 5 MB/).length).toBeGreaterThan(0);
    await userEvent.click(screen.getAllByRole('button', { name: 'Try again' })[0]);
    expect(onRetry).toHaveBeenCalled();
  });

  it('hands the chosen files to the page', async () => {
    const onSelect = vi.fn();
    render(<PhotoUploader items={[]} onSelect={onSelect} />);

    expect(screen.getByText(/No photographs yet/)).toBeInTheDocument();
    const file = new File(['x'], 'garden.jpg', { type: 'image/jpeg' });
    await userEvent.upload(screen.getByLabelText('Choose photographs from this device'), file);
    expect(onSelect).toHaveBeenCalledWith([file]);
  });
});
