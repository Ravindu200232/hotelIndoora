import { describe, it, expect } from 'vitest';
import { siteBase } from '../src/lib/links.js';
import { loadConfig } from '../src/config.js';

/**
 * The address PayPal hands a guest back to.
 *
 * Behind nginx and CloudFront a request arrives on the origin's own name over
 * http, so an address built from the request would send the guest somewhere the
 * site is not. SITE_URL is the address the guest really uses.
 */
const request = {
  protocol: 'http',
  get: (name) => (name === 'host' ? 'ip-10-0-0-14.ap-south-1.compute.internal' : undefined),
};

describe('the address the payment links return to', () => {
  it('uses SITE_URL when the environment sets one', () => {
    expect(siteBase({ siteUrl: 'https://hotel.example' }, request)).toBe('https://hotel.example');
  });

  it('normalises a trailing slash away', () => {
    expect(siteBase({ siteUrl: 'https://hotel.example/' }, request)).toBe('https://hotel.example');
  });

  it('falls back to the request only when nothing is configured', () => {
    expect(siteBase({}, request)).toBe('http://ip-10-0-0-14.ap-south-1.compute.internal');
    expect(siteBase({ siteUrl: '   ' }, request)).toBe('http://ip-10-0-0-14.ap-south-1.compute.internal');
  });

  it('reads SITE_URL from the environment into the service config', () => {
    expect(loadConfig({ SITE_URL: 'https://hotel.example/' }).siteUrl).toBe('https://hotel.example');
    expect(loadConfig({}).siteUrl).toBe('');
  });
});
