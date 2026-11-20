import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Response } from 'express';

jest.mock('./rate-limiter.js', () => require('./rate-limiter'), { virtual: true });

import {
  clearCloudCreditRateLimit,
  CREDIT_BUTTON_OPENS_AT,
  CREDIT_CLOSES_AT,
  CREDIT_OPENS_AT,
  handleCloudCredit,
} from './cloud-credit-handler';

function requestAt(
  now: number,
  claim = false,
  url = 'https://example.com/sample',
  preview = false,
  headers: Record<string, string> = {},
) {
  const secret = jest.fn(() => url);
  const response = {
    headers: {} as Record<string, string>,
    code: 200,
    body: undefined as unknown,
    location: '',
    set(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
    status(code: number) {
      this.code = code;
      return this;
    },
    json(value: unknown) {
      this.body = value;
      return this;
    },
    redirect(code: number, location: string) {
      this.code = code;
      this.location = location;
      return this;
    },
  };
  handleCloudCredit(
    {
      method: 'GET',
      query: { ...(claim ? { claim: '1' } : {}), ...(preview ? { preview: 'open' } : {}) },
      headers,
    },
    response as unknown as Response,
    now,
    secret,
  );
  return { response, secret };
}

describe('cloud credit release gate', () => {
  beforeEach(() => {
    clearCloudCreditRateLimit();
  });

  it('uses the requested Warsaw time boundaries on 21 November', () => {
    expect(CREDIT_OPENS_AT).toBe(Date.parse('2026-11-21T06:00:00Z'));
    expect(CREDIT_BUTTON_OPENS_AT).toBe(Date.parse('2026-11-21T08:00:00Z'));
    expect(CREDIT_CLOSES_AT).toBe(Date.parse('2026-11-21T18:00:00Z'));
  });
  it('does not access or expose the secret before 07:00, even for a direct claim request', () => {
    for (const claim of [false, true]) {
      const { response, secret } = requestAt(CREDIT_OPENS_AT - 1, claim);
      expect(secret).not.toHaveBeenCalled();
      expect(response.body).toMatchObject({ status: 'upcoming' });
      expect(response.code).toBe(claim ? 403 : 200);
      expect(response.location).toBe('');
      expect(response.headers['Cache-Control']).toContain('no-store');
      expect(response.headers['X-Content-Type-Options']).toBe('nosniff');
    }
  });

  it('ignores the local preview parameter in the production handler', () => {
    const { response, secret } = requestAt(
      CREDIT_OPENS_AT - 1,
      true,
      'https://example.com/sample',
      true,
    );
    expect(response.code).toBe(403);
    expect(secret).not.toHaveBeenCalled();
  });

  it('allows direct claims at 07:00 but keeps the button hidden until 09:00', () => {
    const status = requestAt(CREDIT_OPENS_AT);
    expect(status.secret).not.toHaveBeenCalled();
    expect(status.response.body).toMatchObject({ status: 'upcoming' });
    const open = requestAt(CREDIT_OPENS_AT, true);
    expect(open.response.code).toBe(302);
    expect(open.response.location).toBe('https://example.com/sample');
    expect(requestAt(CREDIT_BUTTON_OPENS_AT - 1).response.body).toMatchObject({
      status: 'upcoming',
    });
    expect(requestAt(CREDIT_BUTTON_OPENS_AT).response.body).toMatchObject({ status: 'open' });
    expect(requestAt(CREDIT_CLOSES_AT - 1, true).response.code).toBe(302);
    const closed = requestAt(CREDIT_CLOSES_AT, true);
    expect(closed.secret).not.toHaveBeenCalled();
    expect(closed.response.code).toBe(410);
  });

  it('fails closed when the destination is missing or unsafe', () => {
    for (const url of [
      '',
      'javascript:alert(1)',
      'http://example.com/',
      'https://user:pass@example.com/',
    ]) {
      const { response } = requestAt(CREDIT_OPENS_AT, true, url);
      expect(response.code).toBe(503);
      expect(response.location).toBe('');
    }
  });

  it('rate limits ?claim=1 per rightmost X-Forwarded-For IP at 120 requests/min', () => {
    for (let i = 0; i < 120; i += 1) {
      const { response } = requestAt(CREDIT_OPENS_AT, true, 'https://example.com/sample', false, {
        'x-forwarded-for': `10.0.0.${i}, 198.51.100.20`,
      });
      expect(response.code).toBe(302);
    }

    const blocked = requestAt(CREDIT_OPENS_AT, true, 'https://example.com/sample', false, {
      'x-forwarded-for': '203.0.113.99, 198.51.100.20',
    });
    expect(blocked.response.code).toBe(429);
    expect(blocked.response.body).toEqual({ status: 'rate-limited' });
    expect(blocked.response.headers['Retry-After']).toBe('60');
    expect(blocked.secret).not.toHaveBeenCalled();

    // Non-claim status checks remain available and another IP can claim
    expect(
      requestAt(CREDIT_BUTTON_OPENS_AT, false, 'https://example.com/sample', false, {
        'x-forwarded-for': '198.51.100.20',
      }).response.code,
    ).toBe(200);
    expect(
      requestAt(CREDIT_OPENS_AT, true, 'https://example.com/sample', false, {
        'x-forwarded-for': '198.51.100.21',
      }).response.code,
    ).toBe(302);
  });
});
