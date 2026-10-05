import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../src/App.jsx';
import { ROUTES } from '../src/routes.jsx';
import { stubFetch } from './helpers.js';

/**
 * The application's own door: one route table, the shell each page is drawn in,
 * and the two rules that decide who may open what.
 *
 * A signed-out person asking for a protected page is sent to sign in with the
 * page they wanted, and a signed-in person whose role may not open it is told so
 * — rather than a page half-rendering and leaving a refusal from the API on
 * screen as if the page were broken.
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

const staffAccount = { id: '1', role: 'hotel_staff', full_name: 'Priya Raman', email: 'priya.raman@hotelindoora.com' };
const guestAccount = { id: '2', role: 'guest', full_name: 'Marta Ferreira', email: 'marta.ferreira@example.com' };

const stubApp = (account) => stubFetch({
  'GET /api/v1/auth/session': { account },
  'GET /api/v1/hotel-details': { hotel_details: hotel },
  'GET /api/v1/room-types': { room_types: [] },
  'GET /api/v1/availability': { room_types: [], nights: 0 },
  'GET /api/v1/bookings': { upcoming: [], past: [], stats: {} },
  'GET /api/v1/staff/dashboard': { today: '2026-05-12', arrivals: [], departures: [], upcoming: [], waiting_for_payment: [] },
  'GET /api/v1/staff/room-types': { room_types: [] },
  'GET /api/v1/staff/bookings': { bookings: [], total: 0, page: 1, per_page: 25, pages: 1 },
  'GET /api/v1/staff/team': { members: [] },
  'GET /api/v1/staff/hotel-details': { hotel_details: hotel },
});

const openAt = (path) => {
  window.history.pushState({}, '', path);
  return render(<App />);
};

describe('the route table', () => {
  it('carries all thirty approved pages, each one wired to its own page and shell', () => {
    expect(ROUTES).toHaveLength(30);
    for (const route of ROUTES) {
      expect(route.path).toMatch(/^\//);
      expect(route.name).toBeTruthy();
      expect(route.shell).toBeTruthy();
      expect(route.pageModule).toMatch(/^pages\//);
      expect(route.Page, `${route.path} has no page`).toBeTruthy();
      expect(route.roles.length).toBeGreaterThan(0);
    }
  });

  it('keeps the guest pages for guests and the desk pages for hotel staff', () => {
    const byPath = (path) => ROUTES.find((route) => route.path === path);
    for (const path of ['/my-bookings', '/my-bookings/:bookingId', '/account', '/bookings/new']) {
      expect(byPath(path).roles).toEqual(['guest']);
    }
    for (const path of ['/staff', '/staff/bookings', '/staff/team', '/staff/hotel']) {
      expect(byPath(path).roles).toEqual(['hotel_staff']);
    }
    for (const path of ['/', '/rooms', '/login', '/bookings/:reference/paid']) {
      expect(byPath(path).roles).toContain('visitor');
    }
  });
});

describe('who may open what', () => {
  it('renders the public home page for someone who is not signed in', async () => {
    const api = stubApp(null);
    openAt('/');

    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Harbour Lane');
    expect(screen.getAllByRole('link', { name: 'Sign in' }).length).toBeGreaterThan(0);
    expect(api.unhandled).toEqual([]);
  });

  it('sends someone who is not signed in to sign in, remembering the page they asked for', async () => {
    const api = stubApp(null);
    openAt('/staff/bookings');

    await waitFor(() => expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeInTheDocument();
    expect(api.unhandled).toEqual([]);
  });

  it('tells a guest that a desk page is not theirs to open', async () => {
    const api = stubApp(guestAccount);
    openAt('/staff/hotel');

    await waitFor(() => expect(screen.getByRole('heading', { name: "You don't have access to that page" })).toBeInTheDocument());
    expect(within(screen.getByText(/Your account may not open/)).getByText('Hotel Details')).toBeInTheDocument();
    expect(api.unhandled).toEqual([]);
  });

  it('tells hotel staff that a guest\'s own account is not theirs to open', async () => {
    const api = stubApp(staffAccount);
    openAt('/account/delete');

    await waitFor(() => expect(screen.getByRole('heading', { name: "You don't have access to that page" })).toBeInTheDocument());
    expect(within(screen.getByText(/Your account may not open/)).getByText('Delete My Account')).toBeInTheDocument();
    expect(api.unhandled).toEqual([]);
  });
});
