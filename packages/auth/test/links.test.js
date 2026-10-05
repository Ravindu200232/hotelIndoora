import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { connectTestDb, clearCollections, closeTestDb, request } from 'testing';

/**
 * Every link this service puts in an email must be an address a mail client can
 * open.
 *
 * A relative link — /confirm-email?token=... — is a dead link: the guest's mail
 * client has no idea which host it belongs to. SITE_URL is that host, and these
 * tests hold both halves of it: the link builders, and the routes that must hand
 * them the configured address rather than nothing.
 */
const { sent } = vi.hoisted(() => ({ sent: [] }));

vi.mock('../src/lib/mailer.js', async () => {
  const actual = await vi.importActual('../src/lib/mailer.js');
  return {
    ...actual,
    sendMail: async (message) => { sent.push(message); return { id: 'stub', attempts: 1 }; },
  };
});

const { createApp } = await import('../src/app.js');
const { loadConfig } = await import('../src/config.js');
const { confirmationLink, inviteLink } = await import('../src/lib/tokens.js');
const { GuestAccount } = await import('../src/models/GuestAccount.js');

const SITE = 'https://hotel.example.test';
const config = loadConfig({
  EMAIL_API_KEY: 'test-key',
  MAIL_FROM: 'stay@test.local',
  BOOKINGS_URL: 'http://127.0.0.1:9',
  SITE_URL: `${SITE}/`,
});
const app = createApp(config);

const guest = { full_name: 'Marta Ferreira', email: 'marta.ferreira@example.com', password: 'Harbour-2026' };

beforeAll(() => connectTestDb());
afterAll(() => closeTestDb());
beforeEach(async () => { await clearCollections(); sent.length = 0; });

describe('the address the emails point at', () => {
  it('normalises SITE_URL to one host with no trailing slash', () => {
    expect(config.siteUrl).toBe(SITE);
    expect(loadConfig({}).siteUrl).toBe('');
    expect(loadConfig({ SITE_URL: '   ' }).siteUrl).toBe('');
  });

  it('builds the confirmation link on the site', () => {
    expect(confirmationLink('tok', SITE)).toBe(`${SITE}/confirm-email?token=tok`);
    expect(confirmationLink('a b', SITE)).toBe(`${SITE}/confirm-email?token=a%20b`);
  });

  it('builds the staff invitation on the site', () => {
    expect(inviteLink('tok', SITE)).toBe(`${SITE}/login?invite=tok`);
  });

  it('puts the absolute confirmation link in the registration email', async () => {
    await request(app).post('/v1/auth/register').send(guest).expect(201);
    const stored = await GuestAccount.findOne({ email: guest.email });
    expect(sent).toHaveLength(1);
    expect(sent[0].html).toContain(`${SITE}/confirm-email?token=${stored.email_confirmation_token}`);
  });

  it('puts the absolute invitation link in the staff invitation email', async () => {
    const { StaffAccount } = await import('../src/models/StaffAccount.js');
    const inviter = await StaffAccount.create({ full_name: 'Priya Raman', email: 'priya.raman@hotelindoora.com', status: 'active' });

    const invitation = await request(app).post('/v1/staff/team')
      .set('x-user-id', String(inviter._id)).set('x-user-role', 'hotel_staff').set('x-user-name', 'Priya Raman')
      .send({ full_name: 'Hana Suzuki', email: 'hana.suzuki@example.com' });
    expect(invitation.status, JSON.stringify(invitation.body)).toBe(201);
    expect(invitation.body.mail.status).toBe('sent');

    const invited = await StaffAccount.findOne({ email: 'hana.suzuki@example.com' });
    expect(sent).toHaveLength(1);
    expect(sent[0].html).toContain(`${SITE}/login?invite=${invited.invite_token}`);
  });
});
