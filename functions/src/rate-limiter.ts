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
  socket?: { remoteAddress?: string };
  connection?: { remoteAddress?: string };
}): string => {
  if (!rawRequest) return 'unknown';

  const headers = rawRequest.headers;
  let forwarded: string | string[] | undefined = headers?.['x-forwarded-for'];
  if (forwarded === undefined && headers) {
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === 'x-forwarded-for') {
        forwarded = value;
        break;
      }
    }
  }

  // Google Frontend (GFE) appends the true client/proxy IP to the RIGHT of X-Forwarded-For.
  // Never trust the leftmost entry or raw fastly-client-ip because callers can spoof them.
  const forwardedValues = Array.isArray(forwarded)
    ? forwarded.flatMap((entry) => entry.split(','))
    : typeof forwarded === 'string'
      ? forwarded.split(',')
      : [];
  const cleanedHops = forwardedValues.map((part) => part.trim()).filter(Boolean);
  if (cleanedHops.length > 0) {
    return cleanedHops[cleanedHops.length - 1]!;
  }

  if (
    typeof rawRequest.socket?.remoteAddress === 'string' &&
    rawRequest.socket.remoteAddress.trim().length > 0
  ) {
    return rawRequest.socket.remoteAddress.trim();
  }

  if (
    typeof rawRequest.connection?.remoteAddress === 'string' &&
    rawRequest.connection.remoteAddress.trim().length > 0
  ) {
    return rawRequest.connection.remoteAddress.trim();
  }

  if (typeof rawRequest.ip === 'string' && rawRequest.ip.trim().length > 0) {
    return rawRequest.ip.trim();
  }

  return 'unknown';
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

export type ShardedRateLimitOptions = RateLimitOptions & {
  shards: number;
  shardIndex?: number;
};

const RATE_LIMIT_TTL_GRACE_MS = 24 * 60 * 60 * 1000;

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
        ttlAt: Timestamp.fromMillis(resetAtMillis + RATE_LIMIT_TTL_GRACE_MS),
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

export const checkShardedRateLimit = async ({
  shards,
  shardIndex,
  maxAttempts,
  key,
  ...rest
}: ShardedRateLimitOptions): Promise<RateLimitResult> => {
  const normalizedShards = Math.max(1, Math.floor(shards));
  const selectedShard =
    typeof shardIndex === 'number' && Number.isFinite(shardIndex)
      ? Math.abs(Math.floor(shardIndex)) % normalizedShards
      : Math.floor(Math.random() * normalizedShards);
  const perShardLimit = Math.max(1, Math.ceil(maxAttempts / normalizedShards));

  return checkRateLimit({
    ...rest,
    key: `${key}:shard:${selectedShard}`,
    maxAttempts: perShardLimit,
  });
};

export type InMemoryRateLimiter = {
  check: (key: string, nowMs?: number) => RateLimitResult;
  clear: () => void;
};

export const createInMemoryRateLimiter = (options: {
  maxAttempts: number;
  windowMs: number;
  maxEntries?: number;
}): InMemoryRateLimiter => {
  const { maxAttempts, windowMs, maxEntries = 2000 } = options;
  const buckets = new Map<string, { attempts: number; resetAtMs: number }>();

  return {
    check(key: string, nowMs = Date.now()): RateLimitResult {
      const existing = buckets.get(key);
      let attempts = 0;
      let resetAtMs = nowMs + windowMs;

      if (existing && existing.resetAtMs > nowMs) {
        attempts = existing.attempts;
        resetAtMs = existing.resetAtMs;
      }

      if (attempts >= maxAttempts) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(resetAtMs),
        };
      }

      if (!existing && buckets.size >= maxEntries) {
        const oldestKey = buckets.keys().next().value;
        if (oldestKey !== undefined) {
          buckets.delete(oldestKey);
        }
      }

      const nextAttempts = attempts + 1;
      buckets.set(key, { attempts: nextAttempts, resetAtMs });
      return {
        allowed: true,
        remaining: Math.max(0, maxAttempts - nextAttempts),
        resetAt: new Date(resetAtMs),
      };
    },
    clear() {
      buckets.clear();
    },
  };
};
