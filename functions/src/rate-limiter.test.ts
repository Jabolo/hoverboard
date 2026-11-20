import { describe, expect, it } from '@jest/globals';
import {
  checkRateLimit,
  checkShardedRateLimit,
  createInMemoryRateLimiter,
  getClientIp,
  hashKey,
} from './rate-limiter';

describe('rate-limiter utilities', () => {
  describe('hashKey', () => {
    it('produces deterministic sha256 hash for normalized keys', () => {
      const h1 = hashKey('ip', ' 192.168.1.1 ');
      const h2 = hashKey('ip', '192.168.1.1');
      expect(h1).toBe(h2);
      expect(h1).toHaveLength(64);
    });

    it('differentiates different prefixes or keys', () => {
      expect(hashKey('ip', '1.1.1.1')).not.toBe(hashKey('email', '1.1.1.1'));
      expect(hashKey('ip', '1.1.1.1')).not.toBe(hashKey('ip', '1.1.1.2'));
    });
  });

  describe('getClientIp', () => {
    it('extracts the rightmost unspoofable hop from x-forwarded-for, ignoring leftmost spoofed IP, raw fastly-client-ip, and Express req.ip', () => {
      const req = {
        headers: {
          'fastly-client-ip': '203.0.113.195',
          'x-forwarded-for': '1.2.3.4, 198.51.100.1, 192.0.2.1',
        },
        ip: '1.2.3.4',
      };
      expect(getClientIp(req)).toBe('192.0.2.1');
    });

    it('handles array and mixed-case x-forwarded-for headers using the rightmost non-empty IP', () => {
      expect(
        getClientIp({
          headers: {
            'X-Forwarded-For': [' 1.2.3.4 , 198.51.100.42 ', ' 203.0.113.77 , '],
          },
        }),
      ).toBe('203.0.113.77');
    });

    it('falls back to socket/connection remoteAddress then req.ip only when x-forwarded-for is absent', () => {
      expect(
        getClientIp({
          headers: { 'fastly-client-ip': '203.0.113.195' },
          socket: { remoteAddress: '10.0.0.5' },
          ip: '192.168.0.50',
        }),
      ).toBe('10.0.0.5');
      expect(getClientIp({ connection: { remoteAddress: '127.0.0.1' } })).toBe('127.0.0.1');
      expect(getClientIp({ ip: '192.168.0.50' })).toBe('192.168.0.50');
      expect(getClientIp(undefined)).toBe('unknown');
    });
  });

  describe('checkRateLimit', () => {
    const createMockDb = (initialData: any = null) => {
      const store = new Map<string, any>();
      if (initialData) {
        store.set('mockDocId', { ...initialData });
      }
      let lastDocId: string | null = null;
      let setPayload: any = null;

      const mockDb: any = {
        collection: () => ({
          doc: (id: string) => ({ id }),
        }),
        runTransaction: async (cb: any) => {
          const transaction = {
            get: async (ref: { id: string }) => {
              const data = store.get(ref.id) ?? store.get('mockDocId') ?? null;
              return {
                exists: !!data,
                data: () => data,
              };
            },
            set: (ref: { id: string }, data: any) => {
              lastDocId = ref.id;
              setPayload = data;
              const prev = store.get(ref.id) || {};
              store.set(ref.id, { ...prev, ...data });
            },
          };
          return await cb(transaction);
        },
        getLastDocId: () => lastDocId,
        getSetPayload: () => setPayload,
      };

      return mockDb;
    };

    it('allows the first request, sets resetAt, and sets ttlAt to resetAt + 24h', async () => {
      const now = new Date('2026-09-15T12:00:00Z');
      const db = createMockDb();

      const result = await checkRateLimit({
        db,
        prefix: 'newsletter_ip',
        key: '1.2.3.4',
        maxAttempts: 5,
        windowSeconds: 600,
        now,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetAt.toISOString()).toBe('2026-09-15T12:10:00.000Z');
      expect(db.getSetPayload().attempts).toBe(1);
      expect(db.getSetPayload().ttlAt.toMillis()).toBe(
        new Date('2026-09-16T12:10:00.000Z').getTime(),
      );
    });

    it('blocks request when limit is reached within window', async () => {
      const now = new Date('2026-09-15T12:05:00Z');
      const resetAtMillis = new Date('2026-09-15T12:10:00Z').getTime();
      const db = createMockDb({
        attempts: 5,
        resetAt: { toMillis: () => resetAtMillis },
      });

      const result = await checkRateLimit({
        db,
        prefix: 'newsletter_ip',
        key: '1.2.3.4',
        maxAttempts: 5,
        windowSeconds: 600,
        now,
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.resetAt.toISOString()).toBe('2026-09-15T12:10:00.000Z');
    });

    it('resets attempts when window has expired', async () => {
      const now = new Date('2026-09-15T12:15:00Z');
      const expiredResetAtMillis = new Date('2026-09-15T12:10:00Z').getTime();
      const db = createMockDb({
        attempts: 5,
        resetAt: { toMillis: () => expiredResetAtMillis },
      });

      const result = await checkRateLimit({
        db,
        prefix: 'newsletter_ip',
        key: '1.2.3.4',
        maxAttempts: 5,
        windowSeconds: 600,
        now,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetAt.toISOString()).toBe('2026-09-15T12:25:00.000Z');
      expect(db.getSetPayload().attempts).toBe(1);
    });

    it('distributes sharded global counters across shard doc IDs with per-shard ceiling', async () => {
      const now = new Date('2026-11-21T10:00:00Z');
      const db = createMockDb();

      const res0 = await checkShardedRateLimit({
        db,
        prefix: 'concierge-chat-global-24h',
        key: 'devfest-2026-sponsored',
        maxAttempts: 4000,
        windowSeconds: 86400,
        shards: 10,
        shardIndex: 2,
        now,
      });

      expect(res0.allowed).toBe(true);
      expect(res0.remaining).toBe(399);
      expect(db.getLastDocId()).toBe(
        hashKey('concierge-chat-global-24h', 'devfest-2026-sponsored:shard:2'),
      );
    });
  });

  describe('createInMemoryRateLimiter', () => {
    it('enforces window limits, resets after expiry, and caps stored keys', () => {
      const limiter = createInMemoryRateLimiter({ maxAttempts: 2, windowMs: 1000, maxEntries: 2 });
      expect(limiter.check('ip-a', 1000).allowed).toBe(true);
      expect(limiter.check('ip-a', 1100).allowed).toBe(true);
      expect(limiter.check('ip-a', 1200).allowed).toBe(false);
      expect(limiter.check('ip-a', 2001).allowed).toBe(true);

      // Eviction cap prevents unbounded growth
      expect(limiter.check('ip-b', 2001).allowed).toBe(true);
      expect(limiter.check('ip-c', 2001).allowed).toBe(true);
      limiter.clear();
      expect(limiter.check('ip-a', 2001).remaining).toBe(1);
    });
  });
});
