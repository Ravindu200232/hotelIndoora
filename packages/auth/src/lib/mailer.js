/**
 * One transactional email service delivers every message this product sends.
 *
 * The real provider is called; there is no recorded or switched-off mode. When
 * the key is not configured the caller gets a clear error it can show the
 * person who triggered it, and the build records the missing variable as a gap
 * for the hotel to supply - it never silently succeeds.
 */
export class MailError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = 'MailError';
    this.status = status;
  }
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function layout({ hotelName, heading, body, link, linkLabel }) {
  return `<!doctype html><html lang="en"><body style="font-family:system-ui,sans-serif;color:#06202e">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <h1 style="font-size:22px;color:#003049">${heading}</h1>
    ${body}
    ${link ? `<p style="margin:24px 0"><a href="${link}" style="background:#003049;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none">${linkLabel}</a></p>` : ''}
    <p style="color:#4d6b7a;font-size:14px">If the button does not open, copy this address: ${link ?? ''}</p>
    <hr style="border:0;border-top:1px solid #d6e9f1">
    <p style="color:#4d6b7a;font-size:14px">${hotelName} · stay@hotelindoora.com · Check-in from 15:00 · Check-out by 11:00</p>
  </div></body></html>`;
}

export function confirmationEmail({ hotelName, link, fullName }) {
  return {
    subject: `${hotelName}: confirm your email address`,
    html: layout({
      hotelName,
      heading: 'Confirm your email address',
      body: `<p>Hello ${fullName},</p><p>Open the link below and your address is confirmed — then you can book a room.</p><p>The link works once and stops working after 24 hours.</p>`,
      link,
      linkLabel: 'Confirm my email address',
    }),
  };
}

export function inviteEmail({ hotelName, link, fullName, invitedBy }) {
  return {
    subject: `${hotelName}: set your password`,
    html: layout({
      hotelName,
      heading: 'Set your password',
      body: `<p>Hello ${fullName},</p><p>${invitedBy} added you to ${hotelName}'s staff pages. Set your own password with the link below, and you can sign in straight away.</p><p>The link works once and stops working after 72 hours.</p>`,
      link,
      linkLabel: 'Set my password',
    }),
  };
}

/**
 * Send one message, with the three attempts the specification asks for. A
 * failure that survives all three is raised, never swallowed.
 */
export async function sendMail(message, config, { attempts = 3, gapMs = 1500 } = {}) {
  const { apiKey, from, hotelName } = config.mail;
  if (!apiKey) {
    throw new MailError(`${config.mail.provider} is not connected: EMAIL_API_KEY is not set, so no email can be sent yet.`);
  }
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${hotelName} <${from}>`,
          to: [message.to],
          subject: message.subject,
          html: message.html,
        }),
      });
      if (response.ok) return { id: (await response.json().catch(() => ({}))).id ?? '', attempts: attempt };
      const detail = await response.text().catch(() => '');
      lastError = new MailError(
        `The email service refused the message (${response.status}).`,
        { status: response.status },
      );
      if (response.status < 500 && response.status !== 429) break;
      void detail;
    } catch (error) {
      lastError = new MailError(`The email service could not be reached: ${error.message}`);
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, gapMs));
  }
  throw lastError ?? new MailError('The email could not be sent.');
}
