import { randomBytes } from 'node:crypto';

/**
 * The booking reference a guest quotes at reception.
 *
 * Issued when a booking is confirmed, unique across all bookings, and long
 * enough not to be guessed: the reference is the only thing needed to read a
 * booking's status from the emailed payment link.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alike characters

export function createReference(prefix = 'HID') {
  const bytes = randomBytes(6);
  let out = '';
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return `${prefix}-${out}`;
}

export function looksLikeReference(value) {
  return /^[A-Z]{2,4}-[A-Z0-9]{4,12}$/.test(String(value ?? '').trim().toUpperCase());
}

export function normaliseReference(value) {
  return String(value ?? '').trim().toUpperCase();
}
