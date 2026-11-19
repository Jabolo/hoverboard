import { createCatalog } from './catalog.js';

export function createHuntHandler({
  physicalCards = [],
  includePreview = false,
  now = Date.now,
} = {}) {
  const catalog = createCatalog(physicalCards, includePreview);

  return (request, response) => {
    response.setHeader('Cache-Control', 'private, no-store, max-age=0');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    const send = (status, body) => {
      response.statusCode = status;
      response.end(JSON.stringify(body));
    };

    const path = request.url.split('?', 1)[0];
    if (/^\/api\/hunt\/collection\/?$/.test(path)) {
      if (request.method !== 'GET') {
        response.setHeader('Allow', 'GET');
        return send(405, { status: 'invalid' });
      }
      return send(200, { groups: catalog.groups });
    }

    const match = /^\/api\/hunt\/card\/([a-z0-9]{7})\/?$/i.exec(path);
    const card = match && catalog.byId.get(match[1].toLowerCase());
    if (!card) return send(404, { status: 'invalid' });

    if (request.method !== 'GET' && request.method !== 'POST') {
      response.setHeader('Allow', 'GET, POST');
      return send(405, { status: 'invalid' });
    }

    const currentTime = now();
    if (currentTime < card.opensAt) return send(200, { status: 'future' });
    if (currentTime >= card.closesAt) return send(200, { status: 'expired' });

    const { id, group, title, text, game } = card;
    if (request.method === 'GET') return send(200, { status: 'open', card: { id, group, title } });
    return send(200, { status: 'earned', card: { id, group, title, text, game } });
  };
}
