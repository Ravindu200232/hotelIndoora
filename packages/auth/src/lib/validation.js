/**
 * The specification's field rules, in one place, so a route, a form and a test
 * all refuse the same input for the same reason.
 *
 * Each function returns an error message, or null when the value is acceptable.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+0-9][0-9\s\-()]{5,29}$/;

export const problems = {
  fullName(value) {
    const text = String(value ?? '').trim();
    if (!text) return 'Enter a full name.';
    if (text.length < 2 || text.length > 120) return 'Enter between 2 and 120 characters.';
    return null;
  },
  email(value) {
    const text = String(value ?? '').trim();
    if (!text) return 'Enter an email address.';
    if (!EMAIL.test(text)) return 'Enter an email address in the correct format, like name@example.com.';
    if (text.length > 254) return 'That email address is too long.';
    return null;
  },
  phone(value, { required = false } = {}) {
    const text = String(value ?? '').trim();
    if (!text) return required ? 'Enter a contact phone number.' : null;
    if (!PHONE.test(text)) return 'Enter a phone number with digits, spaces, hyphens or a leading plus.';
    return null;
  },
};

/** { full_name, email, phone } -> { field: message }, empty when everything passes. */
export function validate(fields) {
  const errors = {};
  for (const [field, check] of Object.entries(fields)) {
    const message = check();
    if (message) errors[field] = message;
  }
  return errors;
}
