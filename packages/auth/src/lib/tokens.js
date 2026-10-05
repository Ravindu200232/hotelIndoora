import { randomBytes } from 'node:crypto';

/**
 * Single-use links: the email confirmation and the staff invitation.
 *
 * A 32-byte random token, stored with the moment it stops working, so a link
 * that has been used or has run out of time can be refused rather than trusted.
 */
export function createToken(hours) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  return { token, expiresAt };
}

export function isExpired(expiresAt, now = new Date()) {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() <= now.getTime();
}

/** The link a guest opens; the pages phase decides the host the app is served on. */
export function confirmationLink(token, baseUrl = '') {
  return `${baseUrl}/confirm-email?token=${encodeURIComponent(token)}`;
}

export function inviteLink(token, baseUrl = '') {
  return `${baseUrl}/login?invite=${encodeURIComponent(token)}`;
}
