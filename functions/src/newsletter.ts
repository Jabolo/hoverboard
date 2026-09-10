import crypto from 'crypto';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions';
import fetch from 'node-fetch';

const CONSENT_SOURCE = 'devfest_website';
const CONSENT_VERSION = '2026-09-10';
const RESEND_CONTACTS_URL = 'https://api.resend.com/contacts';

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const hashEmail = (email: string) =>
  crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex');

const validEmail = (email: string) => /^[^@\s]+@[^@\s.]+\.[^@.\s]+$/.test(email);

type NewsletterConsentInput = {
  email?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  consentGiven?: unknown;
  consentSource?: unknown;
  consentVersion?: unknown;
};

type ResendSyncResult = {
  status: 'synced' | 'suppressed' | 'pending' | 'failed';
  detail?: string;
};

const getResendApiKey = () => process.env.RESEND_API_KEY || '';

const resendHeaders = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
});

const syncToResend = async (
  email: string,
  firstName: string,
  lastName: string,
): Promise<ResendSyncResult> => {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    return { status: 'pending', detail: 'resend_not_configured' };
  }

  const headers = resendHeaders(apiKey);
  const contactUrl = `${RESEND_CONTACTS_URL}/${encodeURIComponent(email)}`;
  const existingResponse = await fetch(contactUrl, { headers });

  if (existingResponse.ok) {
    const existing = (await existingResponse.json()) as { unsubscribed?: boolean };
    if (existing.unsubscribed) {
      return { status: 'suppressed', detail: 'resend_global_unsubscribe' };
    }

    const updateResponse = await fetch(contactUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ firstName, lastName }),
    });

    if (!updateResponse.ok) {
      return { status: 'failed', detail: `resend_update_${updateResponse.status}` };
    }

    return { status: 'synced' };
  }

  if (existingResponse.status !== 404) {
    return { status: 'failed', detail: `resend_lookup_${existingResponse.status}` };
  }

  const createResponse = await fetch(RESEND_CONTACTS_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, firstName, lastName, unsubscribed: false }),
  });

  if (!createResponse.ok && createResponse.status !== 409) {
    return { status: 'failed', detail: `resend_create_${createResponse.status}` };
  }

  return { status: 'synced' };
};

export const registerNewsletterConsent = functions.https.onCall(
  async (data: NewsletterConsentInput) => {
    const email = typeof data?.email === 'string' ? normalizeEmail(data.email) : '';
    const firstName = typeof data?.firstName === 'string' ? data.firstName.trim() : '';
    const lastName = typeof data?.lastName === 'string' ? data.lastName.trim() : '';

    if (!validEmail(email) || email.length > 320) {
      throw new functions.https.HttpsError('invalid-argument', 'A valid email is required.');
    }
    if (firstName.length > 120 || lastName.length > 120) {
      throw new functions.https.HttpsError('invalid-argument', 'Name is too long.');
    }
    if (
      data?.consentGiven !== true ||
      data?.consentSource !== CONSENT_SOURCE ||
      data?.consentVersion !== CONSENT_VERSION
    ) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Valid newsletter consent is required.',
      );
    }

    const now = Timestamp.now();
    const contactRef = getFirestore().collection('newsletterContacts').doc(hashEmail(email));
    const sourceTrace = {
      [CONSENT_SOURCE]: {
        status: 'granted',
        version: CONSENT_VERSION,
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
        consentSource: CONSENT_SOURCE,
        consentVersion: CONSENT_VERSION,
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
  },
);
