import { describe, expect, it, jest } from '@jest/globals';
import type { Response } from 'express';
import {
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
    },
    response as unknown as Response,
    now,
    secret,
  );
  return { response, secret };
}

describe('cloud credit release gate', () => {
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
});
