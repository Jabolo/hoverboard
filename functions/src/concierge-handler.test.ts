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
  const { headers: overrideHeaders, ...rest } = overrides;
  const defaultHeaders: Record<string, string | string[] | undefined> = {
    'content-type': 'application/json',
  };
  const mergedHeaders =
    overrideHeaders !== undefined
      ? { ...defaultHeaders, ...(overrideHeaders as Record<string, string | string[] | undefined>) }
      : defaultHeaders;

  return {
    method: 'POST',
    body: { query: 'Build me an AI track' },
    headers: mergedHeaders,
    ip: '127.0.0.1',
    ...rest,
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
      max_output_tokens: 1200,
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

  it('returns 502 on upstream non-OK response or malformed model JSON without amplifying calls', async () => {
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
    expect(fetchFail).toHaveBeenCalledTimes(1);

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
    expect(fetchBadJson).toHaveBeenCalledTimes(1);
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

  it('enforces mode-specific per-IP limits (chat 600, transcribe 120, live-token 60 per 15m) using rightmost X-Forwarded-For', async () => {
    const now = 1795255200000;
    const { hashKey } = await import('./rate-limiter');
    const chatIpHashKey = hashKey('concierge-chat-ip', '203.0.113.10');
    const transcribeIpHashKey = hashKey('concierge-transcribe-ip', '203.0.113.10');
    const liveIpHashKey = hashKey('concierge-live-ip', '203.0.113.10');

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

    const db = createMockDb({
      [`functionsRateLimits/${chatIpHashKey}`]: {
        attempts: 599,
        resetAt: Timestamp.fromMillis(now + 60_000),
      },
      [`functionsRateLimits/${transcribeIpHashKey}`]: {
        attempts: 119,
        resetAt: Timestamp.fromMillis(now + 60_000),
      },
      [`functionsRateLimits/${liveIpHashKey}`]: {
        attempts: 59,
        resetAt: Timestamp.fromMillis(now + 60_000),
      },
    });

    // 600th chat request allowed (spoofed leftmost IP ignored, rightmost 203.0.113.10 used)
    const resChat600 = createMockResponse();
    await handleConcierge(
      makeRequest({ headers: { 'x-forwarded-for': '10.0.0.1, 203.0.113.10' } }),
      resChat600 as unknown as Response,
      {
        now,
        db,
        getApiKey: () => 'secret-gemini-key',
        fetchFn: queryFetch,
        bypassCache: true,
        globalShardIndex: 0,
      },
    );
    expect(resChat600.code).toBe(200);
    expect(resChat600.headers['X-RateLimit-Remaining']).toBe('0');

    // 601st chat request blocked even with rotated spoofed leftmost IP
    const resChatBlocked = createMockResponse();
    await handleConcierge(
      makeRequest({ headers: { 'x-forwarded-for': '10.0.0.2, 203.0.113.10' } }),
      resChatBlocked as unknown as Response,
      {
        now,
        db,
        getApiKey: () => 'secret-gemini-key',
        fetchFn: queryFetch,
        bypassCache: true,
        globalShardIndex: 0,
      },
    );
    expect(resChatBlocked.code).toBe(429);
    expect(resChatBlocked.body).toMatchObject({ status: 'rate-limited', fallback: 'local-a2ui' });

    // 120th transcribe allowed, 121st blocked
    const resTrans120 = createMockResponse();
    await handleConcierge(
      makeRequest({
        headers: { 'x-forwarded-for': '203.0.113.10' },
        body: { mode: 'transcribe', audio: 'UklGRi4AAABXQVZF', mimeType: 'audio/webm' },
      }),
      resTrans120 as unknown as Response,
      {
        now,
        db,
        getApiKey: () => 'secret-gemini-key',
        fetchFn: transcribeFetch,
        globalShardIndex: 0,
      },
    );
    expect(resTrans120.code).toBe(200);
    expect(resTrans120.headers['X-RateLimit-Remaining']).toBe('0');

    const resTransBlocked = createMockResponse();
    await handleConcierge(
      makeRequest({
        headers: { 'x-forwarded-for': '203.0.113.10' },
        body: { mode: 'transcribe', audio: 'UklGRi4AAABXQVZF', mimeType: 'audio/webm' },
      }),
      resTransBlocked as unknown as Response,
      {
        now,
        db,
        getApiKey: () => 'secret-gemini-key',
        fetchFn: transcribeFetch,
        globalShardIndex: 0,
      },
    );
    expect(resTransBlocked.code).toBe(429);

    // 60th live-token allowed, 61st blocked
    const resLive60 = createMockResponse();
    await handleConcierge(
      makeRequest({
        headers: { 'x-forwarded-for': '203.0.113.10' },
        body: { mode: 'live-token' },
      }),
      resLive60 as unknown as Response,
      {
        now,
        db,
        getApiKey: () => 'secret-gemini-key',
        fetchFn: liveTokenFetch,
        globalShardIndex: 0,
      },
    );
    expect(resLive60.code).toBe(200);
    expect(resLive60.headers['X-RateLimit-Remaining']).toBe('0');

    const resLiveBlocked = createMockResponse();
    await handleConcierge(
      makeRequest({
        headers: { 'x-forwarded-for': '203.0.113.10' },
        body: { mode: 'live-token' },
      }),
      resLiveBlocked as unknown as Response,
      {
        now,
        db,
        getApiKey: () => 'secret-gemini-key',
        fetchFn: liveTokenFetch,
        globalShardIndex: 0,
      },
    );
    expect(resLiveBlocked.code).toBe(429);
  });

  it('enforces mode-specific per-client limits (chat 30, transcribe 15, live-token 10 per 15m) and falls back to IP-only on invalid header', async () => {
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

    // 30 chat requests for clientA -> 31st blocked; clientB behind same NAT IP unaffected
    for (let i = 0; i < 30; i += 1) {
      const r = createMockResponse();
      await handleConcierge(
        makeRequest({ ip: '198.51.100.5', headers: { 'x-concierge-client': clientA } }),
        r as unknown as Response,
        {
          now,
          db,
          getApiKey: () => 'secret-gemini-key',
          fetchFn,
          bypassCache: true,
          globalShardIndex: 0,
        },
      );
      expect(r.code).toBe(200);
      if (i === 0) expect(r.headers['X-RateLimit-Remaining']).toBe('29');
    }
    const resChat31 = createMockResponse();
    await handleConcierge(
      makeRequest({ ip: '198.51.100.5', headers: { 'x-concierge-client': clientA } }),
      resChat31 as unknown as Response,
      {
        now,
        db,
        getApiKey: () => 'secret-gemini-key',
        fetchFn,
        bypassCache: true,
        globalShardIndex: 0,
      },
    );
    expect(resChat31.code).toBe(429);

    const resClientB = createMockResponse();
    await handleConcierge(
      makeRequest({ ip: '198.51.100.5', headers: { 'x-concierge-client': clientB } }),
      resClientB as unknown as Response,
      {
        now,
        db,
        getApiKey: () => 'secret-gemini-key',
        fetchFn,
        bypassCache: true,
        globalShardIndex: 0,
      },
    );
    expect(resClientB.code).toBe(200);
    expect(resClientB.headers['X-RateLimit-Remaining']).toBe('29');

    // 10 live-token requests for clientA -> 11th blocked
    for (let i = 0; i < 10; i += 1) {
      const r = createMockResponse();
      await handleConcierge(
        makeRequest({
          ip: '198.51.100.5',
          headers: { 'x-concierge-client': clientA },
          body: { mode: 'live-token' },
        }),
        r as unknown as Response,
        { now, db, getApiKey: () => 'secret-gemini-key', fetchFn, globalShardIndex: 0 },
      );
      expect(r.code).toBe(200);
    }
    const resLive11 = createMockResponse();
    await handleConcierge(
      makeRequest({
        ip: '198.51.100.5',
        headers: { 'x-concierge-client': clientA },
        body: { mode: 'live-token' },
      }),
      resLive11 as unknown as Response,
      { now, db, getApiKey: () => 'secret-gemini-key', fetchFn, globalShardIndex: 0 },
    );
    expect(resLive11.code).toBe(429);

    // 15 transcribe requests for clientA -> 16th blocked
    for (let i = 0; i < 15; i += 1) {
      const r = createMockResponse();
      await handleConcierge(
        makeRequest({
          ip: '198.51.100.5',
          headers: { 'x-concierge-client': clientA },
          body: { mode: 'transcribe', audio: 'UklGRi4AAABXQVZF', mimeType: 'audio/webm' },
        }),
        r as unknown as Response,
        { now, db, getApiKey: () => 'secret-gemini-key', fetchFn, globalShardIndex: 0 },
      );
      expect(r.code).toBe(200);
    }
    const resTrans16 = createMockResponse();
    await handleConcierge(
      makeRequest({
        ip: '198.51.100.5',
        headers: { 'x-concierge-client': clientA },
        body: { mode: 'transcribe', audio: 'UklGRi4AAABXQVZF', mimeType: 'audio/webm' },
      }),
      resTrans16 as unknown as Response,
      { now, db, getApiKey: () => 'secret-gemini-key', fetchFn, globalShardIndex: 0 },
    );
    expect(resTrans16.code).toBe(429);

    // Invalid headers skip per-client check and fall back to IP/global limits (global chat shard = 400 -> 399 remaining)
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
          globalShardIndex: 0,
        },
      );
      expect(resInvalid.code).toBe(200);
      expect(resInvalid.headers['X-RateLimit-Remaining']).toBe('399');
    }
  });

  it('isolates sharded 24h global pools between chat (4000/10), transcribe (1000/5), and live-token (600/5)', async () => {
    const now = 1795255200000;
    const { hashKey } = await import('./rate-limiter');
    const chatShardKey = hashKey('concierge-chat-global-24h', 'devfest-2026-sponsored:shard:0');
    const transcribeShardKey = hashKey(
      'concierge-transcribe-global-24h',
      'devfest-2026-sponsored:shard:0',
    );
    const liveShardKey = hashKey('concierge-live-global-24h', 'devfest-2026-sponsored:shard:0');

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

    // 1. Exhaust live-token shard (600/5 = 120) -> live-token blocked, chat & transcribe succeed
    const dbLiveExhausted = createMockDb({
      [`functionsRateLimits/${liveShardKey}`]: {
        attempts: 120,
        resetAt: Timestamp.fromMillis(now + 60_000),
      },
    });
    const resLiveBlocked = createMockResponse();
    await handleConcierge(
      makeRequest({ ip: '10.0.0.10', body: { mode: 'live-token' } }),
      resLiveBlocked as unknown as Response,
      {
        now,
        db: dbLiveExhausted,
        getApiKey: () => 'secret-gemini-key',
        fetchFn,
        globalShardIndex: 0,
      },
    );
    expect(resLiveBlocked.code).toBe(429);

    const resChatOk = createMockResponse();
    await handleConcierge(makeRequest({ ip: '10.0.0.12' }), resChatOk as unknown as Response, {
      now,
      db: dbLiveExhausted,
      getApiKey: () => 'secret-gemini-key',
      fetchFn,
      bypassCache: true,
      globalShardIndex: 0,
    });
    expect(resChatOk.code).toBe(200);

    // 2. Exhaust transcribe shard (1000/5 = 200) -> transcribe blocked, chat & live succeed
    const dbTransExhausted = createMockDb({
      [`functionsRateLimits/${transcribeShardKey}`]: {
        attempts: 200,
        resetAt: Timestamp.fromMillis(now + 60_000),
      },
    });
    const resTransBlocked = createMockResponse();
    await handleConcierge(
      makeRequest({
        ip: '10.0.0.11',
        body: { mode: 'transcribe', audio: 'UklGRi4AAABXQVZF', mimeType: 'audio/webm' },
      }),
      resTransBlocked as unknown as Response,
      {
        now,
        db: dbTransExhausted,
        getApiKey: () => 'secret-gemini-key',
        fetchFn,
        globalShardIndex: 0,
      },
    );
    expect(resTransBlocked.code).toBe(429);

    // 3. Exhaust chat shard (4000/10 = 400) -> chat blocked, voice modes still succeed
    const dbChatExhausted = createMockDb({
      [`functionsRateLimits/${chatShardKey}`]: {
        attempts: 400,
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
      globalShardIndex: 0,
    });
    expect(resChatBlocked.code).toBe(429);

    const resLiveOk = createMockResponse();
    await handleConcierge(
      makeRequest({ ip: '10.0.0.21', body: { mode: 'live-token' } }),
      resLiveOk as unknown as Response,
      {
        now,
        db: dbChatExhausted,
        getApiKey: () => 'secret-gemini-key',
        fetchFn,
        globalShardIndex: 0,
      },
    );
    expect(resLiveOk.code).toBe(200);
  });

  it('fails closed with 503 local-a2ui fallback when Firestore rate limiter throws', async () => {
    const brokenDb = {
      collection: () => ({ doc: () => ({ path: 'broken' }) }),
      runTransaction: async () => {
        throw new Error('Firestore ABORTED');
      },
    } as unknown as Firestore;
    const fetchFn = jest.fn() as unknown as typeof fetch;
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = createMockResponse();
      await handleConcierge(makeRequest(), res as unknown as Response, {
        db: brokenDb,
        getApiKey: () => 'secret-gemini-key',
        fetchFn,
        bypassCache: true,
      });
      expect(res.code).toBe(503);
      expect(res.body).toEqual({ status: 'unavailable', fallback: 'local-a2ui' });
      expect(fetchFn).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
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
    expect(res1.headers['X-Concierge-Model']).toBe('gemini-3.1-flash-lite');
    expect(sleepFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    const calls = (fetchFn as unknown as jest.Mock).mock.calls;
    const secondBody = JSON.parse(String((calls[1]![1] as { body?: string }).body)) as {
      model: string;
      input: string;
    };
    expect(secondBody.model).toBe('gemini-3.1-flash-lite');
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
    expect(body1.model).toBe('gemini-3.1-flash-lite');
    expect(body1.messages[0]).toMatchObject({
      type: 'createSurface',
      source: 'gemini-3.1-flash-lite',
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
    expect(res2.headers['X-Concierge-Model']).toBe('gemini-3.1-flash-lite');
    expect(res2.body).toMatchObject({ cached: true, model: 'gemini-3.1-flash-lite' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('returns 502 when all models in the failover chain return 503 (max 2 attempts)', async () => {
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
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledTimes(1);
  });

  it('serves in-memory cache HIT without touching Firestore rate limit transactions', async () => {
    const now = 1795255200000;
    const runTransaction = jest.fn(async (fn: any) =>
      fn({
        get: async () => ({ exists: false, data: () => undefined }),
        set: () => {},
      }),
    );
    const spyDb = {
      collection: () => ({ doc: () => ({ path: 'mock' }) }),
      runTransaction,
    } as unknown as Firestore;
    const fetchFn = jest.fn(async () => ({
      ok: true,
      json: async () => ({ output_text: JSON.stringify(VALID_PLAN) }),
    })) as unknown as typeof fetch;

    const res1 = createMockResponse();
    await handleConcierge(
      makeRequest({ body: { query: 'Where is lunch?' } }),
      res1 as unknown as Response,
      { now, db: spyDb, getApiKey: () => 'secret-gemini-key', fetchFn, globalShardIndex: 0 },
    );
    expect(res1.code).toBe(200);
    expect(res1.headers['X-Concierge-Cache']).toBe('MISS');
    const txCallsAfterMiss = runTransaction.mock.calls.length;
    expect(txCallsAfterMiss).toBeGreaterThan(0);

    const res2 = createMockResponse();
    await handleConcierge(
      makeRequest({ body: { query: 'Where is lunch?' } }),
      res2 as unknown as Response,
      {
        now: now + 1000,
        db: spyDb,
        getApiKey: () => 'secret-gemini-key',
        fetchFn,
        globalShardIndex: 0,
      },
    );
    expect(res2.code).toBe(200);
    expect(res2.headers['X-Concierge-Cache']).toBe('HIT');
    expect(runTransaction.mock.calls.length).toBe(txCallsAfterMiss);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('enforces Content-Type, Origin allowlist, Content-Length caps, and env kill-switches', async () => {
    const fetchFn = jest.fn(async () => ({
      ok: true,
      json: async () => ({ output_text: JSON.stringify(VALID_PLAN) }),
    })) as unknown as typeof fetch;

    // 1. Non-JSON Content-Type -> 415
    const resNonJson = createMockResponse();
    await handleConcierge(
      makeRequest({ headers: { 'content-type': 'text/plain' } }),
      resNonJson as unknown as Response,
      { getApiKey: () => 'key', fetchFn },
    );
    expect(resNonJson.code).toBe(415);
    expect(resNonJson.headers['X-Content-Type-Options']).toBe('nosniff');

    // 2. Disallowed Origin -> 403; allowed Origin -> 200
    const resBadOrigin = createMockResponse();
    await handleConcierge(
      makeRequest({ headers: { origin: 'https://evil.example' } }),
      resBadOrigin as unknown as Response,
      { getApiKey: () => 'key', fetchFn },
    );
    expect(resBadOrigin.code).toBe(403);

    const resGoodOrigin = createMockResponse();
    await handleConcierge(
      makeRequest({ headers: { origin: 'https://warsaw.devfest.pl' } }),
      resGoodOrigin as unknown as Response,
      { getApiKey: () => 'key', fetchFn, bypassCache: true },
    );
    expect(resGoodOrigin.code).toBe(200);

    const resLocalOrigin = createMockResponse();
    await handleConcierge(
      makeRequest({ headers: { origin: 'http://localhost:5000' } }),
      resLocalOrigin as unknown as Response,
      { getApiKey: () => 'key', fetchFn, bypassCache: true },
    );
    expect(resLocalOrigin.code).toBe(200);

    // 3. Oversized Content-Length (>24KB chat, >260KB transcribe) -> 413
    const resTooLargeChat = createMockResponse();
    await handleConcierge(
      makeRequest({ headers: { 'content-length': String(24 * 1024 + 1) } }),
      resTooLargeChat as unknown as Response,
      { getApiKey: () => 'key', fetchFn },
    );
    expect(resTooLargeChat.code).toBe(413);

    const resTooLargeTranscribe = createMockResponse();
    await handleConcierge(
      makeRequest({
        headers: { 'content-length': String(260 * 1024 + 1) },
        body: { mode: 'transcribe', audio: 'abc', mimeType: 'audio/webm' },
      }),
      resTooLargeTranscribe as unknown as Response,
      { getApiKey: () => 'key', fetchFn },
    );
    expect(resTooLargeTranscribe.code).toBe(413);

    // 4. CONCIERGE_ENABLED=false kill-switch -> 503
    const resDisabled = createMockResponse();
    await handleConcierge(makeRequest(), resDisabled as unknown as Response, {
      getApiKey: () => 'key',
      fetchFn,
      env: { CONCIERGE_ENABLED: 'false' },
    });
    expect(resDisabled.code).toBe(503);
    expect(resDisabled.body).toEqual({ status: 'unavailable', fallback: 'local-a2ui' });

    // 5. CONCIERGE_SHUTOFF_AT reached -> 503
    const resShutoff = createMockResponse();
    await handleConcierge(makeRequest(), resShutoff as unknown as Response, {
      now: Date.parse('2026-11-22T00:00:00Z'),
      getApiKey: () => 'key',
      fetchFn,
      env: { CONCIERGE_SHUTOFF_AT: '2026-11-22T00:00:00Z' },
    });
    expect(resShutoff.code).toBe(503);
    expect(resShutoff.body).toEqual({ status: 'unavailable', fallback: 'local-a2ui' });

    // 6. CONCIERGE_LIVE_TOKEN_ENABLED=false -> 503 for live-token only
    const resLiveDisabled = createMockResponse();
    await handleConcierge(
      makeRequest({ body: { mode: 'live-token' } }),
      resLiveDisabled as unknown as Response,
      {
        getApiKey: () => 'key',
        fetchFn,
        env: { CONCIERGE_LIVE_TOKEN_ENABLED: 'false' },
      },
    );
    expect(resLiveDisabled.code).toBe(503);
    expect(resLiveDisabled.body).toEqual({
      status: 'unavailable',
      error: 'Live voice token disabled',
    });
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

    it('rejects oversize audio payloads > 180,000 base64 chars with 413', async () => {
      const res = createMockResponse();
      const largeAudio = 'A'.repeat(180_001);
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

    it('fails over to next flash-lite model on 503 during transcription', async () => {
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
      expect(res.headers['X-Concierge-Model']).toBe('gemini-3.1-flash-lite');
      expect(res.body).toEqual({
        status: 'ok',
        transcript: 'Warszawa DevFest agenda',
        model: 'gemini-3.1-flash-lite',
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

    it('generates short-lived ephemeral live token constrained to gemini-3.5-transcribe-live with expireTime, newSessionExpireTime, and maxOutputTokens', async () => {
      const now = Date.parse('2026-11-21T10:00:00.000Z');
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
          now,
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
        expireTime: string;
        newSessionExpireTime: string;
        bidiGenerateContentSetup: {
          model: string;
          generationConfig: { responseModalities: string[]; maxOutputTokens: number };
          inputAudioTranscription: { mode: string };
        };
      };
      expect(body.uses).toBe(1);
      expect(body.expireTime).toBe('2026-11-21T10:01:30.000Z');
      expect(body.newSessionExpireTime).toBe('2026-11-21T10:00:30.000Z');
      expect(body.bidiGenerateContentSetup.model).toBe('models/gemini-3.5-transcribe-live');
      expect(body.bidiGenerateContentSetup.generationConfig).toEqual({
        responseModalities: ['TEXT'],
        maxOutputTokens: 256,
      });
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
