import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { connectTestDb, clearCollections, closeTestDb, request } from 'testing';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { GuestAccount } from '../src/models/GuestAccount.js';
import { StaffAccount } from '../src/models/StaffAccount.js';

// No mail key on purpose: the account must still be created, and the missing
// provider must be reported rather than swallowed.
const config = loadConfig({ EMAIL_API_KEY: '', MAIL_FROM: 'stay@test.local', BOOKINGS_URL: 'http://127.0.0.1:9' });
const app = createApp(config);

const guest = { full_name: 'Marta Ferreira', email: 'marta.ferreira@example.com', password: 'Harbour-2026' };

beforeAll(() => connectTestDb());
afterAll(() => closeTestDb());
beforeEach(() => clearCollections());

const asUser = (req, { id, role = 'guest', email = 'x@example.com' }) => req
  .set('x-user-id', id).set('x-user-role', role).set('x-user-email', email);

describe('registration and email confirmation', () => {
  it('creates a guest account and reports the missing mail provider', async () => {
    const response = await request(app).post('/v1/auth/register').send(guest).expect(201);
    expect(response.body.account).toMatchObject({ full_name: 'Marta Ferreira', email: guest.email, email_confirmed: false });
    expect(response.body.mail.status).toBe('failed');
    expect(String(response.body.mail.error)).toContain('EMAIL_API_KEY');
  });

  it('refuses a weak password with the specification rule', async () => {
    const response = await request(app).post('/v1/auth/register')
      .send({ ...guest, password: 'short1' }).expect(400);
    expect(response.body.errors.password).toContain('at least 10 characters');
  });

  it('refuses an address that already has a guest account', async () => {
    await request(app).post('/v1/auth/register').send(guest).expect(201);
    const again = await request(app).post('/v1/auth/register').send(guest).expect(409);
    expect(again.body.code).toBe('email_taken');
  });

  it('refuses an address that already belongs to a staff account', async () => {
    await StaffAccount.create({ full_name: 'Demo Hotel Staff', email: guest.email, status: 'active' });
    await request(app).post('/v1/auth/register').send(guest).expect(409);
  });

  it('confirms the address from the emailed token, once', async () => {
    await request(app).post('/v1/auth/register').send(guest).expect(201);
    const stored = await GuestAccount.findOne({ email: guest.email });
    const token = stored.email_confirmation_token;
    const confirmed = await request(app).post('/v1/auth/confirm-email').send({ token }).expect(200);
    expect(confirmed.body.account.email_confirmed).toBe(true);
    await request(app).post('/v1/auth/confirm-email').send({ token }).expect(404);
  });

  it('refuses a confirmation link that has run out', async () => {
    await request(app).post('/v1/auth/register').send(guest).expect(201);
    await GuestAccount.updateOne({ email: guest.email }, { email_confirmation_expires_at: new Date(Date.now() - 1000) });
    const stored = await GuestAccount.findOne({ email: guest.email });
    await request(app).post('/v1/auth/confirm-email').send({ token: stored.email_confirmation_token }).expect(410);
  });
});

describe('sign in', () => {
  it('refuses a wrong password with one generic message', async () => {
    await request(app).post('/v1/auth/register').send(guest).expect(201);
    await GuestAccount.updateOne({ email: guest.email }, { email_confirmed: true });
    const response = await request(app).post('/v1/auth/login')
      .send({ email: guest.email, password: 'WrongPassword1' }).expect(401);
    expect(response.body.error).toBe('That email and password do not match');
  });

  it('refuses an unknown address the same way', async () => {
    const response = await request(app).post('/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'Whatever12345' }).expect(401);
    expect(response.body.code).toBe('invalid_credentials');
  });

  it('sends an unconfirmed guest to Confirm Your Email', async () => {
    await request(app).post('/v1/auth/register').send(guest).expect(201);
    const response = await request(app).post('/v1/auth/login')
      .send({ email: guest.email, password: guest.password }).expect(403);
    expect(response.body.code).toBe('email_unconfirmed');
  });

  it('signs a confirmed guest in and locks the account after five failures', async () => {
    await request(app).post('/v1/auth/register').send(guest).expect(201);
    await GuestAccount.updateOne({ email: guest.email }, { email_confirmed: true });
    const ok = await request(app).post('/v1/auth/login')
      .send({ email: guest.email, password: guest.password }).expect(200);
    expect(ok.body.account.email).toBe(guest.email);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app).post('/v1/auth/login').send({ email: guest.email, password: 'WrongPassword1' });
    }
    const locked = await request(app).post('/v1/auth/login')
      .send({ email: guest.email, password: guest.password }).expect(429);
    expect(locked.body.code).toBe('locked');
  });

  it('refuses a staff account whose password has not been set', async () => {
    await StaffAccount.create({ full_name: 'New Colleague', email: 'new@example.com', status: 'invited' });
    const response = await request(app).post('/v1/auth/login')
      .send({ email: 'new@example.com', password: 'Anything12345' }).expect(403);
    expect(response.body.code).toBe('invite_pending');
  });
});

describe('resending the confirmation email', () => {
  it('stops at five in a rolling hour and says when to try again', async () => {
    await request(app).post('/v1/auth/register').send(guest).expect(201);
    // Five are counted, and each answers with the mail service's own failure
    // because no email provider is configured for this suite.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app).post('/v1/auth/resend-confirmation').send({ email: guest.email }).expect(502);
    }
    const capped = await request(app).post('/v1/auth/resend-confirmation').send({ email: guest.email }).expect(429);
    expect(capped.body.code).toBe('resend_limit');
    expect(capped.body.retryAt).toBeTruthy();
  });

  it('answers the same way for an address that has no account', async () => {
    const response = await request(app).post('/v1/auth/resend-confirmation')
      .send({ email: 'nobody@example.com' }).expect(200);
    expect(response.body.sent).toBe(true);
  });
});

describe('staff team', () => {
  it('needs a staff caller', async () => {
    await request(app).get('/v1/staff/team').expect(401);
    await asUser(request(app).get('/v1/staff/team'), { id: '507f1f77bcf86cd799439011', role: 'guest' }).expect(403);
  });

  it('adds a colleague as invited and refuses a duplicate address', async () => {
    const id = '507f1f77bcf86cd799439011';
    const created = await asUser(
      request(app).post('/v1/staff/team'), { id, role: 'hotel_staff', email: 'desk@example.com' },
    ).send({ full_name: 'Hana Suzuki', email: 'hana.suzuki@hotelindoora.com' }).expect(201);
    expect(created.body.member.status).toBe('invited');
    expect(created.body.mail.status).toBe('failed');

    await asUser(
      request(app).post('/v1/staff/team'), { id, role: 'hotel_staff' },
    ).send({ full_name: 'Hana Again', email: 'hana.suzuki@hotelindoora.com' }).expect(409);

    const list = await asUser(request(app).get('/v1/staff/team'), { id, role: 'hotel_staff' }).expect(200);
    expect(list.body.members).toHaveLength(1);
  });
});

describe('the guest account', () => {
  const createConfirmedGuest = async () => {
    await request(app).post('/v1/auth/register').send(guest).expect(201);
    await GuestAccount.updateOne({ email: guest.email }, { email_confirmed: true });
    return GuestAccount.findOne({ email: guest.email });
  };

  it('saves a new name and phone number and refuses a bad phone number', async () => {
    const stored = await createConfirmedGuest();
    const saved = await asUser(request(app).patch('/v1/account'), { id: String(stored._id) })
      .send({ full_name: 'Marta F. Ferreira', phone_number: '+351 912 447 220' }).expect(200);
    expect(saved.body.account.phone_number).toBe('+351 912 447 220');
    await asUser(request(app).patch('/v1/account'), { id: String(stored._id) })
      .send({ full_name: 'Marta F. Ferreira', phone_number: 'nonsense' }).expect(400);
  });

  it('changes the password only with the current one', async () => {
    const stored = await createConfirmedGuest();
    const id = String(stored._id);
    await asUser(request(app).post('/v1/account/password'), { id })
      .send({ current_password: 'wrong-one-1', new_password: 'Harbour-2027' }).expect(403);
    await asUser(request(app).post('/v1/account/password'), { id })
      .send({ current_password: guest.password, new_password: 'Harbour-2027' }).expect(200);
  });

  it('never changes the email address', async () => {
    const stored = await createConfirmedGuest();
    await asUser(request(app).patch('/v1/account'), { id: String(stored._id) })
      .send({ email: 'someone.else@example.com' }).expect(400);
  });

  it('refuses to delete with a wrong password, erasing nothing', async () => {
    const stored = await createConfirmedGuest();
    await asUser(request(app).delete('/v1/account'), { id: String(stored._id) })
      .send({ password: 'not-the-password-1' }).expect(403);
    expect(await GuestAccount.countDocuments()).toBe(1);
  });

  it('erases nothing while a refund is unconfirmed, and names the booking', async () => {
    const stored = await createConfirmedGuest();
    const original = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({
      refundsConfirmed: false,
      outstanding: [{ reference: 'HID-7763', amount: 780 }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
    try {
      const response = await asUser(request(app).delete('/v1/account'), { id: String(stored._id) })
        .send({ password: guest.password }).expect(409);
      expect(response.body.code).toBe('refund_unconfirmed');
      expect(response.body.outstanding[0].reference).toBe('HID-7763');
      expect(await GuestAccount.countDocuments()).toBe(1);
    } finally { globalThis.fetch = original; }
  });

  it('deletes the account once every refund is confirmed', async () => {
    const stored = await createConfirmedGuest();
    const original = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ refundsConfirmed: true }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
    try {
      await asUser(request(app).delete('/v1/account'), { id: String(stored._id) })
        .send({ password: guest.password }).expect(204);
      expect(await GuestAccount.countDocuments()).toBe(0);
    } finally { globalThis.fetch = original; }
  });
});

describe('staff invitation', () => {
  it('sets the password from the link and activates the account', async () => {
    const member = await StaffAccount.create({
      full_name: 'Hana Suzuki',
      email: 'hana.suzuki@hotelindoora.com',
      invite_token: 'invite-token-1',
      invite_expires_at: new Date(Date.now() + 60 * 60 * 1000),
      status: 'invited',
    });
    const response = await request(app).post('/v1/auth/staff/password-setup')
      .send({ token: 'invite-token-1', password: 'Harbour-2026' }).expect(200);
    expect(response.body.account.status).toBe('active');
    await request(app).post('/v1/auth/staff/password-setup')
      .send({ token: 'invite-token-1', password: 'Harbour-2026' }).expect(404);
    const reloaded = await StaffAccount.findById(member._id).select('+password_hash');
    expect(reloaded.password_hash).toBeTruthy();
  });

  it('refuses an invitation that has run out', async () => {
    await StaffAccount.create({
      full_name: 'Late Colleague',
      email: 'late@example.com',
      invite_token: 'invite-token-2',
      invite_expires_at: new Date(Date.now() - 1000),
      status: 'invited',
    });
    await request(app).post('/v1/auth/staff/password-setup')
      .send({ token: 'invite-token-2', password: 'Harbour-2026' }).expect(410);
  });
});
