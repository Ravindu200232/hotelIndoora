/**
 * Forward one request to an internal service.
 *
 * Written with fetch rather than a proxy library so the failure modes are
 * visible: a service that is not up yet is a 503 the client can act on, not a
 * stack trace, and never a 200 with an empty body.
 *
 * The signed-in identity travels as internal headers. The services are not
 * reachable from outside the machine, so they trust them - and every service
 * still scopes its own queries to that id rather than believing a body.
 */
export function proxyTo(baseUrl, { timeoutMs = 10000 } = {}) {
  return async function proxy(req, res) {
    const target = new URL(req.originalUrl.replace(/^\/api/, ''), baseUrl);
    const headers = { accept: req.get('accept') ?? 'application/json' };
    if (req.get('content-type')) headers['content-type'] = req.get('content-type');
    if (req.session) {
      headers['x-user-id'] = String(req.session.id);
      headers['x-user-role'] = String(req.session.role);
      headers['x-user-email'] = String(req.session.email ?? '');
      headers['x-user-name'] = String(req.session.name ?? '');
    }
    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(target, {
        method: req.method,
        headers,
        body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
        signal: controller.signal,
      });
      const text = await response.text();
      res.status(response.status);
      const type = response.headers.get('content-type');
      if (type) res.type(type);
      for (const header of ['x-paypal-approval-url', 'x-mail-status']) {
        const value = response.headers.get(header);
        if (value) res.set(header, value);
      }
      res.send(text);
    } catch (error) {
      const timedOut = error?.name === 'AbortError';
      res.status(503).json({
        error: timedOut ? 'Upstream service timed out' : 'Upstream service unavailable',
        service: baseUrl,
      });
    } finally {
      clearTimeout(timer);
    }
  };
}
