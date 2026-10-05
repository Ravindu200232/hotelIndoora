/**
 * Who is calling. The gateway verifies the session cookie and forwards the
 * identity as internal headers; this service is not reachable from outside.
 *
 * Internal calls between services carry a shared token instead, and are only
 * mounted under `/internal/...` - a prefix the gateway never proxies.
 */
export function caller(req) {
  const id = req.get('x-user-id');
  if (!id) return null;
  return {
    id,
    role: req.get('x-user-role') ?? '',
    email: req.get('x-user-email') ?? '',
    name: req.get('x-user-name') ?? '',
  };
}

export function requireRole(...roles) {
  return (req, res, next) => {
    const user = caller(req);
    if (!user) return res.status(401).json({ error: 'Sign in to continue' });
    if (roles.length && !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Your account cannot open this' });
    }
    req.user = user;
    next();
  };
}

export function requireInternal(config) {
  return (req, res, next) => {
    if (req.get('x-internal-token') !== config.internalToken) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    next();
  };
}
