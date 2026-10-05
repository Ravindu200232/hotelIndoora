import { describe, it, expect, vi } from 'vitest';
import { request, uploadWithProgress, readPhoto, money } from '../src/api.js';
import { stubFetch } from './helpers.js';

/**
 * The client's one door to the gateway, and the one call that needs progress.
 *
 * Every page reaches the product through this file, so what it sends, what it
 * treats as a refusal, and what it hands back have to be right: an error carries
 * the gateway's own message, its status, and the field errors a form puts beside
 * the fields that failed.
 */
describe('request', () => {
  it('sends JSON under /api/v1 and returns the parsed body', async () => {
    const api = stubFetch({ 'POST /api/v1/things': ({ body }) => ({ status: 201, body: { thing: body } }) });
    const result = await request('/things', { method: 'POST', body: { name: 'x' } });
    expect(result).toEqual({ thing: { name: 'x' } });
    expect(api.calls('POST', '/api/v1/things')[0].body).toEqual({ name: 'x' });
    expect(api.unhandled).toEqual([]);
  });

  it('sends no body on a GET, so the gateway never sees an empty one', async () => {
    const api = stubFetch({ 'GET /api/v1/room-types': { room_types: [] } });
    await request('/room-types');
    expect(api.calls('GET', '/api/v1/room-types')).toHaveLength(1);
    expect(api.log[0].body).toBeUndefined();
  });

  it('turns a failed answer into an Error that carries the message and the status', async () => {
    stubFetch({ 'GET /api/v1/missing': { status: 404, body: { error: 'Not here' } } });
    await expect(request('/missing')).rejects.toMatchObject({ message: 'Not here', status: 404 });
  });

  it('carries the code and the field errors a form needs to show', async () => {
    stubFetch({
      'POST /api/v1/staff/team': {
        status: 409,
        body: {
          error: 'That email address already belongs to a staff or guest account',
          code: 'email_taken',
          errors: { email: 'This email address already belongs to a staff or guest account.' },
        },
      },
    });

    const refusal = await request('/staff/team', { method: 'POST', body: { email: 'x@example.com' } }).catch((error) => error);
    expect(refusal.status).toBe(409);
    expect(refusal.code).toBe('email_taken');
    expect(refusal.errors.email).toContain('already belongs');
    expect(refusal.payload.error).toContain('already belongs');
  });

  it('keeps the real status when the gateway answers with something that is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })));
    await expect(request('/anything')).rejects.toMatchObject({ message: 'Request failed (502)', status: 502 });
  });
});

describe('uploading a photograph, with progress', () => {
  /** The smallest stand-in for XMLHttpRequest that a test can drive. */
  class FakeXhr {
    constructor() {
      FakeXhr.last = this;
      this.upload = {};
      this.status = 0;
      this.responseText = '';
    }

    open(method, url) { this.method = method; this.url = url; }

    setRequestHeader(name, value) { this.headers = { ...(this.headers ?? {}), [name]: value }; }

    send(body) {
      this.body = body;
      this.upload.onprogress?.({ lengthComputable: true, loaded: 46, total: 100 });
      if (FakeXhr.refuse) {
        this.status = 502;
        this.responseText = JSON.stringify({ error: 'Room photographs are not connected yet', code: 'storage_unavailable' });
        this.onload();
        return;
      }
      this.status = 201;
      this.responseText = JSON.stringify({ room_type: { id: '1', photos: ['1/photo.jpg'] } });
      this.onload();
    }
  }

  it('posts the file and reports how much of it has gone up', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    FakeXhr.refuse = false;
    const seen = [];

    const answer = await uploadWithProgress(
      '/staff/room-types/1/photos',
      { filename: 'garden.jpg', content_type: 'image/jpeg', data: 'AAAA' },
      (percent) => seen.push(percent),
    );

    expect(answer.room_type.photos).toEqual(['1/photo.jpg']);
    expect(seen).toEqual([46]);
    expect(FakeXhr.last.method).toBe('POST');
    expect(FakeXhr.last.url).toBe('/api/v1/staff/room-types/1/photos');
    expect(FakeXhr.last.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(FakeXhr.last.body).filename).toBe('garden.jpg');
  });

  it('refuses with the service\'s own message when the upload is turned away', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    FakeXhr.refuse = true;

    const refusal = await uploadWithProgress('/staff/room-types/1/photos', { filename: 'x.jpg' }).catch((error) => error);
    expect(refusal.status).toBe(502);
    expect(refusal.code).toBe('storage_unavailable');
    expect(refusal.message).toContain('not connected yet');
  });
});

describe('reading a chosen file', () => {
  it('hands back the base64 the service stores, without the data-URL prefix', async () => {
    class FakeReader {
      readAsDataURL() {
        this.result = 'data:image/jpeg;base64,QUJD';
        this.onload();
      }
    }
    vi.stubGlobal('FileReader', FakeReader);

    await expect(readPhoto(new Blob(['abc']))).resolves.toBe('QUJD');
  });

  it('says the file could not be read rather than hanging', async () => {
    class FailingReader {
      readAsDataURL() { this.onerror(); }
    }
    vi.stubGlobal('FileReader', FailingReader);

    await expect(readPhoto(new Blob(['abc']))).rejects.toThrow('could not be read from this device');
  });
});

describe('money', () => {
  it('writes one euro amount, and treats a missing one as zero rather than throwing', () => {
    expect(money(4500)).toBe('€4500.00');
    expect(money(undefined)).toBe('€0.00');
  });
});
