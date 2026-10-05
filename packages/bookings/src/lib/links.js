/**
 * The absolute address the site is served on, for the links PayPal returns a
 * guest to.
 *
 * SITE_URL is set once per environment and is the address a guest's browser
 * really uses. A request's own host is only the fallback, and only right while
 * the service is reached directly: behind nginx and CloudFront the request
 * arrives on the origin's name over http, so building a return address from it
 * would send the guest to the wrong host over the wrong scheme.
 */
export function siteBase(config, req) {
  const configured = String(config?.siteUrl ?? '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  return `${req.protocol}://${req.get('host')}`;
}
