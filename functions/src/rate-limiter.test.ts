import { describe, expect, it } from '@jest/globals';
import { checkRateLimit, getClientIp, hashKey } from './rate-limiter';

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
    it('prioritizes fastly-client-ip header', () => {
      const req = {
        headers: {
          'fastly-client-ip': '203.0.113.195',
          'x-forwarded-for': '198.51.100.1, 192.0.2.1',
        },
        ip: '10.0.0.1',
      };
      expect(getClientIp(req)).toBe('203.0.113.195');
    });

    it('extracts client IP from x-forwarded-for header', () => {
      const req = {
        headers: {
          'x-forwarded-for': ' 198.51.100.42 , 192.0.2.1 ',
        },
        ip: '10.0.0.1',
      };
      expect(getClientIp(req)).toBe('198.51.100.42');
    });

    it('falls back to rawRequest.ip or connection address', () => {
      expect(getClientIp({ ip: '192.168.0.50' })).toBe('192.168.0.50');
      expect(getClientIp({ connection: { remoteAddress: '127.0.0.1' } })).toBe('127.0.0.1');
      expect(getClientIp(undefined)).toBe('unknown');
    });
  });

  describe('checkRateLimit', () => {
    const createMockDb = (initialData: any = null) => {
      let storedData = initialData ? { ...initialData } : null;
      let setPayload: any = null;

      const mockDocRef = {
        id: 'mockDocId',
      };

      const mockDb: any = {
        collection: () => ({
          doc: () => mockDocRef,
        }),
        runTransaction: async (cb: any) => {
          const transaction = {
            get: async () => ({
              exists: !!storedData,
              data: () => storedData,
            }),
            set: (_ref: any, data: any) => {
              setPayload = data;
              storedData = { ...storedData, ...data };
            },
          };
          return await cb(transaction);
        },
        getStoredData: () => storedData,
        getSetPayload: () => setPayload,
      };

      return mockDb;
    };

    it('allows the first request and sets resetAt', async () => {
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
  });
});
