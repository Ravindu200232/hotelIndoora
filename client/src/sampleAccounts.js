/**
 * The parts of the sign-in page that exist to review the product rather than to
 * sign a guest in: the two sample accounts that sign in with one press, and the
 * panel that lists every guest page behind the form.
 *
 * The specification's own Sign In page section names the email address and
 * password form, the way to Create Account, the error area and the account
 * status message — nothing else. So a build made for a real hotel sets
 * VITE_SAMPLE_ACCOUNTS=off and a visitor sees the hotel's own sign-in page;
 * every other build, including the local preview and the recorded visual
 * baselines, keeps them exactly as they were.
 */
export const showSampleAccounts = import.meta.env.VITE_SAMPLE_ACCOUNTS !== 'off';
