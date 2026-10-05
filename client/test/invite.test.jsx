import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App.jsx';
import { stubFetch } from './helpers.js';

/**
 * The sign-in page's two jobs beyond signing in.
 *
 * The invitation a colleague is emailed lands on this page with ?invite=<token>,
 * and the step it opens is where that colleague chooses their own password — the
 * only door into the staff pages, and nobody else ever sets it. And what the page
 * carries purely so the product can be walked (the sample accounts that sign in
 * with one press, the panel of guest pages) must go away in a build made for a
 * real hotel, while a plain build keeps them.
 */
const hotel = {
  hotel_name: 'hotelIndoora',
  address: '14 Harbour Lane, Kinsale, Co. Cork, Ireland',
  phone_number: '+353 21 477 0128',
  email_address: 'stay@hotelindoora.com',
  check_in_time: '15:00',
  check_out_time: '11:00',
  house_rules: 'No smoking indoors.',
};

const staffAccount = { id: '9', role: 'hotel_staff', full_name: 'Hana Suzuki', email: 'hana.suzuki@example.com' };

const stubPage = (account = null) => stubFetch({
  'GET /api/v1/auth/session': { account },
  'POST /api/v1/auth/staff/password-setup': { account: staffAccount },
  'GET /api/v1/hotel-details': { hotel_details: hotel },
  'GET /api/v1/staff/dashboard': { today: '2026-05-12', arrivals: [], departures: [], upcoming: [], waiting_for_payment: [] },
  'GET /api/v1/staff/room-types': { room_types: [] },
  'GET /api/v1/staff/team': { members: [] },
});

const openAt = (path) => {
  window.history.pushState({}, '', path);
  return render(<App />);
};

describe('the invitation a colleague is emailed', () => {
  it('opens the step where they set their own password, and signs them in', async () => {
    const api = stubPage(staffAccount);
    openAt('/login?invite=invite-token-123');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Set your password' })).toBeInTheDocument());
    // The sign-in form itself is not what this link is for.
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();

    await userEvent.type(screen.getByLabelText('New password'), 'Harbour-2026');
    await userEvent.type(screen.getByLabelText('Confirm your password'), 'Harbour-2026');
    await userEvent.click(screen.getByRole('button', { name: /Set my password/ }));

    await waitFor(() => expect(api.calls('POST', '/api/v1/auth/staff/password-setup')).toHaveLength(1));
    expect(api.calls('POST', '/api/v1/auth/staff/password-setup')[0].body).toEqual({
      token: 'invite-token-123',
      password: 'Harbour-2026',
    });
    await waitFor(() => expect(window.location.pathname).toBe('/staff'));
    expect(api.unhandled).toEqual([]);
  });

  it('refuses two passwords that differ without asking the server', async () => {
    const api = stubPage(null);
    openAt('/login?invite=invite-token-123');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Set your password' })).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('New password'), 'Harbour-2026');
    await userEvent.type(screen.getByLabelText('Confirm your password'), 'Harbour-2027');
    await userEvent.click(screen.getByRole('button', { name: /Set my password/ }));

    expect(screen.getByText('Both passwords must be the same.')).toBeInTheDocument();
    expect(api.calls('POST', '/api/v1/auth/staff/password-setup')).toHaveLength(0);
  });
});

describe('what the sign-in page shows', () => {
  it('keeps the review affordances in a build that does not ask them away', async () => {
    stubPage(null);
    openAt('/login');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument());
    expect(screen.getByText(/Review accounts/)).toBeInTheDocument();
    expect(screen.getByText(/Review access and the guest pages/)).toBeInTheDocument();
  });

  it('is the hotel\'s own sign-in page when the build asks them away', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SAMPLE_ACCOUNTS', 'off');
    try {
      const api = stubPage(null);
      const { App: ProductionApp } = await import('../src/App.jsx');
      window.history.pushState({}, '', '/login');
      render(<ProductionApp />);

      await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument());
      expect(screen.queryByText(/Review accounts/)).toBeNull();
      expect(screen.queryByText(/Review access and the guest pages/)).toBeNull();
      expect(screen.queryByText(/Continue as Hotel Staff/)).toBeNull();
      // The page the specification describes: the form, the way to Create Account,
      // and nothing to press that signs anyone in for them.
      expect(screen.getByRole('link', { name: 'Create Account' })).toBeInTheDocument();
      expect(api.unhandled).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
