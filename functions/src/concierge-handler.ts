import type { Request, Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { checkRateLimit, getClientIp } from './rate-limiter.js';

export type CanonicalSession = {
  id: string;
  title: string;
  start: string;
  end: string;
  space: 'auditorium' | 'classroom';
  kind: 'session' | 'workshop' | 'panel';
  speakers: string[];
  tags: string[];
  complexity?: string;
  href: string;
};

export const CANONICAL_SESSIONS: Record<string, CanonicalSession> = {
  'CFP-021': {
    id: 'CFP-021',
    title: 'Written by Agents. Reviewed by Nobody. Running in Production',
    start: '10:15',
    end: '10:45',
    space: 'auditorium',
    kind: 'session',
    speakers: ['Yonatan Levin'],
    tags: ['AI', 'AI - Antigravity', 'AI - Gemini'],
    complexity: 'Intermediate, Beginner, Advance',
    href: '/sessions/CFP-021/',
  },
  'INVITED-004': {
    id: 'INVITED-004',
    title: 'AI at Zero Token Cost: Local-First Browser AI and Prompt API',
    start: '10:15',
    end: '10:55',
    space: 'classroom',
    kind: 'workshop',
    speakers: ['Julia Rapczyńska'],
    tags: ['AI', 'Web', 'Angular'],
    complexity: 'Intermediate',
    href: '/sessions/INVITED-004/',
  },
  'CFP-002': {
    id: 'CFP-002',
    title: 'Event-Driven AI Pipelines on GCP: From Eventarc to LLMs',
    start: '11:00',
    end: '11:45',
    space: 'auditorium',
    kind: 'session',
    speakers: ['Çalgan Aygün'],
    tags: [
      'AI - Gemini',
      'AI - Gemini Enterprise Agent Platform',
      'Build with AI',
      'Cloud - App Development',
      'Cloud - Compute, Networking, Storage',
      'Cloud - Serverless & Containers',
      'Google Cloud',
      'Cloud - AI Tools',
    ],
    complexity: 'Intermediate',
    href: '/sessions/CFP-002/',
  },
  'CFP-012': {
    id: 'CFP-012',
    title: 'The Physics of Voice: Building a Coach in Flutter with Whisper and Acoustic Analysis',
    start: '11:00',
    end: '11:45',
    space: 'classroom',
    kind: 'session',
    speakers: ['Andrii Khrystian'],
    tags: ['Dart - Flutter'],
    complexity: 'Beginner, Intermediate, Advance',
    href: '/sessions/CFP-012/',
  },
  'CFP-014': {
    id: 'CFP-014',
    title: 'AI Code Review: Comparing Ready-Made Tools and Building Your Own',
    start: '12:00',
    end: '12:45',
    space: 'auditorium',
    kind: 'session',
    speakers: ['Ivan Lapa'],
    tags: ['AI', 'AI - Antigravity', 'Google Cloud', 'Web - AI for Web Developers'],
    complexity: 'Advance, Intermediate, Beginner',
    href: '/sessions/CFP-014/',
  },
  'CFP-050': {
    id: 'CFP-050',
    title: 'Stop Guessing, Start Debugging (with Antigravity & Chrome DevTools MCP)',
    start: '12:00',
    end: '13:00',
    space: 'classroom',
    kind: 'workshop',
    speakers: ['Dominika Zając'],
    tags: ['AI', 'Web - AI for Web Developers', 'Web - DevTools & Browser Automation'],
    complexity: 'Beginner',
    href: '/sessions/CFP-050/',
  },
  'CFP-034': {
    id: 'CFP-034',
    title: 'Beyond Prompt Engineering: Solving Complex Optimization Problems with AlphaEvolve',
    start: '13:00',
    end: '13:45',
    space: 'auditorium',
    kind: 'session',
    speakers: ['Hasan Rafiq'],
    tags: ['AI', 'AI - Gemini Enterprise Agent Platform', 'AI - Gemini'],
    complexity: 'Intermediate',
    href: '/sessions/CFP-034/',
  },
  'CFP-043': {
    id: 'CFP-043',
    title: 'So you want to be a Developer in 2026...',
    start: '13:00',
    end: '13:30',
    space: 'classroom',
    kind: 'session',
    speakers: ['Michał Tajchert'],
    tags: ['AI', 'Build with AI'],
    complexity: 'Beginner, Advance, Intermediate',
    href: '/sessions/CFP-043/',
  },
  'PANEL-01': {
    id: 'PANEL-01',
    title: 'From 10x Coders to 10x Teams: Engineering Leadership with AI',
    start: '15:00',
    end: '16:00',
    space: 'auditorium',
    kind: 'panel',
    speakers: [
      'Dmytro Nedvetskyi',
      'Yaroslav Polyakov',
      'Igor Kachura',
      'Serhii Kasianchuk',
      'Viacheslav Miroshnychenko',
    ],
    tags: ['Engineering Culture', 'AI'],
    href: '/sessions/PANEL-01/',
  },
  'INVITED-005': {
    id: 'INVITED-005',
    title: 'SRE for AI: How Google Keeps AI Systems Reliable and Performant',
    start: '15:00',
    end: '16:00',
    space: 'classroom',
    kind: 'workshop',
    speakers: ['Bruno Sienkiewicz'],
    tags: ['AI', 'Google Cloud', 'SRE', 'Reliability'],
    complexity: 'Beginner, Intermediate',
    href: '/sessions/INVITED-005/',
  },
  'CFP-028': {
    id: 'CFP-028',
    title: "Voice agents, hype-free: lessons from Gemini's audio stack",
    start: '16:10',
    end: '16:40',
    space: 'auditorium',
    kind: 'session',
    speakers: ['Tomasz Porożyński'],
    tags: ['AI', 'AI - Gemini', 'AI - Gemini Enterprise Agent Platform', 'AI - AI Studio'],
    complexity: 'Intermediate, Advance',
    href: '/sessions/CFP-028/',
  },
  'CFP-015': {
    id: 'CFP-015',
    title: 'Building a Custom AI Code Reviewer with GitHub Actions and MCP',
    start: '16:10',
    end: '16:55',
    space: 'classroom',
    kind: 'workshop',
    speakers: ['Ivan Lapa'],
    tags: ['AI', 'AI - Agent Development Kit (ADK)'],
    complexity: 'Intermediate, Beginner, Advance',
    href: '/sessions/CFP-015/',
  },
  'scaling-hugging-face-hub': {
    id: 'scaling-hugging-face-hub',
    title: 'Serving 3 Million Models Without Melting: Scaling the Hugging Face Hub with MongoDB.',
    start: '17:05',
    end: '17:35',
    space: 'auditorium',
    kind: 'session',
    speakers: ['Arek Borucki'],
    tags: ['MongoDB', 'Machine Learning', 'Infrastructure', 'Scaling'],
    href: '/sessions/scaling-hugging-face-hub/',
  },
  'INVITED-003': {
    id: 'INVITED-003',
    title: 'Closing the Data Fly Wheel loop',
    start: '17:05',
    end: '17:50',
    space: 'classroom',
    kind: 'workshop',
    speakers: ['Greg Radzio'],
    tags: ['AI', 'Agents', 'Evaluations'],
    href: '/sessions/INVITED-003/',
  },
  'INVITED-002': {
    id: 'INVITED-002',
    title: 'The Agentic Web',
    start: '18:00',
    end: '18:45',
    space: 'auditorium',
    kind: 'session',
    speakers: ['Kasper Kulikowski'],
    tags: ['AI', 'Web - AI for Web Developers'],
    href: '/sessions/INVITED-002/',
  },
  'INVITED-001': {
    id: 'INVITED-001',
    title:
      'Stop Chatting with Your Docs — Architecting a Local-First AI Mind Coach in TypeScript with Gemma & Gemini Argon',
    start: '18:00',
    end: '18:45',
    space: 'classroom',
    kind: 'workshop',
    speakers: ['Adrian Romański'],
    tags: ['AI', 'Gemma', 'Gemini', 'Offline-first'],
    href: '/sessions/INVITED-001/',
  },
};

const WORKSHOP_IDS = [
  'INVITED-004',
  'CFP-050',
  'INVITED-005',
  'CFP-015',
  'INVITED-003',
  'INVITED-001',
] as const;

const CONCIERGE_SYSTEM_INSTRUCTION = `You are the DevFest Warsaw 2026 Concierge, generating structured A2UI plans.
STRICT GROUNDING RULES:
- Never invent sessions, times, rooms, speakers, or URLs. Use ONLY the canonical session IDs and facts below.
- Event: GDG DevFest Warsaw 2026: Real Work, Real Lessons on November 21, 2026 (Europe/Warsaw).
- Venue: Google for Startups Campus Warsaw, Plac Konesera 10, 03-736 Warszawa.
- Transit & Parking: Metro M2 Dworzec Wilenski (short walk), buses/trams at Dworzec Wilenski & Zabkowska. Saturday street parking in Warsaw paid zone is free (subject to space/signs); Koneser has a 24h paid underground car park.
- Facilities: Wi-Fi available; unmonitored self-service cloakroom (keep valuables with you); wheelchair accessible with step-free seating, ramps, and lifts; contact hello@gdgwarsaw.pl.
- Agenda Activities: 09:00 Registration, networking & games; 10:00-10:15 Opening; 14:00-15:00 Lunch (both spaces); 18:55-19:15 Closing, results & awards (Auditorium); 19:15-21:30 Afterparty & networking.
- $5 Google Cloud Credits: 330 credits pool, claimable 09:00-19:00 Warsaw time on 21 Nov 2026, valid for 12 hours after claiming. Bring your own laptop for Classroom workshops.
- Canonical 16 Sessions (ID | Time | Room | Kind | Title | Speakers):
  - CFP-021 | 10:15-10:45 | auditorium | session | Written by Agents. Reviewed by Nobody. Running in Production | Yonatan Levin
  - INVITED-004 | 10:15-10:55 | classroom | workshop | AI at Zero Token Cost: Local-First Browser AI and Prompt API | Julia Rapczynska
  - CFP-002 | 11:00-11:45 | auditorium | session | Event-Driven AI Pipelines on GCP: From Eventarc to LLMs | Calgan Aygun
  - CFP-012 | 11:00-11:45 | classroom | session | The Physics of Voice: Building a Coach in Flutter with Whisper and Acoustic Analysis | Andrii Khrystian
  - CFP-014 | 12:00-12:45 | auditorium | session | AI Code Review: Comparing Ready-Made Tools and Building Your Own | Ivan Lapa
  - CFP-050 | 12:00-13:00 | classroom | workshop | Stop Guessing, Start Debugging (with Antigravity & Chrome DevTools MCP) | Dominika Zajac
  - CFP-034 | 13:00-13:45 | auditorium | session | Beyond Prompt Engineering: Solving Complex Optimization Problems with AlphaEvolve | Hasan Rafiq
  - CFP-043 | 13:00-13:30 | classroom | session | So you want to be a Developer in 2026... | Michal Tajchert
  - PANEL-01 | 15:00-16:00 | auditorium | panel | From 10x Coders to 10x Teams: Engineering Leadership with AI | Dmytro Nedvetskyi, Yaroslav Polyakov, Igor Kachura, Serhii Kasianchuk, Viacheslav Miroshnychenko
  - INVITED-005 | 15:00-16:00 | classroom | workshop | SRE for AI: How Google Keeps AI Systems Reliable and Performant | Bruno Sienkiewicz
  - CFP-028 | 16:10-16:40 | auditorium | session | Voice agents, hype-free: lessons from Gemini's audio stack | Tomasz Porozynski
  - CFP-015 | 16:10-16:55 | classroom | workshop | Building a Custom AI Code Reviewer with GitHub Actions and MCP | Ivan Lapa
  - scaling-hugging-face-hub | 17:05-17:35 | auditorium | session | Serving 3 Million Models Without Melting: Scaling the Hugging Face Hub with MongoDB. | Arek Borucki
  - INVITED-003 | 17:05-17:50 | classroom | workshop | Closing the Data Fly Wheel loop | Greg Radzio
  - INVITED-002 | 18:00-18:45 | auditorium | session | The Agentic Web | Kasper Kulikowski
  - INVITED-001 | 18:00-18:45 | classroom | workshop | Stop Chatting with Your Docs — Architecting a Local-First AI Mind Coach in TypeScript with Gemma & Gemini Argon | Adrian Romanski
Return concise, practical engineering recommendations matching the JSON schema.`;

const CONCIERGE_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['title', 'banner', 'sessionRecommendations', 'followUpChips'],
  properties: {
    title: { type: 'string' },
    subtitle: { type: 'string' },
    badge: { type: 'string' },
    banner: {
      type: 'object',
      required: ['tone', 'title', 'body'],
      properties: {
        tone: { type: 'string', enum: ['info', 'success', 'warning'] },
        kicker: { type: 'string' },
        title: { type: 'string' },
        body: { type: 'string' },
      },
    },
    sessionRecommendations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['sessionId', 'reason'],
        properties: {
          sessionId: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    comparison: {
      type: 'object',
      required: ['title', 'columns'],
      properties: {
        title: { type: 'string' },
        columns: {
          type: 'array',
          items: {
            type: 'object',
            required: ['badge', 'heading', 'summary', 'bestFor'],
            properties: {
              id: { type: 'string' },
              badge: { type: 'string' },
              heading: { type: 'string' },
              summary: { type: 'string' },
              bestFor: { type: 'string' },
              sessionId: { type: 'string' },
            },
          },
        },
      },
    },
    creditGuide: {
      type: 'object',
      required: ['title', 'statusSummary', 'steps'],
      properties: {
        title: { type: 'string' },
        statusSummary: { type: 'string' },
        steps: { type: 'array', items: { type: 'string' } },
      },
    },
    logistics: {
      type: 'object',
      required: ['title', 'items'],
      properties: {
        title: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['label', 'value'],
            properties: {
              label: { type: 'string' },
              value: { type: 'string' },
              detail: { type: 'string' },
            },
          },
        },
      },
    },
    followUpChips: {
      type: 'array',
      items: {
        type: 'object',
        required: ['label', 'prompt'],
        properties: {
          label: { type: 'string' },
          prompt: { type: 'string' },
          intent: { type: 'string' },
        },
      },
    },
  },
};

export type ConciergeDeps = {
  now?: number;
  db?: Firestore | null;
  getApiKey: () => string;
  fetchFn?: typeof fetch;
};

type ConciergeRequest = Pick<Request, 'method' | 'body' | 'headers' | 'ip' | 'connection'>;

type ModelBanner = {
  tone?: string;
  kicker?: string;
  title?: string;
  body?: string;
};

type ModelPlan = {
  title?: string;
  subtitle?: string;
  badge?: string;
  banner?: ModelBanner;
  sessionRecommendations?: Array<{ sessionId?: string; reason?: string }>;
  comparison?: {
    title?: string;
    columns?: Array<{
      id?: string;
      badge?: string;
      heading?: string;
      summary?: string;
      bestFor?: string;
      sessionId?: string;
    }>;
  };
  creditGuide?: {
    title?: string;
    statusSummary?: string;
    steps?: string[];
  };
  logistics?: {
    title?: string;
    items?: Array<{ label?: string; value?: string; detail?: string }>;
  };
  followUpChips?: Array<{ label?: string; prompt?: string; intent?: string }>;
};

type A2UINode = {
  id: string;
  component: string;
  parentId: string | null;
  children?: string[];
  props: Record<string, unknown>;
  bindings?: Record<string, string>;
};

function setSecurityHeaders(response: Response) {
  response.set('Cache-Control', 'private, no-store, max-age=0');
  response.set('Referrer-Policy', 'no-referrer');
  response.set('X-Robots-Tag', 'noindex, nofollow');
}

function parseMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function computeCanonicalConflicts(savedIds: string[]): Record<string, string> {
  const conflicts: Record<string, string> = {};
  const sessions = savedIds
    .map((id) => CANONICAL_SESSIONS[id])
    .filter((s): s is CanonicalSession => Boolean(s));

  for (let i = 0; i < sessions.length; i += 1) {
    for (let j = i + 1; j < sessions.length; j += 1) {
      const a = sessions[i];
      const b = sessions[j];
      const aStart = parseMinutes(a.start);
      const aEnd = parseMinutes(a.end);
      const bStart = parseMinutes(b.start);
      const bEnd = parseMinutes(b.end);
      if (aStart < bEnd && bStart < aEnd) {
        if (!conflicts[a.id]) {
          conflicts[a.id] = `Overlaps with ${b.title} (${b.start}-${b.end}, ${b.space})`;
        }
        if (!conflicts[b.id]) {
          conflicts[b.id] = `Overlaps with ${a.title} (${a.start}-${a.end}, ${a.space})`;
        }
      }
    }
  }
  return conflicts;
}

function sanitizeRequestBody(rawBody: unknown): {
  query: string;
  intent: string;
  savedSessionIds: string[];
  clientNow?: number;
} | null {
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return null;
  }
  const body = rawBody as Record<string, unknown>;
  const query = typeof body.query === 'string' ? body.query.trim().slice(0, 300) : '';
  const intent = typeof body.intent === 'string' ? body.intent.trim().slice(0, 64) : '';
  if (!query && !intent) {
    return null;
  }

  const rawSaved = Array.isArray(body.savedSessionIds) ? body.savedSessionIds : [];
  const seen = new Set<string>();
  const savedSessionIds: string[] = [];
  for (const item of rawSaved) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || trimmed.length > 40 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    savedSessionIds.push(trimmed);
    if (savedSessionIds.length >= 25) break;
  }

  const clientNow =
    typeof body.now === 'number' && Number.isFinite(body.now) ? body.now : undefined;

  return { query, intent, savedSessionIds, clientNow };
}

function extractModelJsonText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  if (typeof obj.output_text === 'string' && obj.output_text.trim()) {
    return obj.output_text.trim();
  }
  if (Array.isArray(obj.steps)) {
    for (const step of obj.steps) {
      if (!step || typeof step !== 'object') continue;
      const stepObj = step as Record<string, unknown>;
      if (stepObj.type !== 'model_output') continue;
      if (typeof stepObj.output_text === 'string' && stepObj.output_text.trim()) {
        return stepObj.output_text.trim();
      }
      if (typeof stepObj.text === 'string' && stepObj.text.trim()) {
        return stepObj.text.trim();
      }
      if (typeof stepObj.content === 'string' && stepObj.content.trim()) {
        return stepObj.content.trim();
      }
    }
  }
  return null;
}

function parseModelPlan(rawText: string): ModelPlan | null {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const plan = parsed as ModelPlan;
    if (typeof plan.title !== 'string' || !plan.title.trim()) return null;
    if (!plan.banner || typeof plan.banner !== 'object') return null;
    if (typeof plan.banner.title !== 'string' || typeof plan.banner.body !== 'string') {
      return null;
    }
    return plan;
  } catch {
    return null;
  }
}

function buildA2UIMessages(
  plan: ModelPlan,
  query: string,
  intent: string,
  savedSessionIds: string[],
  now: number,
) {
  const surfaceId = `concierge-${now}`;
  const validSavedIds = savedSessionIds.filter((id) => Boolean(CANONICAL_SESSIONS[id]));
  const savedSessions: Record<string, boolean> = {};
  for (const id of validSavedIds) {
    savedSessions[id] = true;
  }
  const conflicts = computeCanonicalConflicts(validSavedIds);

  const rootId = 'surface-root';
  const rootChildren: string[] = [];
  const components: A2UINode[] = [];

  const tone =
    plan.banner?.tone === 'success' || plan.banner?.tone === 'warning' ? plan.banner.tone : 'info';

  const bannerId = 'banner-main';
  rootChildren.push(bannerId);
  components.push({
    id: bannerId,
    component: 'CalloutBanner',
    parentId: rootId,
    props: {
      tone,
      ...(typeof plan.banner?.kicker === 'string' && plan.banner.kicker.trim()
        ? { kicker: plan.banner.kicker.trim() }
        : {}),
      title: (plan.banner?.title || plan.title || 'DevFest Warsaw 2026').trim(),
      body: (plan.banner?.body || '').trim(),
    },
  });

  if (Array.isArray(plan.sessionRecommendations)) {
    const seenRecs = new Set<string>();
    for (const rec of plan.sessionRecommendations) {
      if (!rec || typeof rec.sessionId !== 'string') continue;
      const canonical = CANONICAL_SESSIONS[rec.sessionId.trim()];
      if (!canonical || seenRecs.has(canonical.id)) continue;
      seenRecs.add(canonical.id);

      const nodeId = `session-${canonical.id}`;
      rootChildren.push(nodeId);
      components.push({
        id: nodeId,
        component: 'SessionCard',
        parentId: rootId,
        props: {
          sessionId: canonical.id,
          title: canonical.title,
          start: canonical.start,
          end: canonical.end,
          space: canonical.space,
          kind: canonical.kind,
          speakers: canonical.speakers,
          tags: canonical.tags,
          ...(canonical.complexity ? { complexity: canonical.complexity } : {}),
          ...(typeof rec.reason === 'string' && rec.reason.trim()
            ? { reason: rec.reason.trim() }
            : {}),
          href: canonical.href,
          bindSavedPath: `savedSessions.${canonical.id}`,
          bindConflictPath: `conflicts.${canonical.id}`,
        },
        bindings: {
          saved: `savedSessions.${canonical.id}`,
          conflict: `conflicts.${canonical.id}`,
        },
      });
    }
  }

  if (plan.comparison && Array.isArray(plan.comparison.columns)) {
    const validCols = plan.comparison.columns
      .filter((col) => col && typeof col.heading === 'string' && typeof col.summary === 'string')
      .map((col, idx) => {
        const canonical =
          typeof col.sessionId === 'string' ? CANONICAL_SESSIONS[col.sessionId.trim()] : undefined;
        return {
          id: typeof col.id === 'string' && col.id.trim() ? col.id.trim() : `col-${idx}`,
          badge: typeof col.badge === 'string' ? col.badge.trim() : 'Track',
          heading: canonical ? canonical.title : col.heading!.trim(),
          ...(canonical ? { time: `${canonical.start}-${canonical.end}` } : {}),
          ...(canonical ? { space: canonical.space } : {}),
          ...(canonical ? { speakers: canonical.speakers.join(', ') } : {}),
          summary: col.summary!.trim(),
          bestFor: typeof col.bestFor === 'string' ? col.bestFor.trim() : 'All attendees',
          ...(canonical ? { href: canonical.href, sessionId: canonical.id } : {}),
        };
      });

    if (validCols.length > 0) {
      const compId = 'comparison-main';
      rootChildren.push(compId);
      components.push({
        id: compId,
        component: 'ComparisonGrid',
        parentId: rootId,
        props: {
          title:
            typeof plan.comparison.title === 'string' && plan.comparison.title.trim()
              ? plan.comparison.title.trim()
              : 'Room & Track Comparison',
          columns: validCols,
        },
      });
    }
  }

  if (plan.creditGuide && typeof plan.creditGuide.statusSummary === 'string') {
    const creditId = 'credit-guide-main';
    rootChildren.push(creditId);
    const workshops = WORKSHOP_IDS.map((id) => {
      const s = CANONICAL_SESSIONS[id];
      return {
        sessionId: s.id,
        title: s.title,
        time: `${s.start}-${s.end}`,
        space: s.space,
        speaker: s.speakers.join(', '),
        href: s.href,
      };
    });
    const steps = Array.isArray(plan.creditGuide.steps)
      ? plan.creditGuide.steps.filter(
          (st): st is string => typeof st === 'string' && st.trim().length > 0,
        )
      : [];
    components.push({
      id: creditId,
      component: 'CreditGuideCard',
      parentId: rootId,
      props: {
        title:
          typeof plan.creditGuide.title === 'string' && plan.creditGuide.title.trim()
            ? plan.creditGuide.title.trim()
            : '$5 Google Cloud Credits & Workshops',
        claimWindow: '09:00-19:00 Warsaw time (21 Nov 2026)',
        validity: '12 hours after claiming',
        poolSize: '330 credits',
        statusSummary: plan.creditGuide.statusSummary.trim(),
        steps:
          steps.length > 0
            ? steps
            : [
                'Bring your own laptop for Classroom workshops.',
                'Claim your $5 Google Cloud credit between 09:00 and 19:00 Warsaw time.',
                'Use the credit within 12 hours of claiming.',
              ],
        workshops,
      },
    });
  }

  if (plan.logistics && Array.isArray(plan.logistics.items)) {
    const items = plan.logistics.items
      .filter((item) => item && typeof item.label === 'string' && typeof item.value === 'string')
      .map((item) => ({
        label: item.label!.trim(),
        value: item.value!.trim(),
        ...(typeof item.detail === 'string' && item.detail.trim()
          ? { detail: item.detail.trim() }
          : {}),
      }));
    if (items.length > 0) {
      const logisticsId = 'logistics-main';
      rootChildren.push(logisticsId);
      components.push({
        id: logisticsId,
        component: 'LogisticsCard',
        parentId: rootId,
        props: {
          title:
            typeof plan.logistics.title === 'string' && plan.logistics.title.trim()
              ? plan.logistics.title.trim()
              : 'Venue & Logistics',
          items,
          directionsUrl:
            'https://maps.google.com/?q=Google+for+Startups+Campus+Warsaw+Plac+Konesera+10',
          visitAnchor: '/#visit',
        },
      });
    }
  }

  const chips = Array.isArray(plan.followUpChips)
    ? plan.followUpChips
        .filter((chip) => chip && typeof chip.label === 'string' && typeof chip.prompt === 'string')
        .slice(0, 6)
        .map((chip, idx) => ({
          id: `chip-${idx}`,
          label: chip.label!.trim(),
          prompt: chip.prompt!.trim(),
          ...(typeof chip.intent === 'string' && chip.intent.trim()
            ? { intent: chip.intent.trim() }
            : {}),
        }))
    : [];

  if (chips.length > 0) {
    const chipRowId = 'chips-main';
    rootChildren.push(chipRowId);
    components.push({
      id: chipRowId,
      component: 'ActionChipRow',
      parentId: rootId,
      props: {
        label: 'Follow-up actions',
        chips,
      },
    });
  }

  const rootNode: A2UINode = {
    id: rootId,
    component: 'SurfaceContainer',
    parentId: null,
    children: rootChildren,
    props: {
      title: (plan.title || 'DevFest Warsaw 2026 Concierge').trim(),
      ...(typeof plan.subtitle === 'string' && plan.subtitle.trim()
        ? { subtitle: plan.subtitle.trim() }
        : {}),
      badge:
        typeof plan.badge === 'string' && plan.badge.trim()
          ? plan.badge.trim()
          : 'A2UI · Gemini 4 Hydrogen (Medium)',
    },
  };

  return [
    {
      type: 'createSurface',
      surfaceId,
      title: rootNode.props.title,
      source: 'gemini-4-hydrogen',
      timestamp: now,
    },
    {
      type: 'updateDataModel',
      surfaceId,
      data: {
        savedSessions,
        conflicts,
        credits: {
          window: '09:00-19:00 Warsaw time',
          pool: '330 credits',
          validity: '12 hours after claiming',
        },
        query,
        intent,
      },
    },
    {
      type: 'updateComponents',
      surfaceId,
      rootId,
      components: [rootNode, ...components],
    },
  ];
}

export async function handleConcierge(
  request: ConciergeRequest,
  response: Response,
  deps: ConciergeDeps,
) {
  setSecurityHeaders(response);

  if (request.method !== 'POST') {
    response.set('Allow', 'POST').status(405).json({ status: 'method-not-allowed' });
    return;
  }

  const parsed = sanitizeRequestBody(request.body);
  if (!parsed) {
    response.status(400).json({ status: 'invalid-request', fallback: 'local-a2ui' });
    return;
  }

  const now = deps.now ?? parsed.clientNow ?? Date.now();
  const nowDate = new Date(now);

  if (deps.db) {
    const clientIp = getClientIp(request);
    const ipLimit = await checkRateLimit({
      db: deps.db,
      prefix: 'concierge-ip',
      key: clientIp,
      maxAttempts: 45,
      windowSeconds: 900,
      now: nowDate,
    });
    if (!ipLimit.allowed) {
      response.set('X-RateLimit-Remaining', '0');
      response.set('X-RateLimit-Reset', String(Math.ceil(ipLimit.resetAt.getTime() / 1000)));
      response.status(429).json({
        status: 'rate-limited',
        fallback: 'local-a2ui',
        resetAt: ipLimit.resetAt.toISOString(),
      });
      return;
    }

    const globalLimit = await checkRateLimit({
      db: deps.db,
      prefix: 'concierge-global-30h',
      key: 'devfest-2026-sponsored',
      maxAttempts: 6000,
      windowSeconds: 108000,
      now: nowDate,
    });
    if (!globalLimit.allowed) {
      response.set('X-RateLimit-Remaining', '0');
      response.set('X-RateLimit-Reset', String(Math.ceil(globalLimit.resetAt.getTime() / 1000)));
      response.status(429).json({
        status: 'rate-limited',
        fallback: 'local-a2ui',
        resetAt: globalLimit.resetAt.toISOString(),
      });
      return;
    }

    response.set(
      'X-RateLimit-Remaining',
      String(Math.min(ipLimit.remaining, globalLimit.remaining)),
    );
    response.set('X-RateLimit-Reset', String(Math.ceil(ipLimit.resetAt.getTime() / 1000)));
  }

  const apiKey = (deps.getApiKey() || '').trim();
  if (!apiKey) {
    response.status(503).json({ status: 'unavailable', fallback: 'local-a2ui' });
    return;
  }

  const fetchImpl = deps.fetchFn ?? fetch;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const userInput = JSON.stringify({
      query: parsed.query,
      intent: parsed.intent || undefined,
      savedSessionIds: parsed.savedSessionIds,
      currentTimestampIso: nowDate.toISOString(),
    });

    const upstreamRes = await fetchImpl(
      'https://generativelanguage.googleapis.com/v1/interactions',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Api-Revision': '2026-05-20',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gemini-4-hydrogen',
          system_instruction: CONCIERGE_SYSTEM_INSTRUCTION,
          input: userInput,
          generation_config: {
            thinking_level: 'medium',
            max_output_tokens: 32768,
          },
          response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema: CONCIERGE_RESPONSE_SCHEMA,
          },
          store: false,
        }),
        signal: controller.signal,
      },
    );

    if (!upstreamRes.ok) {
      response.status(502).json({ status: 'upstream-error', fallback: 'local-a2ui' });
      return;
    }

    const upstreamJson = (await upstreamRes.json()) as unknown;
    const rawText = extractModelJsonText(upstreamJson);
    if (!rawText) {
      response.status(502).json({ status: 'upstream-error', fallback: 'local-a2ui' });
      return;
    }

    const plan = parseModelPlan(rawText);
    if (!plan) {
      response.status(502).json({ status: 'upstream-error', fallback: 'local-a2ui' });
      return;
    }

    const messages = buildA2UIMessages(
      plan,
      parsed.query,
      parsed.intent,
      parsed.savedSessionIds,
      now,
    );

    response.status(200).json({
      status: 'ok',
      model: 'gemini-4-hydrogen',
      thinkingLevel: 'medium',
      messages,
    });
  } catch {
    response.status(502).json({ status: 'upstream-error', fallback: 'local-a2ui' });
  } finally {
    clearTimeout(timeoutId);
  }
}
