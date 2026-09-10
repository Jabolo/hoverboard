import crypto from 'crypto';

export const NEWSLETTER_CONSENT_SOURCE = 'devfest_website';
export const NEWSLETTER_CONSENT_VERSION = '2026-09-10';

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const hashEmail = (email: string) =>
  crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex');

export const isValidNewsletterEmail = (email: string) =>
  /^[^@\s]+@[^@\s.]+(?:\.[^@\s.]+)+$/.test(email);

export type NewsletterConsentInput = {
  email?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  consentGiven?: unknown;
  consentSource?: unknown;
  consentVersion?: unknown;
};

export const hasValidNewsletterConsent = (data?: NewsletterConsentInput) =>
  data?.consentGiven === true &&
  data?.consentSource === NEWSLETTER_CONSENT_SOURCE &&
  data?.consentVersion === NEWSLETTER_CONSENT_VERSION;
