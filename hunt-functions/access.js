import { createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

const SESSION_SECONDS = 12 * 60 * 60;
const COOKIE_PATH = '/api/hunt';
// 08:00 in Warsaw on 21 November 2026 (CET, UTC+1).
export const PUBLIC_OPEN_AT = Date.parse('2026-11-21T07:00:00Z');

// The code must be 32 random bytes encoded as unpadded base64url (43 characters).
// The format check cannot prove randomness: generate it with a CSPRNG.
export function createAccessGate({ mode = 'locked', code, now = Date.now } = {}) {
  if (mode !== 'locked' && mode !== 'open') throw new Error('Invalid access mode');
  const validCode =
    typeof code === 'string' &&
    /^[A-Za-z0-9_-]{43}$/.test(code) &&
    Buffer.from(code, 'base64url').length === 32 &&
    Buffer.from(code, 'base64url').toString('base64url') === code;
  const key = validCode ? Buffer.from(code, 'base64url') : null;
  const isOpen = () => mode === 'open' || now() >= PUBLIC_OPEN_AT;
  const mac = (value) => createHmac('sha256', key).update(value).digest('base64url');
  const equals = (a, b) => {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  };
  const authorized = (request) => {
    if (isOpen()) return true;
    const cookies = (request.headers?.cookie || '').split(';').map((part) => part.trim());
    const sessions = cookies.filter((part) => part.startsWith('__session='));
    if (sessions.length !== 1) return false;
    const match = /^__session=(\d{1,12})\.([A-Za-z0-9_-]{43})$/.exec(sessions[0]);
    if (!match) return false;
    const expiry = Number(match[1]);
    const current = Math.floor(now() / 1000);
    return (
      expiry > current &&
      expiry <= current + SESSION_SECONDS &&
      equals(match[2], mac(`hunt-session:${match[1]}`))
    );
  };
  return (request, response, next) => {
    response.setHeader('Cache-Control', 'private, no-store, max-age=0');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, body) => {
      response.statusCode = status;
      response.end(JSON.stringify(body));
    };
    // A missing code locks access until the scheduled opening, then no code is needed.
    if (!isOpen() && !validCode) return send(503, { status: 'unavailable' });
    const path = request.url.split('?', 1)[0];
    if (/^\/api\/hunt\/access\/?$/.test(path)) {
      if (request.method === 'GET')
        return send(200, { status: authorized(request) ? 'unlocked' : 'locked' });
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'GET, POST');
        return send(405, { status: 'invalid' });
      }
      if (isOpen()) return send(200, { status: 'unlocked' });
      const supplied = request.body?.code;
      if (
        typeof supplied !== 'string' ||
        supplied.length > 256 ||
        !equals(mac(`hunt-code:${supplied}`), mac(`hunt-code:${code}`))
      ) {
        return send(401, { status: 'locked' });
      }
      const expiry = Math.floor(now() / 1000) + SESSION_SECONDS;
      const token = `${expiry}.${mac(`hunt-session:${expiry}`)}`;
      response.setHeader(
        'Set-Cookie',
        `__session=${token}; Path=${COOKIE_PATH}; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
      );
      return send(200, { status: 'unlocked' });
    }
    if (!authorized(request)) return send(401, { status: 'locked' });
    return next(request, response);
  };
}
