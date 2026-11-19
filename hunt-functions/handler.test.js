import assert from 'node:assert/strict';
import test from 'node:test';
import { readPhysicalCards } from './catalog.js';
import { createHuntHandler } from './handler.js';

const timedCard = {
  id: 'abc2345',
  group: 'mystery',
  title: 'Fixture card',
  text: 'Fixture answer',
  opensAt: '2026-11-21T14:00:00+01:00',
  closesAt: '2026-11-21T15:00:00+01:00',
};
const timedUrl = '/api/hunt/card/abc2345/';

function request(handler, url, method = 'GET') {
  const headers = new Map();
  const response = {
    setHeader: (name, value) => headers.set(name, value),
    end(payload) {
      this.body = JSON.parse(payload);
    },
  };
  handler({ url, method }, response);
  assert.equal(headers.get('Cache-Control'), 'private, no-store, max-age=0');
  assert.equal(headers.get('X-Robots-Tag'), 'noindex, nofollow');
  return { status: response.statusCode, body: response.body, headers };
}

test('collection exposes group counts and broad hints without card records', () => {
  const handler = createHuntHandler({
    physicalCards: readPhysicalCards(JSON.stringify([timedCard])),
    includePreview: true,
  });
  const { status, body } = request(handler, '/api/hunt/collection');
  assert.equal(status, 200);
  assert.deepEqual(
    body.groups.map(({ id, count }) => ({ id, count })),
    [
      { id: 'web', count: 8 },
      { id: 'play', count: 5 },
      { id: 'venue', count: 0 },
      { id: 'mystery', count: 1 },
    ],
  );
  assert.deepEqual(body.groups.at(-1), { id: 'mystery', label: 'Mystery', count: 1 });
  assert.ok(!JSON.stringify(body).includes(timedCard.id));
  assert.ok(!JSON.stringify(body).includes(timedCard.title));
});

test('server gates find and reveal at the exact time boundaries', () => {
  let clock;
  const handler = createHuntHandler({
    physicalCards: readPhysicalCards(JSON.stringify([timedCard])),
    now: () => clock,
  });

  clock = Date.parse(timedCard.opensAt) - 1;
  for (const method of ['GET', 'POST']) {
    assert.deepEqual(request(handler, timedUrl, method).body, { status: 'future' });
  }

  clock += 1;
  const { id, group, title, text } = timedCard;
  assert.deepEqual(request(handler, '/api/hunt/card/ABC2345/').body, {
    status: 'open',
    card: { id, group, title },
  });
  assert.deepEqual(request(handler, timedUrl, 'POST').body, {
    status: 'earned',
    card: { id, group, title, text },
  });

  clock = Date.parse(timedCard.closesAt) - 1;
  assert.equal(request(handler, timedUrl).body.status, 'open');
  assert.equal(request(handler, timedUrl, 'POST').body.status, 'earned');
  clock += 1;
  for (const method of ['GET', 'POST']) {
    const url = `${timedUrl}?now=${encodeURIComponent(timedCard.opensAt)}`;
    assert.deepEqual(request(handler, url, method).body, { status: 'expired' });
  }
});

test('case-insensitive reopens return the canonical ID and playable game at reveal only', () => {
  const handler = createHuntHandler();
  const url = '/api/hunt/card/RMZ75W8';
  const { body } = request(handler, url);
  assert.deepEqual(body, {
    status: 'open',
    card: { id: 'rmz75w8', group: 'play', title: 'Signal Catcher' },
  });
  const { card, status } = request(handler, url, 'POST').body;
  assert.equal(status, 'earned');
  assert.equal(card.id, body.card.id);
  assert.equal(card.game, 'signal');
  assert.ok(card.text.length);
});

test('unknown codes and routes fail, and unsupported methods return Allow', () => {
  const handler = createHuntHandler();
  for (const path of [
    '/api/hunt/card/zzzzzzz',
    '/api/hunt/card/',
    '/api/hunt/card/y6597cd/extra',
    '/api/hunt',
  ]) {
    const result = request(handler, path);
    assert.equal(result.status, 404);
    assert.deepEqual(result.body, { status: 'invalid' });
  }
  const result = request(handler, '/api/hunt/card/y6597cd', 'PUT');
  assert.equal(result.status, 405);
  assert.equal(result.headers.get('Allow'), 'GET, POST');
  assert.equal(request(handler, '/api/hunt/collection', 'POST').headers.get('Allow'), 'GET');
});

test('preview fixtures exercise all three time states without appearing in event counts', () => {
  const options = { now: () => Date.parse('2026-11-19T12:00:00Z') };
  const preview = createHuntHandler({ ...options, includePreview: true });
  const event = createHuntHandler(options);
  for (const [id, expected] of [
    ['esmvnrm', 'open'],
    ['z9swftn', 'future'],
    ['96wt9u8', 'expired'],
  ]) {
    assert.equal(request(preview, `/api/hunt/card/${id}`).body.status, expected);
    assert.equal(request(event, `/api/hunt/card/${id}`).status, 404);
  }
  assert.deepEqual(
    request(preview, '/api/hunt/collection').body,
    request(event, '/api/hunt/collection').body,
  );
});

test('catalog config refuses duplicate codes and values without a complete offset-aware window', () => {
  for (const cards of [
    [],
    [timedCard, timedCard],
    [{ ...timedCard, id: 'esmvnrm' }],
    [{ ...timedCard, opensAt: '2026-11-21T14:00:00' }],
    [{ ...timedCard, closesAt: undefined }],
    [{ ...timedCard, opensAt: timedCard.closesAt }],
  ]) {
    assert.throws(() => readPhysicalCards(JSON.stringify(cards)));
  }
});

test('three new website cards reveal without exposing answers in collection or open responses', () => {
  const handler = createHuntHandler();
  for (const id of ['cr3w8up', 'f00t3rx', 'p3ek7up']) {
    const open = request(handler, `/api/hunt/card/${id}`).body;
    assert.equal(open.status, 'open');
    assert.equal(open.card.text, undefined);
    const earned = request(handler, `/api/hunt/card/${id}`, 'POST').body;
    assert.equal(earned.status, 'earned');
    assert.ok(earned.card.text.length);
    assert.ok(!JSON.stringify(request(handler, '/api/hunt/collection').body).includes(id));
  }
});

test('arcade souvenir routes use the same find and reveal contract', () => {
  const handler = createHuntHandler();
  for (const id of ['b055win', 'bug5afe', 'cd2002x']) {
    assert.equal(request(handler, `/api/hunt/card/${id}`).body.status, 'open');
    assert.equal(request(handler, `/api/hunt/card/${id}`, 'POST').body.status, 'earned');
  }
});
