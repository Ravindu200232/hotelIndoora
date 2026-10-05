import bcrypt from 'bcryptjs';

/**
 * Passwords are held only as salted bcrypt hashes at a work factor of 12, and
 * are never returned by any route. The rule itself is the specification's: at
 * least 10 characters, with at least one letter and one digit.
 */
const WORK_FACTOR = 12;

export function passwordProblem(password) {
  const value = String(password ?? '');
  if (value.length < 10) return 'Use at least 10 characters, with at least one letter and one digit.';
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
    return 'Use at least 10 characters, with at least one letter and one digit.';
  }
  return null;
}

export function hashPassword(password) {
  return bcrypt.hash(password, WORK_FACTOR);
}

export function verifyPassword(password, hash) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(String(password ?? ''), hash);
}
