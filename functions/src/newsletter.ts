import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v1';
import fetch from 'node-fetch';
import {
  NEWSLETTER_CONSENT_SOURCE,
  NEWSLETTER_CONSENT_VERSION,
  hashEmail,
  hasValidNewsletterConsent,
  isValidNewsletterEmail,
  normalizeEmail,
  type NewsletterConsentInput,
} from './newsletter-contract.js';
import { checkRateLimit, getClientIp, hashKey } from './rate-limiter.js';

export {
  NEWSLETTER_CONSENT_SOURCE,
  NEWSLETTER_CONSENT_VERSION,
  hashEmail,
  hasValidNewsletterConsent,
  isValidNewsletterEmail,
  normalizeEmail,
} from './newsletter-contract.js';

const RESEND_CONTACTS_URL = 'https://api.resend.com/contacts';
export const RESEND_FETCH_TIMEOUT_MS = 8_000;
export const NEWSLETTER_GLOBAL_MAX_ATTEMPTS = 300;
export const NEWSLETTER_GLOBAL_WINDOW_SECONDS = 3600;

export type ResendSyncResult = {
  status: 'synced' | 'suppressed' | 'pending' | 'failed';
  detail?: string;
};

const getResendApiKey = () => (process.env.RESEND_API_KEY || '').trim();

const resendHeaders = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
});

type ResendFetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
};

type ResendFetchFn = (
  url: string,
  init?: ResendFetchInit,
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const fetchWithTimeout = async (
  fetchImpl: ResendFetchFn,
  url: string,
  init: Omit<ResendFetchInit, 'signal'>,
  timeoutMs: number,
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

export const syncToResend = async (
  email: string,
  firstName: string,
  lastName: string,
  options?: {
    apiKey?: string;
    fetchFn?: ResendFetchFn;
    timeoutMs?: number;
  },
): Promise<ResendSyncResult> => {
  const apiKey = (options?.apiKey ?? getResendApiKey()).trim();
  if (!apiKey) {
    return { status: 'pending', detail: 'resend_not_configured' };
  }

  const fetchImpl: ResendFetchFn =
    options?.fetchFn ?? ((url, init) => fetch(url, init as Parameters<typeof fetch>[1]));
  const timeoutMs = options?.timeoutMs ?? RESEND_FETCH_TIMEOUT_MS;
  const headers = resendHeaders(apiKey);
  const contactUrl = `${RESEND_CONTACTS_URL}/${encodeURIComponent(email)}`;
  const existingResponse = await fetchWithTimeout(fetchImpl, contactUrl, { headers }, timeoutMs);

  if (existingResponse.ok) {
    const existing = (await existingResponse.json()) as { unsubscribed?: boolean };
    if (existing.unsubscribed) {
      return { status: 'suppressed', detail: 'resend_global_unsubscribe' };
    }

    const updateResponse = await fetchWithTimeout(
      fetchImpl,
      contactUrl,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ first_name: firstName, last_name: lastName }),
      },
      timeoutMs,
    );

    if (!updateResponse.ok) {
      return { status: 'failed', detail: `resend_update_${updateResponse.status}` };
    }

    return { status: 'synced' };
  }

  if (existingResponse.status !== 404) {
    return { status: 'failed', detail: `resend_lookup_${existingResponse.status}` };
  }

  const createResponse = await fetchWithTimeout(
    fetchImpl,
    RESEND_CONTACTS_URL,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        first_name: firstName,
        last_name: lastName,
        unsubscribed: false,
      }),
    },
    timeoutMs,
  );

  if (!createResponse.ok && createResponse.status !== 409) {
    return { status: 'failed', detail: `resend_create_${createResponse.status}` };
  }

  return { status: 'synced' };
};

export const registerNewsletterConsent = functions
  .runWith({
    secrets: ['RESEND_API_KEY'],
    maxInstances: 2,
    timeoutSeconds: 15,
    memory: '256MB',
  })
  .https.onCall(async (data: NewsletterConsentInput, context: functions.https.CallableContext) => {
    if (process.env.ENFORCE_APP_CHECK === 'true' && !context.app) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'App Check verification is required.',
      );
    }

    const email = typeof data?.email === 'string' ? normalizeEmail(data.email) : '';
    const firstName = typeof data?.firstName === 'string' ? data.firstName.trim() : '';
    const lastName = typeof data?.lastName === 'string' ? data.lastName.trim() : '';

    if (!isValidNewsletterEmail(email) || email.length > 320) {
      throw new functions.https.HttpsError('invalid-argument', 'A valid email is required.');
    }
    if (firstName.length > 120 || lastName.length > 120) {
      throw new functions.https.HttpsError('invalid-argument', 'Name is too long.');
    }
    if (!hasValidNewsletterConsent(data)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Valid newsletter consent is required.',
      );
    }

    const db = getFirestore();
    const clientIp = getClientIp(context?.rawRequest);
    const ipLogHash = hashKey('newsletter_log', clientIp).slice(0, 12);

    // Rate limit: max 5 requests per 10 minutes per IP
    const ipLimit = await checkRateLimit({
      db,
      prefix: 'newsletter_ip',
      key: clientIp,
      maxAttempts: 5,
      windowSeconds: 600,
    });

    if (!ipLimit.allowed) {
      functions.logger.warn(`Rate limit exceeded for IP hash: ${ipLogHash}`);
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Too many newsletter registration attempts. Please try again in a few minutes.',
      );
    }

    // Rate limit: max 3 requests per 10 minutes for the same email
    const emailLimit = await checkRateLimit({
      db,
      prefix: 'newsletter_email',
      key: email,
      maxAttempts: 3,
      windowSeconds: 600,
    });

    if (!emailLimit.allowed) {
      functions.logger.warn(`Rate limit exceeded for email: ${hashEmail(email)}`);
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Too many attempts for this email address. Please try again later.',
      );
    }

    // Global rate limit: max 300 registrations per hour
    const globalLimit = await checkRateLimit({
      db,
      prefix: 'newsletter_global',
      key: 'devfest-2026',
      maxAttempts: NEWSLETTER_GLOBAL_MAX_ATTEMPTS,
      windowSeconds: NEWSLETTER_GLOBAL_WINDOW_SECONDS,
    });

    if (!globalLimit.allowed) {
      functions.logger.warn('Global newsletter registration rate limit exceeded.');
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Newsletter registrations are temporarily busy. Please try again later.',
      );
    }

    const now = Timestamp.now();
    const contactRef = getFirestore().collection('newsletterContacts').doc(hashEmail(email));
    const sourceTrace = {
      [NEWSLETTER_CONSENT_SOURCE]: {
        status: 'granted',
        version: NEWSLETTER_CONSENT_VERSION,
        consentAt: now,
      },
    };

    await contactRef.set(
      {
        email,
        firstName,
        lastName,
        status: 'subscribed',
        purpose: 'gdg_community_marketing',
        consentSource: NEWSLETTER_CONSENT_SOURCE,
        consentVersion: NEWSLETTER_CONSENT_VERSION,
        consentAt: now,
        sourceTrace,
        updatedAt: now,
      },
      { merge: true },
    );

    let syncResult: ResendSyncResult;
    try {
      syncResult = await syncToResend(email, firstName, lastName);
    } catch (error) {
      functions.logger.error('Newsletter provider sync failed.', error);
      syncResult = { status: 'failed', detail: 'resend_request_failed' };
    }

    await contactRef.set(
      {
        provider: {
          name: 'resend',
          status: syncResult.status,
          detail: syncResult.detail || null,
          updatedAt: Timestamp.now(),
        },
        ...(syncResult.status === 'suppressed' ? { status: 'suppressed' } : {}),
      },
      { merge: true },
    );

    return { ok: true };
  });
