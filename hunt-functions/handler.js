import { createCatalog } from './catalog.js';
import { getHeaderValue, getHuntClientIp, hashIpForLog, isAllowedHuntOrigin } from './access.js';

const CARD_RATE_LIMIT_MAX_ATTEMPTS = 300;
const CARD_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_RATE_LIMIT_BUCKETS = 2000;

export function createHuntHandler({
  physicalCards = [],
  includePreview = false,
  now = Date.now,
} = {}) {
  const catalog = createCatalog(physicalCards, includePreview);
  const cardRequestsByIp = new Map();

  const checkCardRateLimit = (ip, currentMs) => {
    const existing = cardRequestsByIp.get(ip);
    let attempts = 0;
    let resetAtMs = currentMs + CARD_RATE_LIMIT_WINDOW_MS;
    if (existing && existing.resetAtMs > currentMs) {
      attempts = existing.attempts;
      resetAtMs = existing.resetAtMs;
    }
    if (attempts >= CARD_RATE_LIMIT_MAX_ATTEMPTS) {
      return { allowed: false, resetAtMs };
    }
    if (!existing && cardRequestsByIp.size >= MAX_RATE_LIMIT_BUCKETS) {
      const oldest = cardRequestsByIp.keys().next().value;
      if (oldest !== undefined) cardRequestsByIp.delete(oldest);
    }
    cardRequestsByIp.set(ip, { attempts: attempts + 1, resetAtMs });
    return { allowed: true, resetAtMs };
  };

  return (request, response) => {
    response.setHeader('Cache-Control', 'private, no-store, max-age=0');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    const send = (status, body) => {
      response.statusCode = status;
      response.end(JSON.stringify(body));
    };

    const rawUrl = typeof request?.url === 'string' ? request.url : '';
    const path = rawUrl.split('?', 1)[0];
    if (/^\/api\/hunt\/collection\/?$/.test(path)) {
      if (request.method !== 'GET') {
        response.setHeader('Allow', 'GET');
        return send(405, { status: 'invalid' });
      }
      return send(200, { groups: catalog.groups });
    }

    if (request.method === 'POST') {
      const originHeader = getHeaderValue(request?.headers, 'origin');
      const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
      if (origin !== undefined && !isAllowedHuntOrigin(origin)) {
        return send(403, { status: 'forbidden' });
      }
    }

    const currentTime = now();
    if (path.startsWith('/api/hunt/card/')) {
      const clientIp = getHuntClientIp(request);
      const limit = checkCardRateLimit(clientIp, currentTime);
      if (!limit.allowed) {
        const retryAfter = Math.max(1, Math.ceil((limit.resetAtMs - currentTime) / 1000));
        response.setHeader('Retry-After', String(retryAfter));
        console.warn('hunt card rate limit exceeded', { ipHash: hashIpForLog(clientIp) });
        return send(429, { status: 'rate-limited' });
      }
    }

    const match = /^\/api\/hunt\/card\/([a-z0-9]{7})\/?$/i.exec(path);
    const card = match && catalog.byId.get(match[1].toLowerCase());
    if (!card) return send(404, { status: 'invalid' });

    if (request.method !== 'GET' && request.method !== 'POST') {
      response.setHeader('Allow', 'GET, POST');
      return send(405, { status: 'invalid' });
    }

    if (currentTime < card.opensAt) return send(200, { status: 'future' });
    if (currentTime >= card.closesAt) return send(200, { status: 'expired' });

    const { id, group, title, text, game } = card;
    if (request.method === 'GET') return send(200, { status: 'open', card: { id, group, title } });
    return send(200, { status: 'earned', card: { id, group, title, text, game } });
  };
}
