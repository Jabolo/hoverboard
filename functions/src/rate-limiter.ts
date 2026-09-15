import crypto from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

export const hashKey = (prefix: string, key: string): string => {
  return crypto.createHash('sha256').update(`${prefix}:${key.trim().toLowerCase()}`).digest('hex');
};

export const getClientIp = (rawRequest?: {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  connection?: { remoteAddress?: string };
}): string => {
  if (!rawRequest) return 'unknown';

  if (typeof rawRequest.ip === 'string' && rawRequest.ip.trim().length > 0) {
    return rawRequest.ip.trim();
  }

  const fastlyIp = rawRequest.headers?.['fastly-client-ip'];
  if (typeof fastlyIp === 'string' && fastlyIp.trim().length > 0) {
    return fastlyIp.trim();
  }

  const forwarded = rawRequest.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].trim();
  }

  return rawRequest.connection?.remoteAddress || 'unknown';
};

export type RateLimitOptions = {
  db: Firestore;
  prefix: string;
  key: string;
  maxAttempts: number;
  windowSeconds: number;
  collectionName?: string;
  now?: Date;
};

export const checkRateLimit = async ({
  db,
  prefix,
  key,
  maxAttempts,
  windowSeconds,
  collectionName = 'functionsRateLimits',
  now = new Date(),
}: RateLimitOptions): Promise<RateLimitResult> => {
  const docId = hashKey(prefix, key);
  const docRef = db.collection(collectionName).doc(docId);
  const currentMillis = now.getTime();

  return await db.runTransaction(async (transaction) => {
    const docSnap = await transaction.get(docRef);
    const data = docSnap.exists ? docSnap.data() : null;

    let resetAtMillis = currentMillis + windowSeconds * 1000;
    let attempts = 0;

    if (data && data.resetAt && typeof data.resetAt.toMillis === 'function') {
      const existingResetAtMillis = data.resetAt.toMillis();
      if (existingResetAtMillis > currentMillis) {
        resetAtMillis = existingResetAtMillis;
        attempts = typeof data.attempts === 'number' ? data.attempts : 0;
      }
    }

    if (attempts >= maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(resetAtMillis),
      };
    }

    const nextAttempts = attempts + 1;
    const remaining = Math.max(0, maxAttempts - nextAttempts);
    const resetAtDate = new Date(resetAtMillis);

    transaction.set(
      docRef,
      {
        attempts: nextAttempts,
        prefix,
        resetAt: Timestamp.fromMillis(resetAtMillis),
        updatedAt: Timestamp.fromMillis(currentMillis),
      },
      { merge: true },
    );

    return {
      allowed: true,
      remaining,
      resetAt: resetAtDate,
    };
  });
};
