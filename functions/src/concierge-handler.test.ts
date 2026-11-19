import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

jest.mock('./rate-limiter.js', () => require('./rate-limiter'), { virtual: true });

import { CANONICAL_TEAM, clearConciergeCache, handleConcierge } from './concierge-handler';

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
  badge: 'A2UI · Gemini 4 Hydrogen',
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

  it('calls Gemini Interactions API with Hydrogen low thinking config and sanitized input', async () => {
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
    expect(sentBody.model).toBe('gemini-4-hydrogen');
    expect(sentBody.store).toBe(false);
    expect(sentBody.generation_config).toEqual({
      thinking_level: 'low',
      max_output_tokens: 32768,
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
      model: 'gemini-4-hydrogen',
      thinkingLevel: 'low',
    });
    expect(body.messages).toHaveLength(3);

    const [createSurface, updateDataModel, updateComponents] = body.messages;
    expect(createSurface).toMatchObject({
      type: 'createSurface',
      source: 'gemini-4-hydrogen',
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

  it('enforces 2-tier rate limits and sets rate limit headers', async () => {
    const now = 1795255200000;
    const db = createMockDb();
    const fetchFn = jest.fn(async () => ({
      ok: true,
      json: async () => ({ output_text: JSON.stringify(VALID_PLAN) }),
    })) as unknown as typeof fetch;

    const resOk = createMockResponse();
    await handleConcierge(makeRequest(), resOk as unknown as Response, {
      now,
      db,
      getApiKey: () => 'secret-gemini-key',
      fetchFn,
    });
    expect(resOk.code).toBe(200);
    expect(resOk.headers['X-RateLimit-Remaining']).toBe('44');
    expect(resOk.headers['X-RateLimit-Reset']).toBeDefined();

    // Exhaust per-IP limit (45 attempts)
    for (let i = 0; i < 44; i += 1) {
      const r = createMockResponse();
      await handleConcierge(makeRequest(), r as unknown as Response, {
        now,
        db,
        getApiKey: () => 'secret-gemini-key',
        fetchFn,
      });
      expect(r.code).toBe(200);
    }

    const resBlocked = createMockResponse();
    await handleConcierge(makeRequest(), resBlocked as unknown as Response, {
      now,
      db,
      getApiKey: () => 'secret-gemini-key',
      fetchFn,
    });
    expect(resBlocked.code).toBe(429);
    expect(resBlocked.headers['X-RateLimit-Remaining']).toBe('0');
    expect(resBlocked.body).toMatchObject({
      status: 'rate-limited',
      fallback: 'local-a2ui',
    });

    // Global limit check with fresh IP
    const globalHashKey = await import('./rate-limiter').then((m) =>
      m.hashKey('concierge-global-30h', 'devfest-2026-sponsored'),
    );
    const dbGlobalBlocked = createMockDb({
      [`functionsRateLimits/${globalHashKey}`]: {
        attempts: 6000,
        resetAt: Timestamp.fromMillis(now + 60000),
      },
    });
    const resGlobalBlocked = createMockResponse();
    await handleConcierge(
      makeRequest({ ip: '10.0.0.99' }),
      resGlobalBlocked as unknown as Response,
      {
        now,
        db: dbGlobalBlocked,
        getApiKey: () => 'secret-gemini-key',
        fetchFn,
      },
    );
    expect(resGlobalBlocked.code).toBe(429);
    expect(resGlobalBlocked.body).toMatchObject({
      status: 'rate-limited',
      fallback: 'local-a2ui',
    });
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
      model: 'gemini-4-hydrogen',
      thinkingLevel: 'low',
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
});
