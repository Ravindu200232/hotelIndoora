/**
 * Who is calling.
 *
 * The gateway verifies the signed session cookie and forwards the identity as
 * internal headers. These services are not reachable from outside the machine,
 * so they read those headers - and every query is still scoped to the id they
 * carry rather than to a body the caller sent.
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
