import { test } from 'node:test';
import assert from 'node:assert/strict';
import { y2kCardHunt, y2kCardHuntPreview } from './index.js';

function request(fn, url) {
  const response = {
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
    end(body) {
      this.body = JSON.parse(body);
    },
  };
  fn({ url, method: 'GET', headers: {} }, response);
  return response;
}

test('production fails closed on bad configuration and excludes preview fixtures', () => {
  process.env.HUNT_PHYSICAL_CARDS_PRODUCTION = 'not-json';
  const unavailable = request(y2kCardHunt, '/api/hunt/collection');
  assert.equal(unavailable.statusCode, 503);
  assert.deepEqual(unavailable.body, { status: 'unavailable' });
  assert.match(unavailable.headers['Cache-Control'], /no-store/);

  const fixture = JSON.stringify([
    { id: 'test123', group: 'venue', title: 'Fixture', text: 'Fixture' },
  ]);
  process.env.HUNT_PHYSICAL_CARDS_PRODUCTION = fixture;
  process.env.HUNT_PHYSICAL_CARDS = fixture;
  assert.equal(request(y2kCardHunt, '/api/hunt/card/test123').body.status, 'open');
  assert.equal(request(y2kCardHunt, '/api/hunt/card/esmvnrm').statusCode, 404);
  assert.equal(request(y2kCardHuntPreview, '/api/hunt/card/esmvnrm').statusCode, 200);
  assert.equal(
    y2kCardHunt.__endpoint.secretEnvironmentVariables[0].key,
    'HUNT_PHYSICAL_CARDS_PRODUCTION',
  );
  assert.equal(y2kCardHuntPreview.__endpoint.secretEnvironmentVariables, undefined);
});
