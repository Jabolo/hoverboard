import { describe, expect, it, jest } from '@jest/globals';

jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import {
  hasValidNewsletterConsent,
  isValidNewsletterEmail,
  NEWSLETTER_CONSENT_SOURCE,
  NEWSLETTER_CONSENT_VERSION,
  normalizeEmail,
} from './newsletter-contract';

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
});
