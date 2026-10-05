import jwt from 'jsonwebtoken';

/**
 * The session cookie, and the rule that ends it.
 *
 * The cookie is signed with SESSION_SECRET and carries the account id, its role
 * and the moment the session was last active. It is httpOnly and SameSite=Lax,
 * so no script can read it and no other site can ride on it. The role is read
 * from the token only to decide what to check next - every service verifies the
 * caller again from the identity headers the gateway forwards, and every query
 * is scoped to that id.
 *
 * Idle expiry is sliding: a session ends after 60 minutes with no authenticated
 * request, counted from the last one. The absolute limit (12 hours from sign-in)
 * ends it however busy the session is. An expired session is treated as signed
 * out: the API answers 401 and a page is sent to the sign-in page.
 */
export function createSession({ secret, cookieName, absoluteMinutes, idleMinutes, production }) {
  if (!secret) throw new Error('SESSION_SECRET is required to sign session cookies');

  const idleMs = idleMinutes * 60 * 1000;
  const absoluteSeconds = absoluteMinutes * 60;

  const cookieOptions = () => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: Boolean(production),
    path: '/',
    maxAge: absoluteSeconds * 1000,
  });

  return {
    cookieName,

    /** Sign a session for a signed-in account. `now` keeps the tests honest. */
    issue(res, account, now = Date.now()) {
      const token = jwt.sign(
        {
          sub: String(account.id),
          role: account.role,
          email: account.email,
          name: account.name,
          seen: now,
        },
        secret,
        { expiresIn: absoluteSeconds },
      );
      res.cookie(cookieName, token, cookieOptions());
      return token;
    },

    /** Read the session, or null when there is none, it is idle, or it is forged. */
    read(req, now = Date.now()) {
      const token = req.cookies?.[cookieName];
      if (!token) return null;
      try {
        const claims = jwt.verify(token, secret);
        const seen = Number(claims.seen ?? 0);
        if (!seen || now - seen > idleMs) return null;
        return {
          id: claims.sub,
          role: claims.role,
          email: claims.email,
          name: claims.name,
          seen,
        };
      } catch {
        return null;
      }
    },

    /** Slide the idle window, but only once a minute, so every request is not a new cookie. */
    touch(res, session, now = Date.now()) {
      if (now - session.seen < 60 * 1000) return;
      this.issue(res, session, now);
    },

    clear(res) {
      res.clearCookie(cookieName, { ...cookieOptions(), maxAge: undefined });
    },
  };
}
