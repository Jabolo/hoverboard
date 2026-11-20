import { describe, expect, it, jest } from '@jest/globals';

const mockRunWith = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerError = jest.fn();

class MockHttpsError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('firebase-functions/v1', () => ({
  runWith: (opts: Record<string, unknown>) => {
    mockRunWith(opts);
    return {
      https: {
        onCall: (handler: unknown) => ({ handler, runtimeOpts: opts }),
      },
    };
  },
  https: {
    HttpsError: MockHttpsError,
  },
  logger: {
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}));
jest.mock('./newsletter-contract.js', () => require('./newsletter-contract'), { virtual: true });
jest.mock('./rate-limiter.js', () => require('./rate-limiter'), { virtual: true });

import {
  hasValidNewsletterConsent,
  isValidNewsletterEmail,
  NEWSLETTER_CONSENT_SOURCE,
  NEWSLETTER_CONSENT_VERSION,
  normalizeEmail,
} from './newsletter-contract';
import {
  NEWSLETTER_GLOBAL_MAX_ATTEMPTS,
  NEWSLETTER_GLOBAL_WINDOW_SECONDS,
  registerNewsletterConsent,
  RESEND_FETCH_TIMEOUT_MS,
  syncToResend,
} from './newsletter';

describe('newsletter consent contract', () => {
  it('normalizes email addresses before they are persisted', () => {
    expect(normalizeEmail('  Person@Example.COM ')).toBe('person@example.com');
  });

  it.each(['person@example.com', 'person+devfest@example.co.uk'])(
    'accepts a valid email: %s',
    (email) => {
      expect(isValidNewsletterEmail(email)).toBe(true);
    },
  );

  it.each(['person@example', 'person@', 'person example.com'])(
    'rejects an invalid email: %s',
    (email) => {
      expect(isValidNewsletterEmail(email)).toBe(false);
    },
  );

  it('requires explicit consent with the current source and wording version', () => {
    expect(
      hasValidNewsletterConsent({
        consentGiven: true,
        consentSource: NEWSLETTER_CONSENT_SOURCE,
        consentVersion: NEWSLETTER_CONSENT_VERSION,
      }),
    ).toBe(true);

    expect(
      hasValidNewsletterConsent({
        consentGiven: false,
        consentSource: NEWSLETTER_CONSENT_SOURCE,
        consentVersion: NEWSLETTER_CONSENT_VERSION,
      }),
    ).toBe(false);
    expect(
      hasValidNewsletterConsent({
        consentGiven: true,
        consentSource: 'unknown_source',
        consentVersion: NEWSLETTER_CONSENT_VERSION,
      }),
    ).toBe(false);
    expect(
      hasValidNewsletterConsent({
        consentGiven: true,
        consentSource: NEWSLETTER_CONSENT_SOURCE,
        consentVersion: 'old-version',
      }),
    ).toBe(false);
  });

  it('configures bounded runtime options and a 300/hour global rate limit', () => {
    expect(NEWSLETTER_GLOBAL_MAX_ATTEMPTS).toBe(300);
    expect(NEWSLETTER_GLOBAL_WINDOW_SECONDS).toBe(3600);
    expect(RESEND_FETCH_TIMEOUT_MS).toBe(8000);
    expect(mockRunWith).toHaveBeenCalledWith({
      secrets: ['RESEND_API_KEY'],
      maxInstances: 2,
      timeoutSeconds: 15,
      memory: '256MB',
    });
    const runtimeOpts = (
      registerNewsletterConsent as unknown as { runtimeOpts?: Record<string, unknown> }
    ).runtimeOpts;
    expect(runtimeOpts?.maxInstances).toBe(2);
    expect(runtimeOpts?.timeoutSeconds).toBe(15);
    expect(runtimeOpts?.memory).toBe('256MB');
  });

  it('aborts hung Resend API calls after the configured timeout', async () => {
    const fetchFn = jest.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>(
          (_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
          },
        ),
    );

    await expect(
      syncToResend('person@example.com', 'Ada', 'Lovelace', {
        apiKey: 're_test_key',
        fetchFn,
        timeoutMs: 25,
      }),
    ).rejects.toThrow('Aborted');
  });
});
