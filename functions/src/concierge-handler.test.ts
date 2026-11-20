import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

jest.mock('./rate-limiter.js', () => require('./rate-limiter'), { virtual: true });

import {
  CANONICAL_TEAM,
  clearConciergeCache,
  getServerScheduleSlot,
  handleConcierge,
} from './concierge-handler';

function createMockResponse() {
  const res = {
    headers: {} as Record<string, string>,
    code: 200,
    body: undefined as unknown,
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
  };
  return res;
}

function createMockDb(initialDocs: Record<string, Record<string, unknown>> = {}): Firestore {
  const store = new Map<string, Record<string, unknown>>(Object.entries(initialDocs));

  const makeDocRef = (path: string) => ({
    path,
  });

  return {
    collection(collectionName: string) {
      return {
        doc(docId: string) {
          return makeDocRef(`${collectionName}/${docId}`);
        },
      };
    },
    async runTransaction<T>(
      fn: (tx: {
        get: (ref: {
          path: string;
        }) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
        set: (ref: { path: string }, data: Record<string, unknown>) => void;
      }) => Promise<T>,
    ): Promise<T> {
      const tx = {
        get: async (ref: { path: string }) => {
          const data = store.get(ref.path);
          return {
            exists: data !== undefined,
            data: () => data,
          };
        },
        set: (ref: { path: string }, data: Record<string, unknown>) => {
          const existing = store.get(ref.path) || {};
          store.set(ref.path, { ...existing, ...data });
        },
      };
      return fn(tx);
    },
  } as unknown as Firestore;
}

function makeRequest(overrides: Partial<Request> = {}) {
  return {
    method: 'POST',
    body: { query: 'Build me an AI track' },
    headers: {},
    ip: '127.0.0.1',
    ...overrides,
  } as unknown as Request;
}

const VALID_PLAN = {
  title: 'AI & Agents Track',
  subtitle: 'Non-overlapping picks',
  badge: 'A2UI · Gemini 3.5 Flash-Lite',
  banner: {
    tone: 'info',
    kicker: 'AI Track',
    title: 'Curated AI & Agents Schedule',
    body: 'Practical talks and workshops across Auditorium and Classroom.',
  },
  sessionRecommendations: [
    { sessionId: 'CFP-021', reason: 'Strong opening talk on agentic PRs in production.' },
    { sessionId: 'FAKE-999', reason: 'Hallucinated session that must be dropped.' },
    { sessionId: 'scaling-hugging-face-hub', reason: 'Real-world ML infrastructure scaling.' },
  ],
  comparison: {
    title: 'Morning Parallel Slots',
    columns: [
      {
        badge: 'Auditorium',
        heading: 'Agents Talk',
        summary: '30-min talk on automated verification.',
        bestFor: 'Engineering leads',
        sessionId: 'CFP-021',
      },
      {
        badge: 'Classroom',
        heading: 'Browser AI Workshop',
        summary: '40-min hands-on Prompt API workshop.',
        bestFor: 'Frontend devs',
        sessionId: 'INVITED-004',
      },
    ],
  },
  creditGuide: {
    title: '$5 Google Cloud Credits',
    statusSummary: 'Claimable on event day from 09:00 to 19:00 Warsaw time.',
    steps: ['Bring your laptop', 'Claim between 09:00 and 19:00 Warsaw time'],
  },
  logistics: {
    title: 'Campus Info',
    items: [
      { label: 'Venue', value: 'Google for Startups Campus Warsaw, Plac Konesera 10' },
      { label: 'Metro', value: 'Metro M2 Dworzec Wileński' },
    ],
  },
  followUpChips: [
    { label: 'Cloud & Backend', prompt: 'Show Cloud & Backend talks', intent: 'track-cloud' },
  ],
};

describe('handleConcierge', () => {
  beforeEach(() => {
    clearConciergeCache();
  });

  it('rejects non-POST requests with 405 and security headers', async () => {
    const res = createMockResponse();
    await handleConcierge(makeRequest({ method: 'GET' }), res as unknown as Response, {
      getApiKey: () => 'test-key',
    });

    expect(res.code).toBe(405);
    expect(res.headers['Allow']).toBe('POST');
    expect(res.headers['Cache-Control']).toBe('private, no-store, max-age=0');
    expect(res.headers['Referrer-Policy']).toBe('no-referrer');
    expect(res.headers['X-Robots-Tag']).toBe('noindex, nofollow');
  });

  it('returns 400 when both query and intent are empty or body is invalid', async () => {
    const res1 = createMockResponse();
    await handleConcierge(
      makeRequest({ body: { query: '   ', intent: '' } }),
      res1 as unknown as Response,
      {
        getApiKey: () => 'test-key',
      },
    );
    expect(res1.code).toBe(400);
    expect(res1.body).toEqual({ status: 'invalid-request', fallback: 'local-a2ui' });

    const res2 = createMockResponse();
    await handleConcierge(makeRequest({ body: null }), res2 as unknown as Response, {
      getApiKey: () => 'test-key',
    });
    expect(res2.code).toBe(400);
  });

  it('returns 503 when GEMINI_API_KEY is missing', async () => {
    const res = createMockResponse();
    const fetchFn = jest.fn() as unknown as typeof fetch;
    await handleConcierge(makeRequest(), res as unknown as Response, {
      getApiKey: () => '   ',
      fetchFn,
    });

    expect(res.code).toBe(503);
    expect(res.body).toEqual({ status: 'unavailable', fallback: 'local-a2ui' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('calls Gemini Interactions API with Flash-Lite minimal config and sanitized input', async () => {
    const res = createMockResponse();
    const fetchFn = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify(VALID_PLAN),
      }),
    })) as unknown as typeof fetch;

    const longQuery = 'a'.repeat(350);
    const savedSessionIds = ['CFP-021', 'INVITED-004', 'CFP-021', 'x'.repeat(45)];

    await handleConcierge(
      makeRequest({ body: { query: `  ${longQuery}  `, savedSessionIds } }),
      res as unknown as Response,
      {
        now: 1795255200000,
        getApiKey: () => 'secret-gemini-key',
        fetchFn,
      },
    );

    expect(res.code).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const [url, init] = (fetchFn as unknown as jest.Mock).mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1/interactions');
    expect(init.headers['x-goog-api-key']).toBe('secret-gemini-key');
    expect(init.headers['Api-Revision']).toBe('2026-05-20');

    const sentBody = JSON.parse(init.body) as Record<string, unknown>;
    expect(sentBody.model).toBe('gemini-3.5-flash-lite');
    expect(sentBody.store).toBe(false);
    expect(sentBody.generation_config).toEqual({
      thinking_level: 'minimal',
      max_output_tokens: 4096,
    });
    const sentInput = JSON.parse(sentBody.input as string) as {
      query: string;
      savedSessionIds: string[];
    };
    expect(sentInput.query.length).toBe(300);
    expect(sentInput.savedSessionIds).toEqual(['CFP-021', 'INVITED-004']);
  });

  it('hydrates canonical A2UI envelope, drops unknown sessions, and computes conflicts', async () => {
    const res = createMockResponse();
    const fetchFn = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify(VALID_PLAN),
      }),
    })) as unknown as typeof fetch;

    await handleConcierge(
      makeRequest({
        body: { query: 'Build AI track', savedSessionIds: ['CFP-021', 'INVITED-004'] },
      }),
      res as unknown as Response,
      {
        now: 1795255200000,
        getApiKey: () => 'secret-gemini-key',
        fetchFn,
      },
    );

    const body = res.body as {
      status: string;
      model: string;
      thinkingLevel: string;
      messages: Array<Record<string, unknown>>;
    };
    expect(body).toMatchObject({
      status: 'ok',
      model: 'gemini-3.5-flash-lite',
      thinkingLevel: 'minimal',
    });
    expect(body.messages).toHaveLength(3);

    const [createSurface, updateDataModel, updateComponents] = body.messages;
    expect(createSurface).toMatchObject({
      type: 'createSurface',
      source: 'gemini-3.5-flash-lite',
      timestamp: 1795255200000,
    });

    const data = updateDataModel.data as {
      savedSessions: Record<string, boolean>;
      conflicts: Record<string, string>;
    };
    expect(data.savedSessions).toEqual({ 'CFP-021': true, 'INVITED-004': true });
    expect(data.conflicts['CFP-021']).toContain('AI at Zero Token Cost');
    expect(data.conflicts['INVITED-004']).toContain('Written by Agents');

    const components = updateComponents.components as Array<{
      id: string;
      component: string;
      props: Record<string, unknown>;
    }>;
    const sessionCards = components.filter((c) => c.component === 'SessionCard');
    expect(sessionCards.map((c) => c.props.sessionId)).toEqual([
      'CFP-021',
      'scaling-hugging-face-hub',
    ]);
    expect(sessionCards[0].props).toMatchObject({
      href: '/sessions/CFP-021/',
      speakers: ['Yonatan Levin'],
    });
    expect(components.map((c) => c.component)).toEqual(
      expect.arrayContaining([
        'SurfaceContainer',
        'CalloutBanner',
        'ComparisonGrid',
        'CreditGuideCard',
        'LogisticsCard',
        'ActionChipRow',
      ]),
    );
  });

  it('extracts JSON from interaction.steps when output_text is absent', async () => {
    const res = createMockResponse();
    const fetchFn = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        steps: [
          { type: 'thought', text: 'thinking...' },
          { type: 'model_output', text: JSON.stringify(VALID_PLAN) },
        ],
      }),
    })) as unknown as typeof fetch;

    await handleConcierge(makeRequest(), res as unknown as Response, {
      now: 1795255200000,
      getApiKey: () => 'secret-gemini-key',
      fetchFn,
    });

    expect(res.code).toBe(200);
    expect((res.body as { status: string }).status).toBe('ok');
  });

  it('returns 502 on upstream non-OK response or malformed model JSON', async () => {
    const res1 = createMockResponse();
    const fetchFail = jest.fn(async () => ({
      ok: false,
      status: 500,
    })) as unknown as typeof fetch;

    await handleConcierge(makeRequest(), res1 as unknown as Response, {
      getApiKey: () => 'secret-gemini-key',
      fetchFn: fetchFail,
    });
    expect(res1.code).toBe(502);
    expect(res1.body).toEqual({ status: 'upstream-error', fallback: 'local-a2ui' });

    const res2 = createMockResponse();
    const fetchBadJson = jest.fn(async () => ({
      ok: true,
      json: async () => ({ output_text: 'not valid json {' }),
    })) as unknown as typeof fetch;

    await handleConcierge(makeRequest(), res2 as unknown as Response, {
      getApiKey: () => 'secret-gemini-key',
      fetchFn: fetchBadJson,
    });
    expect(res2.code).toBe(502);
    expect(res2.body).toEqual({ status: 'upstream-error', fallback: 'local-a2ui' });
  });

  it('does not put upstream content or exception messages into error logs', async () => {
    const privateText = 'private attendee content';
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const outcomes = [
      async () => ({ ok: false, status: 400, text: async () => privateText }),
      async () => ({ ok: true, json: async () => ({ output_text: privateText }) }),
      async () => {
        throw new Error(privateText);
      },
    ];
    try {
      for (const outcome of outcomes) {
        await handleConcierge(makeRequest(), createMockResponse() as unknown as Response, {
          getApiKey: () => 'test-key',
          fetchFn: outcome as unknown as typeof fetch,
          sleepFn: async () => {},
          bypassCache: true,
        });
        await handleConcierge(
          makeRequest({
            body: { mode: 'transcribe', audio: 'base64audio', mimeType: 'audio/webm' },
          }),
          createMockResponse() as unknown as Response,
          {
            getApiKey: () => 'test-key',
            fetchFn: outcome as unknown as typeof fetch,
            sleepFn: async () => {},
          },
        );
      }
      expect(log).toHaveBeenCalled();
      expect(JSON.stringify(log.mock.calls)).not.toContain(privateText);
    } finally {
      log.mockRestore();
    }
  });

  it('enforces 3000 per-IP limit across query, live-token, and transcribe modes', async () => {
    const now = 1795255200000;
    const { hashKey } = await import('./rate-limiter');
    const ipHashKey = hashKey('concierge-ip', '203.0.113.10');

    const queryFetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ output_text: JSON.stringify(VALID_PLAN) }),
    })) as unknown as typeof fetch;
    const liveTokenFetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ name: 'auth_tokens/test-token-ip' }),
    })) as unknown as typeof fetch;
    const transcribeFetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ output_text: JSON.stringify({ transcript: 'Hello DevFest' }) }),
    })) as unknown as typeof fetch;

    // Fresh IP without x-concierge-client reports 2999 remaining (3000 - 1)
    const freshDb = createMockDb();
    const resFresh = createMockResponse();
    await handleConcierge(makeRequest({ ip: '203.0.113.10' }), resFresh as unknown as Response, {
      now,
      db: freshDb,
      getApiKey: () => 'secret-gemini-key',
      fetchFn: queryFetch,
      bypassCache: true,
    });
    expect(resFresh.code).toBe(200);
    expect(resFresh.headers['X-RateLimit-Remaining']).toBe('2999');
    expect(resFresh.headers['X-RateLimit-Reset']).toBe(String(Math.ceil((now + 900_000) / 1000)));

    // Pre-seed IP at 2997 attempts -> 3 requests left across query, live-token, transcribe
    const nearLimitDb = createMockDb({
      [`functionsRateLimits/${ipHashKey}`]: {
        attempts: 2997,
        resetAt: Timestamp.fromMillis(now + 60_000),
      },
    });

    const res2998 = createMockResponse();
    await handleConcierge(makeRequest({ ip: '203.0.113.10' }), res2998 as unknown as Response, {
      now,
      db: nearLimitDb,
      getApiKey: () => 'secret-gemini-key',
      fetchFn: queryFetch,
      bypassCache: true,
    });
    expect(res2998.code).toBe(200);
    expect(res2998.headers['X-RateLimit-Remaining']).toBe('2');

    const res2999 = createMockResponse();
    await handleConcierge(
      makeRequest({ ip: '203.0.113.10', body: { mode: 'live-token' } }),
      res2999 as unknown as Response,
      {
        now,
        db: nearLimitDb,
        getApiKey: () => 'secret-gemini-key',
        fetchFn: liveTokenFetch,
      },
    );
    expect(res2999.code).toBe(200);
    expect(res2999.headers['X-RateLimit-Remaining']).toBe('1');

    const res3000 = createMockResponse();
    await handleConcierge(
      makeRequest({
        ip: '203.0.113.10',
        body: { mode: 'transcribe', audio: 'UklGRi4AAABXQVZF', mimeType: 'audio/webm' },
      }),
      res3000 as unknown as Response,
      {
        now,
        db: nearLimitDb,
        getApiKey: () => 'secret-gemini-key',
        fetchFn: transcribeFetch,
      },
    );
    expect(res3000.code).toBe(200);
    expect(res3000.headers['X-RateLimit-Remaining']).toBe('0');

    // 3001st attempt is blocked across all three modes
    const resQueryBlocked = createMockResponse();
    await handleConcierge(
      makeRequest({ ip: '203.0.113.10' }),
      resQueryBlocked as unknown as Response,
      {
        now,
        db: nearLimitDb,
        getApiKey: () => 'secret-gemini-key',
        fetchFn: queryFetch,
        bypassCache: true,
      },
    );
    expect(resQueryBlocked.code).toBe(429);
    expect(resQueryBlocked.headers['X-RateLimit-Remaining']).toBe('0');
    expect(resQueryBlocked.body).toMatchObject({
      status: 'rate-limited',
      fallback: 'local-a2ui',
    });

    const resLiveBlocked = createMockResponse();
    await handleConcierge(
      makeRequest({ ip: '203.0.113.10', body: { mode: 'live-token' } }),
      resLiveBlocked as unknown as Response,
      {
        now,
        db: nearLimitDb,
        getApiKey: () => 'secret-gemini-key',
        fetchFn: liveTokenFetch,
      },
    );
    expect(resLiveBlocked.code).toBe(429);
    expect(resLiveBlocked.headers['X-RateLimit-Remaining']).toBe('0');
    expect(resLiveBlocked.body).toMatchObject({
      status: 'rate-limited',
      error: 'Rate limit exceeded',
    });

    const resTranscribeBlocked = createMockResponse();
    await handleConcierge(
      makeRequest({
        ip: '203.0.113.10',
        body: { mode: 'transcribe', audio: 'UklGRi4AAABXQVZF', mimeType: 'audio/webm' },
      }),
      resTranscribeBlocked as unknown as Response,
      {
        now,
        db: nearLimitDb,
        getApiKey: () => 'secret-gemini-key',
        fetchFn: transcribeFetch,
      },
    );
    expect(resTranscribeBlocked.code).toBe(429);
    expect(resTranscribeBlocked.headers['X-RateLimit-Remaining']).toBe('0');
    expect(resTranscribeBlocked.body).toMatchObject({
      status: 'rate-limited',
      error: 'Rate limit exceeded',
    });
  });

  it('enforces 80 per-client rate limit when valid x-concierge-client is sent and falls back to IP-only when missing or invalid', async () => {
    const now = 1795255200000;
    const db = createMockDb();
    const fetchFn = jest.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('/v1beta/auth_tokens')) {
        return { ok: true, status: 200, json: async () => ({ name: 'auth_tokens/tok-client' }) };
      }
      if (u.includes('/v1beta/interactions')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ output_text: JSON.stringify({ transcript: 'Voice query' }) }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ output_text: JSON.stringify(VALID_PLAN) }),
      };
    }) as unknown as typeof fetch;

    const clientA = 'tab-client-aaaa-123456';
    const clientB = 'tab-client-bbbb-654321';

    // First request with valid lowercase header -> 79 remaining (80 - 1)
    const resFirst = createMockResponse();
    await handleConcierge(
      makeRequest({ ip: '198.51.100.5', headers: { 'x-concierge-client': clientA } }),
      resFirst as unknown as Response,
      { now, db, getApiKey: () => 'secret-gemini-key', fetchFn, bypassCache: true },
    );
    expect(resFirst.code).toBe(200);
    expect(resFirst.headers['X-RateLimit-Remaining']).toBe('79');

    // Array header value is handled cleanly and shares the same client bucket
    const resArray = createMockResponse();
    await handleConcierge(
      makeRequest({ ip: '198.51.100.5', headers: { 'x-concierge-client': [clientA, 'ignored'] } }),
      resArray as unknown as Response,
      { now, db, getApiKey: () => 'secret-gemini-key', fetchFn, bypassCache: true },
    );
    expect(resArray.code).toBe(200);
    expect(resArray.headers['X-RateLimit-Remaining']).toBe('78');

    // Exhaust remaining 78 attempts for clientA across modes
    for (let i = 0; i < 76; i += 1) {
      const r = createMockResponse();
      await handleConcierge(
        makeRequest({ ip: '198.51.100.5', headers: { 'x-concierge-client': clientA } }),
        r as unknown as Response,
        { now, db, getApiKey: () => 'secret-gemini-key', fetchFn, bypassCache: true },
      );
      expect(r.code).toBe(200);
    }
    const res79 = createMockResponse();
    await handleConcierge(
      makeRequest({
        ip: '198.51.100.5',
        headers: { 'x-concierge-client': clientA },
        body: { mode: 'live-token' },
      }),
      res79 as unknown as Response,
      { now, db, getApiKey: () => 'secret-gemini-key', fetchFn },
    );
    expect(res79.code).toBe(200);
    expect(res79.headers['X-RateLimit-Remaining']).toBe('1');

    const res80 = createMockResponse();
    await handleConcierge(
      makeRequest({
        ip: '198.51.100.5',
        headers: { 'x-concierge-client': clientA },
        body: { mode: 'transcribe', audio: 'UklGRi4AAABXQVZF', mimeType: 'audio/webm' },
      }),
      res80 as unknown as Response,
      { now, db, getApiKey: () => 'secret-gemini-key', fetchFn },
    );
    expect(res80.code).toBe(200);
    expect(res80.headers['X-RateLimit-Remaining']).toBe('0');

    // 81st attempt for clientA is blocked across query, live-token, and transcribe
    for (const body of [
      { query: 'Over limit' },
      { mode: 'live-token' },
      { mode: 'transcribe', audio: 'UklGRi4AAABXQVZF', mimeType: 'audio/webm' },
    ]) {
      const resBlocked = createMockResponse();
      await handleConcierge(
        makeRequest({ ip: '198.51.100.5', headers: { 'x-concierge-client': clientA }, body }),
        resBlocked as unknown as Response,
        { now, db, getApiKey: () => 'secret-gemini-key', fetchFn, bypassCache: true },
      );
      expect(resBlocked.code).toBe(429);
      expect(resBlocked.headers['X-RateLimit-Remaining']).toBe('0');
    }

    // Another attendee (clientB) behind the SAME venue Wi-Fi IP is unaffected
    const resClientB = createMockResponse();
    await handleConcierge(
      makeRequest({ ip: '198.51.100.5', headers: { 'x-concierge-client': clientB } }),
      resClientB as unknown as Response,
      { now, db, getApiKey: () => 'secret-gemini-key', fetchFn, bypassCache: true },
    );
    expect(resClientB.code).toBe(200);
    expect(resClientB.headers['X-RateLimit-Remaining']).toBe('79');

    // Invalid headers (too short, bad characters, too long) skip per-client check and fall back to IP-only
    for (const invalidHeader of ['short', 'invalid!token@1234', 'a'.repeat(65)]) {
      const resInvalid = createMockResponse();
      await handleConcierge(
        makeRequest({ ip: '198.51.100.99', headers: { 'x-concierge-client': invalidHeader } }),
        resInvalid as unknown as Response,
        {
          now,
          db: createMockDb(),
          getApiKey: () => 'secret-gemini-key',
          fetchFn,
          bypassCache: true,
        },
      );
      expect(resInvalid.code).toBe(200);
      expect(resInvalid.headers['X-RateLimit-Remaining']).toBe('2999');
    }
  });

  it('isolates 15000 global 30h pools between chat (concierge-global-30h) and voice (concierge-voice-global-30h)', async () => {
    const now = 1795255200000;
    const { hashKey } = await import('./rate-limiter');
    const chatGlobalKey = hashKey('concierge-global-30h', 'devfest-2026-sponsored');
    const voiceGlobalKey = hashKey('concierge-voice-global-30h', 'devfest-2026-sponsored');

    const fetchFn = jest.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('/v1beta/auth_tokens')) {
        return { ok: true, status: 200, json: async () => ({ name: 'auth_tokens/tok-global' }) };
      }
      if (u.includes('/v1beta/interactions')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ output_text: JSON.stringify({ transcript: 'Voice pool ok' }) }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ output_text: JSON.stringify(VALID_PLAN) }),
      };
    }) as unknown as typeof fetch;

    // 1. Exhaust voice global pool (15000) -> live-token and transcribe are blocked, chat still succeeds
    const dbVoiceExhausted = createMockDb({
      [`functionsRateLimits/${voiceGlobalKey}`]: {
        attempts: 15000,
        resetAt: Timestamp.fromMillis(now + 60_000),
      },
    });

    const resLiveBlocked = createMockResponse();
    await handleConcierge(
      makeRequest({ ip: '10.0.0.10', body: { mode: 'live-token' } }),
      resLiveBlocked as unknown as Response,
      { now, db: dbVoiceExhausted, getApiKey: () => 'secret-gemini-key', fetchFn },
    );
    expect(resLiveBlocked.code).toBe(429);
    expect(resLiveBlocked.body).toMatchObject({
      status: 'rate-limited',
      error: 'Rate limit exceeded',
    });

    const resTranscribeBlocked = createMockResponse();
    await handleConcierge(
      makeRequest({
        ip: '10.0.0.11',
        body: { mode: 'transcribe', audio: 'UklGRi4AAABXQVZF', mimeType: 'audio/webm' },
      }),
      resTranscribeBlocked as unknown as Response,
      { now, db: dbVoiceExhausted, getApiKey: () => 'secret-gemini-key', fetchFn },
    );
    expect(resTranscribeBlocked.code).toBe(429);

    const resChatStillAllowed = createMockResponse();
    await handleConcierge(
      makeRequest({ ip: '10.0.0.12' }),
      resChatStillAllowed as unknown as Response,
      {
        now,
        db: dbVoiceExhausted,
        getApiKey: () => 'secret-gemini-key',
        fetchFn,
        bypassCache: true,
      },
    );
    expect(resChatStillAllowed.code).toBe(200);
    expect(resChatStillAllowed.headers['X-RateLimit-Remaining']).toBe('2999');

    // 2. Exhaust chat global pool (15000) -> chat is blocked, live-token and transcribe still succeed
    const dbChatExhausted = createMockDb({
      [`functionsRateLimits/${chatGlobalKey}`]: {
        attempts: 15000,
        resetAt: Timestamp.fromMillis(now + 60_000),
      },
    });

    const resChatBlocked = createMockResponse();
    await handleConcierge(makeRequest({ ip: '10.0.0.20' }), resChatBlocked as unknown as Response, {
      now,
      db: dbChatExhausted,
      getApiKey: () => 'secret-gemini-key',
      fetchFn,
      bypassCache: true,
    });
    expect(resChatBlocked.code).toBe(429);
    expect(resChatBlocked.body).toMatchObject({ status: 'rate-limited', fallback: 'local-a2ui' });

    const resLiveStillAllowed = createMockResponse();
    await handleConcierge(
      makeRequest({ ip: '10.0.0.21', body: { mode: 'live-token' } }),
      resLiveStillAllowed as unknown as Response,
      { now, db: dbChatExhausted, getApiKey: () => 'secret-gemini-key', fetchFn },
    );
    expect(resLiveStillAllowed.code).toBe(200);

    const resTranscribeStillAllowed = createMockResponse();
    await handleConcierge(
      makeRequest({
        ip: '10.0.0.22',
        body: { mode: 'transcribe', audio: 'UklGRi4AAABXQVZF', mimeType: 'audio/webm' },
      }),
      resTranscribeStillAllowed as unknown as Response,
      { now, db: dbChatExhausted, getApiKey: () => 'secret-gemini-key', fetchFn },
    );
    expect(resTranscribeStillAllowed.code).toBe(200);

    // 3. When global pool has fewer remaining attempts than client/IP limits, X-RateLimit-Remaining reflects it
    const globalResetMs = now + 108_000_000;
    const dbGlobalBinding = createMockDb({
      [`functionsRateLimits/${chatGlobalKey}`]: {
        attempts: 14995,
        resetAt: Timestamp.fromMillis(globalResetMs),
      },
    });
    const resBinding = createMockResponse();
    await handleConcierge(
      makeRequest({
        ip: '10.0.0.30',
        headers: { 'x-concierge-client': 'binding-client-token-1234' },
      }),
      resBinding as unknown as Response,
      {
        now,
        db: dbGlobalBinding,
        getApiKey: () => 'secret-gemini-key',
        fetchFn,
        bypassCache: true,
      },
    );
    expect(resBinding.code).toBe(200);
    expect(resBinding.headers['X-RateLimit-Remaining']).toBe('4');
    expect(resBinding.headers['X-RateLimit-Reset']).toBe(String(Math.ceil(globalResetMs / 1000)));
  });

  it('extracts JSON from Interactions REST steps[].content[] text parts', async () => {
    const res = createMockResponse();
    const fetchFn = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 'completed',
        steps: [
          { type: 'thought', signature: 'opaque-sig' },
          {
            type: 'model_output',
            content: [{ type: 'text', text: JSON.stringify(VALID_PLAN) }],
          },
        ],
      }),
    })) as unknown as typeof fetch;

    await handleConcierge(makeRequest(), res as unknown as Response, {
      now: 1795255200000,
      getApiKey: () => 'secret-gemini-key',
      fetchFn,
    });

    expect(res.code).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      model: 'gemini-3.5-flash-lite',
      thinkingLevel: 'minimal',
    });
  });

  it('caches repeated queries in memory and skips duplicate Gemini API calls', async () => {
    const now = 1795255200000;
    const fetchFn = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 'completed',
        steps: [
          {
            type: 'model_output',
            content: [{ type: 'text', text: JSON.stringify(VALID_PLAN) }],
          },
        ],
      }),
    })) as unknown as typeof fetch;

    const res1 = createMockResponse();
    await handleConcierge(
      makeRequest({ body: { query: 'Who is Michał Jabłoński?', savedSessionIds: ['CFP-021'] } }),
      res1 as unknown as Response,
      { now, getApiKey: () => 'secret-gemini-key', fetchFn },
    );
    expect(res1.code).toBe(200);
    expect(res1.headers['X-Concierge-Cache']).toBe('MISS');
    expect(res1.body).toMatchObject({ cached: false });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Check organizing team grounding is embedded in system instruction
    const requestInit = (fetchFn as jest.Mock).mock.calls[0]?.[1] as { body: string };
    const sentBody = JSON.parse(requestInit.body) as { system_instruction: string };
    expect(sentBody.system_instruction).toContain('Michał Jabłoński');
    expect(CANONICAL_TEAM.some((m) => m.name === 'Michał Jabłoński')).toBe(true);

    // Second identical normalized query hits cache without calling Gemini again
    const res2 = createMockResponse();
    await handleConcierge(
      makeRequest({
        body: { query: '  who is michał jabłoński? ', savedSessionIds: ['CFP-021'] },
      }),
      res2 as unknown as Response,
      { now: now + 5000, getApiKey: () => 'secret-gemini-key', fetchFn },
    );
    expect(res2.code).toBe(200);
    expect(res2.headers['X-Concierge-Cache']).toBe('HIT');
    expect(res2.body).toMatchObject({ cached: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('keys and expires time-sensitive cache across schedule slot boundaries', async () => {
    const fetchFn = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 'completed',
        steps: [
          {
            type: 'model_output',
            content: [{ type: 'text', text: JSON.stringify(VALID_PLAN) }],
          },
        ],
      }),
    })) as unknown as typeof fetch;

    const slot = getServerScheduleSlot(Date.parse('2026-11-21T10:20:00+01:00'));
    expect(slot.slotKey).toBe('slot:10:15-10:45');

    // 10:20 — MISS
    const res1 = createMockResponse();
    await handleConcierge(
      makeRequest({ body: { query: 'What is happening right now?' } }),
      res1 as unknown as Response,
      {
        now: Date.parse('2026-11-21T10:20:00+01:00'),
        getApiKey: () => 'secret-gemini-key',
        fetchFn,
      },
    );
    expect(res1.headers['X-Concierge-Cache']).toBe('MISS');
    expect(res1.headers['X-Concierge-Slot']).toBe('slot:10:15-10:45');

    // 10:22 same slot — HIT
    const res2 = createMockResponse();
    await handleConcierge(
      makeRequest({ body: { query: 'What is happening right now?' } }),
      res2 as unknown as Response,
      {
        now: Date.parse('2026-11-21T10:22:00+01:00'),
        getApiKey: () => 'secret-gemini-key',
        fetchFn,
      },
    );
    expect(res2.headers['X-Concierge-Cache']).toBe('HIT');
    expect(res2.headers['X-Concierge-Slot']).toBe('slot:10:15-10:45');

    // Crosses 10:45 transition (10:44 -> 10:46) — MISS
    const res3 = createMockResponse();
    await handleConcierge(
      makeRequest({ body: { query: 'What is happening right now?' } }),
      res3 as unknown as Response,
      {
        now: Date.parse('2026-11-21T10:44:00+01:00'),
        getApiKey: () => 'secret-gemini-key',
        fetchFn,
      },
    );
    const res4 = createMockResponse();
    await handleConcierge(
      makeRequest({ body: { query: 'What is happening right now?' } }),
      res4 as unknown as Response,
      {
        now: Date.parse('2026-11-21T10:46:00+01:00'),
        getApiKey: () => 'secret-gemini-key',
        fetchFn,
      },
    );
    expect(res3.headers['X-Concierge-Slot']).toBe('slot:10:15-10:45');
    expect(res4.headers['X-Concierge-Cache']).toBe('MISS');
    expect(res4.headers['X-Concierge-Slot']).toBe('slot:10:45-10:55');

    // Crosses 09:00 doors-open boundary (08:58 -> 09:01) — MISS
    const resPre = createMockResponse();
    await handleConcierge(
      makeRequest({ body: { query: 'What is happening right now?' } }),
      resPre as unknown as Response,
      {
        now: Date.parse('2026-11-21T08:58:00+01:00'),
        getApiKey: () => 'secret-gemini-key',
        fetchFn,
      },
    );
    const resOpen = createMockResponse();
    await handleConcierge(
      makeRequest({ body: { query: 'What is happening right now?' } }),
      resOpen as unknown as Response,
      {
        now: Date.parse('2026-11-21T09:01:00+01:00'),
        getApiKey: () => 'secret-gemini-key',
        fetchFn,
      },
    );
    expect(resPre.headers['X-Concierge-Slot']).toBe('pre-event');
    expect(resOpen.headers['X-Concierge-Cache']).toBe('MISS');
    expect(resOpen.headers['X-Concierge-Slot']).toBe('slot:09:00-10:00');
  });

  it('fails over across model chain on 503 and preserves served model on cache HIT', async () => {
    const fetchFn = jest.fn(async (_url: string | URL | Request, init?: { body?: string }) => {
      const body = JSON.parse(String(init?.body)) as { model: string; input: string };
      if (body.model === 'gemini-3.5-flash-lite') {
        return {
          ok: false,
          status: 503,
          text: async () => JSON.stringify({ error: { code: 'service_unavailable' } }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'completed',
          steps: [
            {
              type: 'model_output',
              content: [{ type: 'text', text: JSON.stringify(VALID_PLAN) }],
            },
          ],
        }),
      };
    }) as unknown as typeof fetch;

    const sleepFn = jest.fn(async () => {});
    const now = Date.parse('2026-11-21T12:15:00+01:00');
    const res1 = createMockResponse();
    await handleConcierge(
      makeRequest({ body: { query: 'Kiedy jest lunch i gdzie zaparkować?' } }),
      res1 as unknown as Response,
      {
        now,
        getApiKey: () => 'secret-gemini-key',
        fetchFn,
        sleepFn,
      },
    );

    expect(res1.code).toBe(200);
    expect(res1.headers['X-Concierge-Cache']).toBe('MISS');
    expect(res1.headers['X-Concierge-Model']).toBe('gemini-3.6-flash');
    expect(sleepFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    const calls = (fetchFn as unknown as jest.Mock).mock.calls;
    const secondBody = JSON.parse(String((calls[1]![1] as { body?: string }).body)) as {
      model: string;
      input: string;
    };
    expect(secondBody.model).toBe('gemini-3.6-flash');
    const parsedInput = JSON.parse(secondBody.input) as {
      currentWarsawTime: string;
      scheduleSlot: string;
    };
    expect(parsedInput.currentWarsawTime).toContain('12:15 Europe/Warsaw');
    expect(parsedInput.scheduleSlot).toBe('slot:12:00-12:45');

    const body1 = res1.body as {
      model: string;
      messages: Array<Record<string, unknown>>;
    };
    expect(body1.model).toBe('gemini-3.6-flash');
    expect(body1.messages[0]).toMatchObject({
      type: 'createSurface',
      source: 'gemini-3.6-flash',
    });

    // Repeated call hits cache and preserves failover model metadata
    const res2 = createMockResponse();
    await handleConcierge(
      makeRequest({ body: { query: 'Kiedy jest lunch i gdzie zaparkować?' } }),
      res2 as unknown as Response,
      {
        now: now + 2000,
        getApiKey: () => 'secret-gemini-key',
        fetchFn,
        sleepFn,
      },
    );
    expect(res2.code).toBe(200);
    expect(res2.headers['X-Concierge-Cache']).toBe('HIT');
    expect(res2.headers['X-Concierge-Model']).toBe('gemini-3.6-flash');
    expect(res2.body).toMatchObject({ cached: true, model: 'gemini-3.6-flash' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('returns 502 when all models in the failover chain return 503', async () => {
    const fetchFn = jest.fn(async () => ({
      ok: false,
      status: 503,
      text: async () => '{"error":{"code":"service_unavailable"}}',
    })) as unknown as typeof fetch;
    const sleepFn = jest.fn(async () => {});

    const res = createMockResponse();
    await handleConcierge(makeRequest(), res as unknown as Response, {
      getApiKey: () => 'secret-gemini-key',
      fetchFn,
      sleepFn,
    });

    expect(res.code).toBe(502);
    expect(res.body).toEqual({ status: 'upstream-error', fallback: 'local-a2ui' });
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleepFn).toHaveBeenCalledTimes(2);
  });

  describe('mode: transcribe', () => {
    it('validates missing audio payload and returns 400', async () => {
      const res = createMockResponse();
      await handleConcierge(
        makeRequest({ body: { mode: 'transcribe', mimeType: 'audio/webm' } }),
        res as unknown as Response,
        { getApiKey: () => 'key' },
      );
      expect(res.code).toBe(400);
      expect(res.body).toEqual({ status: 'invalid-request', error: 'Missing audio payload' });
    });

    it('rejects oversize audio payloads > 700,000 base64 chars with 413', async () => {
      const res = createMockResponse();
      const largeAudio = 'A'.repeat(700_001);
      await handleConcierge(
        makeRequest({ body: { mode: 'transcribe', audio: largeAudio, mimeType: 'audio/webm' } }),
        res as unknown as Response,
        { getApiKey: () => 'key' },
      );
      expect(res.code).toBe(413);
      expect(res.body).toEqual({
        status: 'payload-too-large',
        error: 'Audio exceeds 15 seconds limit',
      });
    });

    it('rejects unsupported audio MIME types with 400', async () => {
      const res = createMockResponse();
      await handleConcierge(
        makeRequest({ body: { mode: 'transcribe', audio: 'base64audio', mimeType: 'video/mp4' } }),
        res as unknown as Response,
        { getApiKey: () => 'key' },
      );
      expect(res.code).toBe(400);
      expect(res.body).toEqual({
        status: 'invalid-request',
        error: 'Unsupported audio MIME type',
      });
    });

    it('transcribes valid audio, strips codec suffixes, and returns 200 with transcript', async () => {
      const fetchFn = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          output_text: JSON.stringify({ transcript: 'Gdzie jest sala Classroom?' }),
        }),
      })) as unknown as typeof fetch;

      const res = createMockResponse();
      await handleConcierge(
        makeRequest({
          body: {
            mode: 'transcribe',
            audio: 'UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
            mimeType: 'audio/webm;codecs=opus',
          },
        }),
        res as unknown as Response,
        {
          getApiKey: () => 'secret-gemini-key',
          fetchFn,
        },
      );

      expect(res.code).toBe(200);
      expect(res.headers['X-Concierge-Model']).toBe('gemini-3.5-flash-lite');
      expect(res.body).toEqual({
        status: 'ok',
        transcript: 'Gdzie jest sala Classroom?',
        model: 'gemini-3.5-flash-lite',
      });

      const calls = (fetchFn as unknown as jest.Mock).mock.calls;
      expect(calls[0]![0]).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
      const sentPayload = JSON.parse(String((calls[0]![1] as { body?: string }).body)) as {
        model: string;
        input: Array<{ type: string; mime_type?: string; data?: string; text?: string }>;
      };
      expect(sentPayload.model).toBe('gemini-3.5-flash-lite');
      expect(sentPayload.input).toHaveLength(2);
      expect(sentPayload.input[1]?.type).toBe('audio');
      expect(sentPayload.input[1]?.mime_type).toBe('audio/webm');
    });

    it('fails over to next model on 503 during transcription', async () => {
      let callCount = 0;
      const fetchFn = jest.fn(async () => {
        callCount += 1;
        if (callCount === 1) {
          return {
            ok: false,
            status: 503,
            text: async () => '{"error":"service_unavailable"}',
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            output_text: JSON.stringify({ transcript: 'Warszawa DevFest agenda' }),
          }),
        };
      }) as unknown as typeof fetch;
      const sleepFn = jest.fn(async () => {});

      const res = createMockResponse();
      await handleConcierge(
        makeRequest({
          body: {
            mode: 'transcribe',
            audio: 'UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
            mimeType: 'audio/ogg',
          },
        }),
        res as unknown as Response,
        {
          getApiKey: () => 'secret-gemini-key',
          fetchFn,
          sleepFn,
        },
      );

      expect(res.code).toBe(200);
      expect(res.headers['X-Concierge-Model']).toBe('gemini-3.6-flash');
      expect(res.body).toEqual({
        status: 'ok',
        transcript: 'Warszawa DevFest agenda',
        model: 'gemini-3.6-flash',
      });
      expect(fetchFn).toHaveBeenCalledTimes(2);
      expect(sleepFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('mode: live-token', () => {
    it('returns 503 if API key is not configured', async () => {
      const res = createMockResponse();
      await handleConcierge(
        makeRequest({ body: { mode: 'live-token' } }),
        res as unknown as Response,
        { getApiKey: () => '' },
      );
      expect(res.code).toBe(503);
      expect(res.body).toEqual({ status: 'unavailable', error: 'AI key not configured' });
    });

    it('generates ephemeral live token constrained to gemini-3.5-transcribe-live and returns 200 with wsUrl', async () => {
      const fetchFn = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          name: 'auth_tokens/test-token-12345',
        }),
      })) as unknown as typeof fetch;

      const res = createMockResponse();
      await handleConcierge(
        makeRequest({ body: { mode: 'live-token' } }),
        res as unknown as Response,
        {
          getApiKey: () => 'secret-gemini-key',
          fetchFn,
        },
      );

      expect(res.code).toBe(200);
      expect(res.headers['X-Concierge-Model']).toBe('gemini-3.5-transcribe-live');
      expect(res.body).toEqual({
        status: 'ok',
        token: 'auth_tokens/test-token-12345',
        wsUrl:
          'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=auth_tokens%2Ftest-token-12345',
        model: 'gemini-3.5-transcribe-live',
      });

      const calls = (fetchFn as unknown as jest.Mock).mock.calls;
      expect(calls[0]![0]).toBe('https://generativelanguage.googleapis.com/v1beta/auth_tokens');
      const body = JSON.parse(String((calls[0]![1] as { body?: string }).body)) as {
        uses: number;
        bidiGenerateContentSetup: {
          model: string;
          generationConfig: { responseModalities: string[] };
          inputAudioTranscription: { mode: string };
        };
      };
      expect(body.uses).toBe(1);
      expect(body.bidiGenerateContentSetup.model).toBe('models/gemini-3.5-transcribe-live');
      expect(body.bidiGenerateContentSetup.generationConfig.responseModalities).toEqual(['TEXT']);
      expect(body.bidiGenerateContentSetup.inputAudioTranscription.mode).toBe('smart');
    });

    it('returns 502 if upstream token creation fails', async () => {
      const fetchFn = jest.fn(async () => ({
        ok: false,
        status: 500,
        text: async () => '{"error":"internal_error"}',
      })) as unknown as typeof fetch;

      const res = createMockResponse();
      await handleConcierge(
        makeRequest({ body: { mode: 'live-token' } }),
        res as unknown as Response,
        {
          getApiKey: () => 'secret-gemini-key',
          fetchFn,
        },
      );

      expect(res.code).toBe(502);
      expect(res.body).toEqual({
        status: 'upstream-error',
        error: 'Failed to generate live token',
      });
    });
  });
});
