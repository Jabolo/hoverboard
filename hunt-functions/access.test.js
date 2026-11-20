import assert from 'node:assert/strict';
import test from 'node:test';
import { createAccessGate, PUBLIC_OPEN_AT } from './access.js';
import { createHuntHandler } from './handler.js';

const code = Buffer.alloc(32, 9).toString('base64url'); // Test fixture only.
function request(
  gate,
  url,
  { method = 'GET', body, cookie, origin, xff, hunt = createHuntHandler() } = {},
) {
  const headers = {};
  const res = {
    setHeader: (key, value) => {
      headers[key] = value;
    },
    end: (value) => {
      res.body = JSON.parse(value);
    },
  };
  const reqHeaders = {
    ...(cookie !== undefined ? { cookie } : {}),
    ...(origin !== undefined ? { origin } : {}),
    ...(xff !== undefined ? { 'x-forwarded-for': xff } : {}),
  };
  gate({ url, method, body, headers: reqHeaders }, res, hunt);
  assert.match(headers['Cache-Control'], /no-store/);
  assert.equal(headers['Referrer-Policy'], 'no-referrer');
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  return { status: res.statusCode, body: res.body, headers };
}

test('locked gate denies collection, card reads, reveals and unknown routes', () => {
  const gate = createAccessGate({ code, now: () => PUBLIC_OPEN_AT - 1 });
  for (const [url, method] of [
    ['/api/hunt/collection', 'GET'],
    ['/api/hunt/card/rmz75w8', 'GET'],
    ['/api/hunt/card/rmz75w8', 'POST'],
    ['/api/hunt/other', 'GET'],
  ]) {
    assert.deepEqual(request(gate, url, { method }).body, { status: 'locked' });
    assert.equal(request(gate, url, { method }).status, 401);
  }
  assert.deepEqual(request(gate, '/api/hunt/access').body, { status: 'locked' });
  for (const body of [undefined, {}, { code: 'wrong' }, { code: 12 }]) {
    const result = request(gate, '/api/hunt/access', { method: 'POST', body });
    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { status: 'locked' });
    assert.equal(result.headers['Set-Cookie'], undefined);
  }
});

test('valid login issues a signed, scoped session that expires and rejects forgery', () => {
  let time = Date.parse('2026-11-19T12:00:00Z');
  const gate = createAccessGate({ code, now: () => time });
  const login = request(gate, '/api/hunt/access', { method: 'POST', body: { code } });
  assert.deepEqual(login.body, { status: 'unlocked' });
  assert.match(
    login.headers['Set-Cookie'],
    /^__session=.*; Path=\/api\/hunt; Max-Age=43200; HttpOnly; Secure; SameSite=Lax$/,
  );
  const cookie = login.headers['Set-Cookie'].split(';')[0];
  assert.deepEqual(request(gate, '/api/hunt/access', { cookie }).body, { status: 'unlocked' });
  assert.equal(
    request(gate, '/api/hunt/card/rmz75w8', { method: 'POST', cookie }).body.status,
    'earned',
  );
  assert.equal(request(gate, '/api/hunt/collection', { cookie: cookie + 'x' }).status, 401);
  assert.equal(
    request(gate, '/api/hunt/collection', { cookie: `${cookie}; ${cookie}` }).status,
    401,
  );
  assert.equal(
    request(
      createAccessGate({ code: Buffer.alloc(32, 8).toString('base64url'), now: () => time }),
      '/api/hunt/collection',
      { cookie },
    ).status,
    401,
  );
  time += 43200 * 1000;
  assert.equal(request(gate, '/api/hunt/collection', { cookie }).status, 401);
});

test('configuration fails closed and explicit open mode bypasses the gate', () => {
  for (const options of [{}, { code: 'weak' }]) {
    const gate = createAccessGate({ ...options, now: () => PUBLIC_OPEN_AT - 1 });
    assert.equal(request(gate, '/api/hunt/access').status, 503);
  }
  assert.throws(() => createAccessGate({ mode: 'typo', code }));
  const open = createAccessGate({ mode: 'open' });
  assert.deepEqual(request(open, '/api/hunt/access').body, { status: 'unlocked' });
  assert.deepEqual(request(open, '/api/hunt/access', { method: 'POST' }).body, {
    status: 'unlocked',
  });
  assert.equal(request(open, '/api/hunt/collection').status, 200);
});

test('authorized sessions still respect card opening and closing times', () => {
  let time = Date.parse('2026-11-20T12:59:59Z');
  const gate = createAccessGate({ code, now: () => time });
  const hunt = createHuntHandler({
    now: () => time,
    physicalCards: [
      {
        id: 'abc2345',
        group: 'mystery',
        title: 'Timed',
        text: 'Private answer',
        opensAt: Date.parse('2026-11-20T13:00:00Z'),
        closesAt: Date.parse('2026-11-20T14:00:00Z'),
      },
    ],
  });
  const login = request(gate, '/api/hunt/access', { method: 'POST', body: { code }, hunt });
  const cookie = login.headers['Set-Cookie'].split(';')[0];
  const reveal = () => request(gate, '/api/hunt/card/abc2345', { method: 'POST', cookie, hunt });
  assert.equal(reveal().body.status, 'future');
  time += 1000;
  assert.equal(reveal().body.status, 'earned');
  time += 3600 * 1000;
  assert.equal(reveal().body.status, 'expired');
});

test('scheduled public opening is evaluated on every request at the exact millisecond', () => {
  let time = PUBLIC_OPEN_AT - 1;
  const gate = createAccessGate({ code, now: () => time });
  assert.deepEqual(request(gate, '/api/hunt/access').body, { status: 'locked' });
  assert.equal(request(gate, '/api/hunt/card/rmz75w8', { method: 'POST' }).status, 401);
  time = PUBLIC_OPEN_AT;
  assert.deepEqual(request(gate, '/api/hunt/access').body, { status: 'unlocked' });
  assert.equal(request(gate, '/api/hunt/card/rmz75w8', { method: 'POST' }).body.status, 'earned');
  const missingCode = createAccessGate({ now: () => time });
  assert.equal(request(missingCode, '/api/hunt/collection').status, 200);
});

test('access gate rate-limits failed POST attempts per rightmost X-Forwarded-For IP, rejects foreign origins, and guards missing URLs', () => {
  let time = PUBLIC_OPEN_AT - 60_000;
  const gate = createAccessGate({ code, now: () => time });

  // Foreign origin rejected on POST, allowed origin accepted
  assert.equal(
    request(gate, '/api/hunt/access', {
      method: 'POST',
      body: { code },
      origin: 'https://evil.example',
    }).status,
    403,
  );
  assert.equal(
    request(gate, '/api/hunt/access', {
      method: 'POST',
      body: { code },
      origin: 'https://warsaw.devfest.pl',
    }).status,
    200,
  );

  // Missing URL fails safely instead of throwing
  assert.equal(request(gate, undefined).status, 401);

  // 60 failed attempts from same rightmost IP (even with spoofed leftmost IPs) -> 61st returns 429
  for (let i = 0; i < 60; i += 1) {
    const res = request(gate, '/api/hunt/access', {
      method: 'POST',
      body: { code: 'wrong-code' },
      xff: `10.0.0.${i}, 198.51.100.77`,
    });
    assert.equal(res.status, 401);
  }
  const blocked = request(gate, '/api/hunt/access', {
    method: 'POST',
    body: { code },
    xff: '203.0.113.1, 198.51.100.77',
  });
  assert.equal(blocked.status, 429);
  assert.deepEqual(blocked.body, { status: 'rate-limited' });
  assert.ok(Number(blocked.headers['Retry-After']) > 0);

  // Another IP is unaffected
  assert.equal(
    request(gate, '/api/hunt/access', {
      method: 'POST',
      body: { code },
      xff: '198.51.100.78',
    }).status,
    200,
  );
});
