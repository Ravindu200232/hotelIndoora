import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { stubFetch } from './helpers.js';
import { DetailsForm } from '../src/components/account/DetailsForm.jsx';
import { PasswordForm } from '../src/components/account/PasswordForm.jsx';
import { InviteForm } from '../src/components/staff/InviteForm.jsx';

/**
 * The forms that carry real logic: what a refused field leaves behind, what a save
 * shows, and the state a refused invitation or a password change lands the person in.
 *
 * Every one of them is driven through its own controls, and the calls it makes are
 * asserted against the stubs, so a form that saves the wrong shape or claims a
 * success it did not get shows up here.
 */
const account = {
  full_name: 'Marta Ferreira',
  email: 'marta.ferreira@example.com',
  phone_number: '+351 912 447 220',
  email_confirmed: true,
};

describe('the guest\'s own details', () => {
  it('saves the name and phone number, and says they are up to date', async () => {
    const api = stubFetch({ 'PATCH /api/v1/account': { account: { ...account, full_name: 'Marta Silva' } } });
    render(<DetailsForm account={account} />);

    await userEvent.clear(screen.getByLabelText('Full name'));
    await userEvent.type(screen.getByLabelText('Full name'), 'Marta Silva');
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }));

    await waitFor(() => expect(screen.getByText('Your name and phone number are up to date.')).toBeInTheDocument());
    expect(api.calls('PATCH', '/api/v1/account')[0].body).toEqual({
      full_name: 'Marta Silva',
      phone_number: '+351 912 447 220',
    });
    expect(api.unhandled).toEqual([]);
  });

  it('refuses a phone number that is not one, marks the field and saves nothing', async () => {
    const api = stubFetch({});
    render(<DetailsForm account={account} />);

    await userEvent.clear(screen.getByLabelText('Phone number'));
    await userEvent.type(screen.getByLabelText('Phone number'), 'ring the desk');
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }));

    expect(screen.getByText('Enter a phone number with digits, spaces, hyphens or a leading plus.')).toBeInTheDocument();
    expect(screen.getByText('Your details were not saved')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone number')).toHaveAttribute('aria-invalid', 'true');
    expect(api.calls('PATCH', '/api/v1/account')).toHaveLength(0);
  });

  it('shows the email address as read only, and says it cannot be changed here', () => {
    stubFetch({});
    render(<DetailsForm account={account} />);
    expect(screen.getByText('marta.ferreira@example.com')).toBeInTheDocument();
    expect(screen.getByText(/it cannot be changed here/)).toBeInTheDocument();
  });
});

describe('changing a password', () => {
  it('refuses a new password that does not meet the rule, and changes nothing', async () => {
    const api = stubFetch({});
    render(<PasswordForm />);

    await userEvent.type(screen.getByLabelText('Current password'), 'Indoora-2026');
    await userEvent.type(screen.getByLabelText('New password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(screen.getByText('Use at least 10 characters, with at least one letter and one digit.')).toBeInTheDocument();
    expect(screen.getByText('Your password was not changed')).toBeInTheDocument();
    expect(api.calls('POST', '/api/v1/account/password')).toHaveLength(0);
  });

  it('carries the service\'s refusal of a wrong current password onto the field', async () => {
    stubFetch({
      'POST /api/v1/account/password': {
        status: 403,
        body: { error: 'Your password was not changed', code: 'wrong_password', errors: { current_password: 'Check your current password and type it again.' } },
      },
    });
    render(<PasswordForm />);

    await userEvent.type(screen.getByLabelText('Current password'), 'not-it');
    await userEvent.type(screen.getByLabelText('New password'), 'Harbour-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    await waitFor(() => expect(screen.getByText('Check your current password and type it again.')).toBeInTheDocument());
    expect(screen.getByText('Your password was not changed')).toBeInTheDocument();
    expect(screen.queryByText('Password changed')).not.toBeInTheDocument();
  });

  it('changes it, says so, and empties both fields', async () => {
    const api = stubFetch({ 'POST /api/v1/account/password': { changed: true } });
    render(<PasswordForm />);

    await userEvent.type(screen.getByLabelText('Current password'), 'Indoora-2026');
    await userEvent.type(screen.getByLabelText('New password'), 'Harbour-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    await waitFor(() => expect(screen.getByText('Use your new password the next time you sign in.')).toBeInTheDocument());
    expect(screen.getByLabelText('Current password')).toHaveValue('');
    expect(screen.getByLabelText('New password')).toHaveValue('');
    expect(api.calls('POST', '/api/v1/account/password')[0].body).toEqual({
      current_password: 'Indoora-2026',
      new_password: 'Harbour-2026',
    });
  });
});

describe('adding a colleague', () => {
  const renderForm = (props = {}) => render(
    <MemoryRouter>
      <InviteForm
        values={{ full_name: 'Hana Suzuki', email: 'hana.suzuki@hotelindoora.com' }}
        onChange={() => {}}
        errors={{}}
        onSave={() => {}}
        state={{ status: 'idle' }}
        {...props}
      />
    </MemoryRouter>,
  );

  it('shows the address that already belongs to an account, and offers the way back', () => {
    renderForm({ duplicate: true });
    expect(screen.getByText('That email address already belongs to a staff or guest account')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/staff/team');
  });

  it('says the invitation email did not go out, names the reason, and offers to send it again', () => {
    renderForm({
      state: {
        status: 'not_sent',
        member: { id: '1', full_name: 'Hana Suzuki', email: 'hana.suzuki@hotelindoora.com' },
        mail: { status: 'failed', error: 'resend is not connected: EMAIL_API_KEY is not set' },
      },
      onRetry: () => {},
    });

    expect(screen.getByText('The invitation email was not sent')).toBeInTheDocument();
    expect(screen.getByText(/EMAIL_API_KEY is not set/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send the invitation again' })).toBeInTheDocument();
    expect(screen.getByText(/still shows as invited on the Team list/)).toBeInTheDocument();
  });

  it('confirms the invitation and takes the Team list with it', () => {
    renderForm({
      state: {
        status: 'sent',
        member: { id: '1', full_name: 'Hana Suzuki', email: 'hana.suzuki@hotelindoora.com' },
        mail: { status: 'sent' },
      },
    });

    expect(screen.getByText('Invitation sent')).toBeInTheDocument();
    expect(screen.getByText(/is on the Team list as Invited/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Team' })).toHaveAttribute('href', '/staff/team');
    expect(screen.getByRole('link', { name: 'See the sign-in page' })).toHaveAttribute('href', '/login');
  });
});
