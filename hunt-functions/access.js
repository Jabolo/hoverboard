import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

const SESSION_SECONDS = 12 * 60 * 60;
const COOKIE_PATH = '/api/hunt';
const ACCESS_FAIL_MAX_ATTEMPTS = 60;
const ACCESS_FAIL_WINDOW_MS = 15 * 60 * 1000;
const MAX_RATE_LIMIT_BUCKETS = 2000;
// 08:00 in Warsaw on 21 November 2026 (CET, UTC+1).
export const PUBLIC_OPEN_AT = Date.parse('2026-11-21T07:00:00Z');

const ALLOWED_ORIGINS = new Set([
  'https://warsaw.devfest.pl',
  'https://gdg-warsaw-devfest26-web.web.app',
  'https://gdg-warsaw-devfest26-web.firebaseapp.com',
]);
const LOCALHOST_ORIGIN_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1)(?::\d{1,5})?$/;

export function getHeaderValue(headers, name) {
  if (!headers || typeof headers !== 'object') return undefined;
  if (headers[name] !== undefined) return headers[name];
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value;
  }
  return undefined;
}

export function isAllowedHuntOrigin(origin) {
  if (typeof origin !== 'string') return false;
  const trimmed = origin.trim();
  return ALLOWED_ORIGINS.has(trimmed) || LOCALHOST_ORIGIN_PATTERN.test(trimmed);
}

export function getHuntClientIp(request) {
  const forwarded = getHeaderValue(request?.headers, 'x-forwarded-for');
  const hops = Array.isArray(forwarded)
    ? forwarded.flatMap((entry) => String(entry).split(','))
    : typeof forwarded === 'string'
      ? forwarded.split(',')
      : [];
  const cleaned = hops.map((part) => part.trim()).filter(Boolean);
  if (cleaned.length > 0) return cleaned[cleaned.length - 1];
  if (typeof request?.socket?.remoteAddress === 'string' && request.socket.remoteAddress.trim()) {
    return request.socket.remoteAddress.trim();
  }
  if (
    typeof request?.connection?.remoteAddress === 'string' &&
    request.connection.remoteAddress.trim()
  ) {
    return request.connection.remoteAddress.trim();
  }
  if (typeof request?.ip === 'string' && request.ip.trim()) return request.ip.trim();
  return 'unknown';
}

export function hashIpForLog(ip) {
  return createHash('sha256').update(`hunt-log:${ip}`).digest('hex').slice(0, 12);
}

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
  const failedAttemptsByIp = new Map();
  const getFailureBucket = (ip, currentMs) => {
    const existing = failedAttemptsByIp.get(ip);
    if (!existing || existing.resetAtMs <= currentMs) {
      if (existing) failedAttemptsByIp.delete(ip);
      return null;
    }
    return existing;
  };
  const recordFailure = (ip, currentMs) => {
    const existing = getFailureBucket(ip, currentMs);
    if (existing) {
      existing.attempts += 1;
      return existing;
    }
    if (failedAttemptsByIp.size >= MAX_RATE_LIMIT_BUCKETS) {
      const oldest = failedAttemptsByIp.keys().next().value;
      if (oldest !== undefined) failedAttemptsByIp.delete(oldest);
    }
    const bucket = { attempts: 1, resetAtMs: currentMs + ACCESS_FAIL_WINDOW_MS };
    failedAttemptsByIp.set(ip, bucket);
    return bucket;
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
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, body) => {
      response.statusCode = status;
      response.end(JSON.stringify(body));
    };
    // A missing code locks access until the scheduled opening, then no code is needed.
    if (!isOpen() && !validCode) return send(503, { status: 'unavailable' });
    const rawUrl = typeof request?.url === 'string' ? request.url : '';
    const path = rawUrl.split('?', 1)[0];
    if (/^\/api\/hunt\/access\/?$/.test(path)) {
      if (request.method === 'GET')
        return send(200, { status: authorized(request) ? 'unlocked' : 'locked' });
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'GET, POST');
        return send(405, { status: 'invalid' });
      }
      const originHeader = getHeaderValue(request?.headers, 'origin');
      const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
      if (origin !== undefined && !isAllowedHuntOrigin(origin)) {
        return send(403, { status: 'forbidden' });
      }
      if (isOpen()) return send(200, { status: 'unlocked' });
      const currentMs = now();
      const clientIp = getHuntClientIp(request);
      const failureBucket = getFailureBucket(clientIp, currentMs);
      if (failureBucket && failureBucket.attempts >= ACCESS_FAIL_MAX_ATTEMPTS) {
        const retryAfter = Math.max(1, Math.ceil((failureBucket.resetAtMs - currentMs) / 1000));
        response.setHeader('Retry-After', String(retryAfter));
        console.warn('hunt access rate limit exceeded', { ipHash: hashIpForLog(clientIp) });
        return send(429, { status: 'rate-limited' });
      }
      const supplied = request.body?.code;
      if (
        typeof supplied !== 'string' ||
        supplied.length > 256 ||
        !equals(mac(`hunt-code:${supplied}`), mac(`hunt-code:${code}`))
      ) {
        recordFailure(clientIp, currentMs);
        return send(401, { status: 'locked' });
      }
      const expiry = Math.floor(currentMs / 1000) + SESSION_SECONDS;
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
