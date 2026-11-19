import { eventInstant, type AgendaItem, type AgendaSpace } from '../utils/agenda-preview-data';
import type { PreviewSource } from '../utils/speakers-preview-data';
import type { A2UIComponentNode, A2UIMessage } from './a2ui-protocol';

export type ConciergeIntent =
  | 'overview'
  | 'track-ai'
  | 'track-cloud'
  | 'credits-workshops'
  | 'compare-rooms'
  | 'logistics-venue'
  | 'saved-schedule'
  | 'team-organizer';

export interface TeamMemberInfo {
  name: string;
  profileUrl?: string;
  socials?: Array<{ name: string; link: string }>;
}

export interface LocalConciergeRequest {
  query: string;
  intent?: string;
  agendaItems: AgendaItem[];
  programme: PreviewSource;
  savedSessionIds: string[];
  creditStatus: string;
  now: number;
  teamMembers?: TeamMemberInfo[];
}

const VALID_INTENTS: ReadonlySet<string> = new Set<ConciergeIntent>([
  'overview',
  'track-ai',
  'track-cloud',
  'credits-workshops',
  'compare-rooms',
  'logistics-venue',
  'saved-schedule',
  'team-organizer',
]);

const DEFAULT_TEAM_MEMBERS: TeamMemberInfo[] = [
  {
    name: 'Michał Jabłoński',
    profileUrl: 'https://gdg.community.dev/u/mpwqe3/',
    socials: [
      { name: 'LinkedIn', link: 'https://www.linkedin.com/in/m-jab/' },
      { name: 'Personal website', link: 'https://michaljablonski.dev/' },
    ],
  },
  {
    name: 'Vatsal Patel',
    profileUrl: 'https://gdg.community.dev/u/mrwpfx/',
    socials: [{ name: 'LinkedIn', link: 'https://www.linkedin.com/in/vatsal-patel-py/' }],
  },
  {
    name: 'Viktoriia Vinnykova',
    profileUrl: 'https://gdg.community.dev/u/mcxbxr/',
    socials: [{ name: 'LinkedIn', link: 'https://www.linkedin.com/in/viktoriia-vinnykova/' }],
  },
  {
    name: 'Oleksandr Katrych',
    profileUrl: 'https://gdg.community.dev/u/mjuxfk/',
    socials: [{ name: 'LinkedIn', link: 'https://www.linkedin.com/in/oleksandr-katrych' }],
  },
  {
    name: 'Anhelina Sudenkova',
    profileUrl: 'https://gdg.community.dev/u/angelina1/',
    socials: [{ name: 'LinkedIn', link: 'https://www.linkedin.com/in/anhelina-sudenkova/' }],
  },
  {
    name: 'Maryna Kamienieva',
    profileUrl: 'https://gdg.community.dev/u/m9pkp3/',
    socials: [{ name: 'LinkedIn', link: 'https://www.linkedin.com/in/kamienieva' }],
  },
  {
    name: 'Jakub Kołakowski',
    profileUrl: 'https://gdg.community.dev/u/mwwkjv/',
    socials: [{ name: 'LinkedIn', link: 'https://www.linkedin.com/in/jkolski/' }],
  },
  {
    name: 'Kamil Krawczyk',
    profileUrl: 'https://gdg.community.dev/u/m4m895/',
    socials: [{ name: 'LinkedIn', link: 'https://www.linkedin.com/in/kamil-krawczyk2/' }],
  },
];

function foldDiacritics(input: string): string {
  return input
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function findMatchingTeamMembers(query: string, members: TeamMemberInfo[]): TeamMemberInfo[] {
  const foldedQuery = foldDiacritics(query).trim();
  if (!foldedQuery) return [];
  if (/\b(organizer|organizers|team|who organizes|who runs)\b/.test(foldedQuery)) {
    return members;
  }
  return members.filter((member) => {
    const foldedName = foldDiacritics(member.name);
    if (foldedQuery.includes(foldedName)) return true;
    const parts = foldedName.split(/\s+/).filter((p) => p.length >= 4);
    return parts.some((part) => foldedQuery.includes(part));
  });
}

const CREDIT_WORKSHOP_IDS = [
  'INVITED-004',
  'CFP-050',
  'INVITED-005',
  'CFP-015',
  'INVITED-003',
  'INVITED-001',
];

const PARALLEL_SLOTS = ['10:15', '11:00', '12:00', '13:00', '15:00', '16:10', '17:05', '18:00'];

export const EVENT_TRANSITION_TIMES = [
  '09:00',
  '10:00',
  '10:15',
  '10:45',
  '10:55',
  '11:00',
  '11:45',
  '12:00',
  '12:45',
  '13:00',
  '13:30',
  '13:45',
  '14:00',
  '15:00',
  '16:00',
  '16:10',
  '16:40',
  '16:55',
  '17:05',
  '17:35',
  '17:50',
  '18:00',
  '18:45',
  '18:55',
  '19:00',
  '19:15',
  '21:30',
] as const;

export interface ScheduleTimeSlot {
  slotKey: string;
  phase: 'pre-event' | 'live' | 'post-event';
  nextBoundaryAt: number | null;
}

export function getScheduleTimeSlot(now: number): ScheduleTimeSlot {
  const boundaries = EVENT_TRANSITION_TIMES.map((hhmm) => eventInstant(hhmm));
  const firstStart = boundaries[0]!;
  if (now < firstStart) {
    return {
      slotKey: 'pre-event',
      phase: 'pre-event',
      nextBoundaryAt: firstStart,
    };
  }

  for (let i = 0; i < EVENT_TRANSITION_TIMES.length - 1; i++) {
    const startMs = boundaries[i]!;
    const endMs = boundaries[i + 1]!;
    if (now >= startMs && now < endMs) {
      return {
        slotKey: `slot:${EVENT_TRANSITION_TIMES[i]!}-${EVENT_TRANSITION_TIMES[i + 1]!}`,
        phase: 'live',
        nextBoundaryAt: endMs,
      };
    }
  }

  return {
    slotKey: 'post-event',
    phase: 'post-event',
    nextBoundaryAt: null,
  };
}

const TIME_SENSITIVE_PATTERN =
  /\b(now|right now|currently|happening|on now|live|up next|next session|next talk|next workshop|starting soon|what'?s next|whats next|today|this hour|remaining|left today|in progress|open now|available now|teraz|aktualnie|obecnie|zaraz|nastepn\w*|na zywo)\b/;

export function isTimeSensitiveQuery(query: string, intent?: string): boolean {
  if (intent === 'compare-rooms') return true;
  return TIME_SENSITIVE_PATTERN.test(foldDiacritics(query));
}

function formatWarsawTime(now: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(now));
}

function formatSpace(space: AgendaSpace): string {
  switch (space) {
    case 'auditorium':
      return 'Auditorium';
    case 'classroom':
      return 'Classroom';
    case 'both':
      return 'Event-wide';
  }
}

function formatKind(kind: AgendaItem['kind']): string {
  switch (kind) {
    case 'session':
      return 'Talk';
    case 'workshop':
      return 'Workshop';
    case 'panel':
      return 'Panel';
    case 'activity':
      return 'Activity';
    case 'open':
      return 'Open slot';
  }
}

export function computeSavedConflicts(
  agendaItems: AgendaItem[],
  savedIds: string[],
): Record<string, string> {
  const savedSet = new Set(savedIds.filter(Boolean));
  if (savedSet.size < 2) return {};

  const timedSaved = agendaItems
    .filter((item) => savedSet.has(item.id) && Boolean(item.end))
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));

  const conflictMap = new Map<string, string[]>();

  for (let i = 0; i < timedSaved.length; i++) {
    const a = timedSaved[i];
    if (!a || !a.end) continue;
    const startA = eventInstant(a.start);
    const endA = eventInstant(a.end);

    for (let j = i + 1; j < timedSaved.length; j++) {
      const b = timedSaved[j];
      if (!b || !b.end || a.id === b.id) continue;
      const startB = eventInstant(b.start);
      const endB = eventInstant(b.end);

      if (startA < endB && startB < endA) {
        const msgForA = `Overlaps with "${b.title}" (${b.start}–${b.end}, ${formatSpace(b.space)})`;
        const msgForB = `Overlaps with "${a.title}" (${a.start}–${a.end}, ${formatSpace(a.space)})`;

        const listA = conflictMap.get(a.id) ?? [];
        listA.push(msgForA);
        conflictMap.set(a.id, listA);

        const listB = conflictMap.get(b.id) ?? [];
        listB.push(msgForB);
        conflictMap.set(b.id, listB);
      }
    }
  }

  const result: Record<string, string> = {};
  for (const [id, messages] of conflictMap.entries()) {
    result[id] = messages.join('; ');
  }
  return result;
}

function inferIntent(
  query: string,
  explicitIntent?: string,
  matchedTeamMembers: TeamMemberInfo[] = [],
): ConciergeIntent {
  if (
    explicitIntent &&
    VALID_INTENTS.has(explicitIntent) &&
    (explicitIntent !== 'overview' || !query.trim())
  ) {
    return explicitIntent as ConciergeIntent;
  }

  if (matchedTeamMembers.length > 0) {
    return 'team-organizer';
  }

  const q = query.trim().toLowerCase();
  if (!q) return 'overview';

  if (/credit|\$5|5\$|workshop|hands-on|handson|byod|330|claim/.test(q)) {
    return 'credits-workshops';
  }

  if (/\bsaved\b|my schedule|my agenda|bookmark|conflict|overlap/.test(q)) {
    return 'saved-schedule';
  }

  if (
    /venue|address|koneser|metro|dworzec|parking|wifi|wi-fi|cloakroom|coat|coffee|(?<!before\s|after\s)\blunch\b|afterparty|accessibility|wheelchair|ticket|doors|directions|how to get|where is/.test(
      q,
    )
  ) {
    return 'logistics-venue';
  }

  if (
    /compare|\bvs\b|versus|auditorium|classroom|\blive\b|\bnow\b|\bnext\b|parallel|vibe zone|happening/.test(
      q,
    )
  ) {
    return 'compare-rooms';
  }

  if (
    /cloud|\bgcp\b|\bsre\b|backend|infra|infrastructure|eventarc|mongodb|hugging face|scaling|reliability|serverless/.test(
      q,
    )
  ) {
    return 'track-cloud';
  }

  if (
    /\bai\b|agent|\badk\b|gemini|gemma|\bmcp\b|devtools|antigravity|llm|build my track|voice|alphaevolve|eval|track/.test(
      q,
    )
  ) {
    return 'track-ai';
  }

  return 'overview';
}

function detectTimeWindow(query: string): 'all' | 'morning' | 'afternoon' {
  const q = query.toLowerCase();
  if (/morning|before lunch|\bam\b/.test(q)) return 'morning';
  if (/afternoon|after lunch|\bpm\b/.test(q)) return 'afternoon';
  return 'all';
}

function filterByTimeWindow(
  items: AgendaItem[],
  window: 'all' | 'morning' | 'afternoon',
): AgendaItem[] {
  if (window === 'morning') return items.filter((item) => item.start < '14:00');
  if (window === 'afternoon') return items.filter((item) => item.start >= '15:00');
  return items;
}

function scoreItemForTrack(
  item: AgendaItem,
  programme: PreviewSource,
  keywords: string[],
  queryWords: string[],
): number {
  const session = programme.sessions[item.id];
  const haystack = [item.title, session?.description ?? '', ...(session?.tags ?? [])]
    .join(' ')
    .toLowerCase();

  let score = 0;
  for (const kw of keywords) {
    if (haystack.includes(kw)) score += 2;
  }
  for (const qw of queryWords) {
    if (qw.length >= 3 && haystack.includes(qw)) score += 3;
  }
  return score;
}

function buildNonOverlappingTrack(
  agendaItems: AgendaItem[],
  programme: PreviewSource,
  keywords: string[],
  query: string,
): AgendaItem[] {
  const timeWindow = detectTimeWindow(query);
  const queryWords = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !['the', 'and', 'for', 'with', 'track', 'build'].includes(w));

  const candidates = filterByTimeWindow(
    agendaItems.filter(
      (item) => item.kind !== 'activity' && item.kind !== 'open' && Boolean(item.end),
    ),
    timeWindow,
  );

  const scored = candidates
    .map((item) => ({
      item,
      score: scoreItemForTrack(item, programme, keywords, queryWords),
    }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        a.item.start.localeCompare(b.item.start) ||
        b.score - a.score ||
        a.item.space.localeCompare(b.item.space),
    );

  const pool =
    scored.length > 0
      ? scored
      : candidates
          .map((item) => ({ item, score: 1 }))
          .sort((a, b) => a.item.start.localeCompare(b.item.start));

  const selected: AgendaItem[] = [];
  let lastEnd = 0;

  let i = 0;
  while (i < pool.length) {
    const slotStart = pool[i]!.item.start;
    const slotInstant = eventInstant(slotStart);
    const sameStart: typeof pool = [];
    while (i < pool.length && pool[i]!.item.start === slotStart) {
      sameStart.push(pool[i]!);
      i++;
    }
    if (slotInstant < lastEnd) continue;

    sameStart.sort((a, b) => b.score - a.score || a.item.space.localeCompare(b.item.space));
    const best = sameStart[0]?.item;
    if (best && best.end) {
      selected.push(best);
      lastEnd = eventInstant(best.end);
    }
  }

  return selected;
}

function makeSessionCard(
  id: string,
  item: AgendaItem,
  programme: PreviewSource,
  reason?: string,
): A2UIComponentNode {
  const session = programme.sessions[item.id];
  const props: Record<string, unknown> = {
    sessionId: item.id,
    title: item.title,
    start: item.start,
    end: item.end ?? '',
    space: formatSpace(item.space),
    kind: formatKind(item.kind),
    speakers: item.speakers.map((s) => s.name),
    href: item.href,
    bindConflictPath: `conflicts.${item.id}`,
    bindSavedPath: `savedSessions.${item.id}`,
  };

  if (session?.tags?.length) {
    props['tags'] = session.tags;
  }
  if (session?.complexity) {
    props['complexity'] = session.complexity;
  }
  if (reason) {
    props['reason'] = reason;
  }

  return {
    id,
    component: 'SessionCard',
    parentId: 'surface-root',
    props,
    bindings: {
      saved: `savedSessions.${item.id}`,
      conflict: `conflicts.${item.id}`,
    },
  };
}

function makeDefaultChips(currentIntent: ConciergeIntent): A2UIComponentNode {
  const followUps: Record<
    ConciergeIntent,
    Array<{ id: string; label: string; prompt: string; intent: ConciergeIntent }>
  > = {
    overview: [
      {
        id: 'chip-ai-track',
        label: 'Build AI track',
        prompt: 'Build my non-overlapping AI & Agents track',
        intent: 'track-ai',
      },
      {
        id: 'chip-credits',
        label: '$5 Cloud credits',
        prompt: 'How do the $5 Google Cloud credits and workshops work?',
        intent: 'credits-workshops',
      },
    ],
    'track-ai': [
      {
        id: 'chip-cloud-track',
        label: 'Cloud & SRE picks',
        prompt: 'Show me Cloud, SRE, and backend sessions',
        intent: 'track-cloud',
      },
      {
        id: 'chip-saved',
        label: 'Check conflicts',
        prompt: 'Check my saved schedule for conflicts',
        intent: 'saved-schedule',
      },
    ],
    'track-cloud': [
      {
        id: 'chip-credits',
        label: '$5 Cloud credits',
        prompt: 'How do the $5 Google Cloud credits and workshops work?',
        intent: 'credits-workshops',
      },
      {
        id: 'chip-saved',
        label: 'Check conflicts',
        prompt: 'Check my saved schedule for conflicts',
        intent: 'saved-schedule',
      },
    ],
    'credits-workshops': [
      {
        id: 'chip-compare',
        label: 'Compare rooms',
        prompt: 'Compare Auditorium vs Classroom sessions',
        intent: 'compare-rooms',
      },
      {
        id: 'chip-logistics',
        label: 'Venue & Wi-Fi',
        prompt: 'Where is the venue, metro, parking, and Wi-Fi?',
        intent: 'logistics-venue',
      },
    ],
    'compare-rooms': [
      {
        id: 'chip-ai-track',
        label: 'Build AI track',
        prompt: 'Build my non-overlapping AI & Agents track',
        intent: 'track-ai',
      },
      {
        id: 'chip-saved',
        label: 'My saved',
        prompt: 'Check my saved schedule for conflicts',
        intent: 'saved-schedule',
      },
    ],
    'logistics-venue': [
      {
        id: 'chip-credits',
        label: '$5 Cloud credits',
        prompt: 'How do the $5 Google Cloud credits and workshops work?',
        intent: 'credits-workshops',
      },
      {
        id: 'chip-compare',
        label: 'Compare rooms',
        prompt: 'Compare Auditorium vs Classroom sessions',
        intent: 'compare-rooms',
      },
    ],
    'saved-schedule': [
      {
        id: 'chip-ai-track',
        label: 'Suggest AI track',
        prompt: 'Build my non-overlapping AI & Agents track',
        intent: 'track-ai',
      },
      {
        id: 'chip-compare',
        label: 'Compare rooms',
        prompt: 'Compare Auditorium vs Classroom sessions',
        intent: 'compare-rooms',
      },
    ],
    'team-organizer': [
      {
        id: 'chip-logistics',
        label: 'Venue & contact',
        prompt: 'Where is the venue, metro, parking, and Wi-Fi?',
        intent: 'logistics-venue',
      },
      {
        id: 'chip-ai-track',
        label: 'Build AI track',
        prompt: 'Build my non-overlapping AI & Agents track',
        intent: 'track-ai',
      },
    ],
  };

  return {
    id: 'action-chips',
    component: 'ActionChipRow',
    parentId: 'surface-root',
    props: {
      label: 'Next step',
      chips: followUps[currentIntent],
    },
  };
}

function buildCompareRoomsNodes(req: LocalConciergeRequest): {
  title: string;
  subtitle: string;
  nodes: A2UIComponentNode[];
} {
  const ordered = [...req.agendaItems]
    .filter((item) => item.kind !== 'open')
    .sort((a, b) => a.start.localeCompare(b.start) || a.space.localeCompare(b.space));

  const nodes: A2UIComponentNode[] = [];
  const firstStart = ordered[0] ? eventInstant(ordered[0].start) : eventInstant('09:00');
  const timedEnds = ordered
    .filter((item) => Boolean(item.end))
    .map((item) => eventInstant(item.end!));
  const lastEnd = timedEnds.length > 0 ? Math.max(...timedEnds) : eventInstant('21:30');
  const isDuringEvent = req.now >= firstStart && req.now < lastEnd;

  const requestedSlot = PARALLEL_SLOTS.find((slot) => req.query.includes(slot));

  const warsawNow = formatWarsawTime(req.now);
  const slotState = getScheduleTimeSlot(req.now);

  let focusItems: AgendaItem[];
  let gridTitle = 'Auditorium vs Classroom vs Vibe Zone';
  let bannerBody =
    'Compare parallel tracks across the Main Auditorium (talks & panel), Classroom (hands-on workshops), and Vibe Zone (games, booths, networking).';

  if (isDuringEvent && !requestedSlot) {
    const current = ordered.filter(
      (item) => item.end && eventInstant(item.start) <= req.now && req.now < eventInstant(item.end),
    );
    const nextStart = current.length
      ? undefined
      : ordered.find((item) => eventInstant(item.start) > req.now)?.start;
    const upcoming = nextStart ? ordered.filter((item) => item.start === nextStart) : [];
    focusItems = current.length > 0 ? current : upcoming;

    if (current.length > 0) {
      gridTitle = `Live right now (${current[0]!.start})`;
      bannerBody = `Checked live at ${warsawNow} Warsaw time — these sessions are running now across the venue.`;
    } else if (upcoming.length > 0) {
      gridTitle = `Up next at ${upcoming[0]!.start}`;
      bannerBody = `Checked live at ${warsawNow} Warsaw time — next parallel block starts at ${upcoming[0]!.start}.`;
    }
  } else {
    const targetSlot = requestedSlot ?? '12:00';
    focusItems = ordered.filter((item) => item.start === targetSlot);
    if (requestedSlot) {
      gridTitle = `Parallel comparison at ${targetSlot}`;
      bannerBody =
        'Parallel sessions run at 10:15, 11:00, 12:00, 13:00, 15:00, 16:10, 17:05, and 18:00. Choose Auditorium for talks or Classroom for hands-on workshops.';
    } else if (slotState.phase === 'post-event') {
      gridTitle = 'Room format & parallel slot guide (featured 12:00 slot)';
      bannerBody =
        'The Nov 21, 2026 event has wrapped. Previewing the 12:00 parallel block — sessions ran at 10:15, 11:00, 12:00, 13:00, 15:00, 16:10, 17:05, and 18:00.';
    } else {
      gridTitle = 'Room format & parallel slot guide (featured 12:00 slot)';
      bannerBody =
        'Doors open Nov 21 at 09:00 Warsaw time. Parallel sessions run at 10:15, 11:00, 12:00, 13:00, 15:00, 16:10, 17:05, and 18:00.';
    }
  }

  const auditoriumItem = focusItems.find((i) => i.space === 'auditorium');
  const classroomItem = focusItems.find((i) => i.space === 'classroom');

  nodes.push({
    id: 'compare-banner',
    component: 'CalloutBanner',
    parentId: 'surface-root',
    props: {
      tone: 'info',
      kicker: isDuringEvent ? `Live at ${warsawNow} Warsaw time` : 'Parallel Rooms',
      title: gridTitle,
      body: bannerBody,
    },
  });

  const columns: Array<Record<string, unknown>> = [];
  if (auditoriumItem) {
    columns.push({
      id: 'col-auditorium',
      badge: 'Auditorium',
      heading: auditoriumItem.title,
      time: `${auditoriumItem.start}–${auditoriumItem.end ?? ''}`,
      space: 'Auditorium',
      speakers: auditoriumItem.speakers.map((s) => s.name).join(', '),
      summary: 'Keynote-style engineering talk or leadership panel in the main hall.',
      bestFor: 'Architecture lessons, production case studies, and Q&A.',
      href: auditoriumItem.href,
      sessionId: auditoriumItem.id,
    });
  } else {
    columns.push({
      id: 'col-auditorium',
      badge: 'Auditorium',
      heading: 'Main Stage Talks & Panel',
      summary: 'Production AI, Cloud pipelines, Hugging Face scaling, and Engineering Leadership.',
      bestFor: 'Deep architectural takeaways without needing a laptop.',
    });
  }

  if (classroomItem) {
    columns.push({
      id: 'col-classroom',
      badge: 'Classroom',
      heading: classroomItem.title,
      time: `${classroomItem.start}–${classroomItem.end ?? ''}`,
      space: 'Classroom',
      speakers: classroomItem.speakers.map((s) => s.name).join(', '),
      summary: 'Hands-on workshop / lab session. Bring your laptop for coding exercises.',
      bestFor: 'Practical coding with ADK, MCP, Gemma, Browser AI, and SRE.',
      href: classroomItem.href,
      sessionId: classroomItem.id,
    });
  } else {
    columns.push({
      id: 'col-classroom',
      badge: 'Classroom',
      heading: 'Hands-on Workshops (BYOD)',
      summary: 'Interactive labs covering Prompt API, DevTools MCP, SRE for AI, ADK, and Gemma.',
      bestFor: 'Building live with $5 Google Cloud credits.',
    });
  }

  columns.push({
    id: 'col-vibe',
    badge: 'Vibe Zone',
    heading: 'Community, Games & Networking',
    time: '09:00–21:30',
    space: 'Campus Common Area',
    summary: 'Open networking, sponsor booths, coffee breaks, and afterparty from 19:15.',
    bestFor: 'Meeting speakers, grabbing coffee, and recharging between blocks.',
  });

  nodes.push({
    id: 'compare-grid',
    component: 'ComparisonGrid',
    parentId: 'surface-root',
    props: {
      title: gridTitle,
      columns,
    },
  });

  for (const item of focusItems.filter((i) => i.kind !== 'activity')) {
    nodes.push(
      makeSessionCard(
        `compare-card-${item.id}`,
        item,
        req.programme,
        `${formatSpace(item.space)} option at ${item.start}`,
      ),
    );
  }

  return {
    title: 'Auditorium vs Classroom',
    subtitle: isDuringEvent
      ? `Live schedule comparison · ${warsawNow} Warsaw time`
      : 'Parallel track guide',
    nodes,
  };
}

export function generateLocalConciergeMessages(req: LocalConciergeRequest): A2UIMessage[] {
  const surfaceId = 'concierge-main';
  const teamPool = req.teamMembers?.length ? req.teamMembers : DEFAULT_TEAM_MEMBERS;
  const matchedTeam = findMatchingTeamMembers(req.query, teamPool);
  const intent = inferIntent(req.query, req.intent, matchedTeam);

  const savedSessions: Record<string, true> = {};
  for (const id of req.savedSessionIds) {
    if (id) savedSessions[id] = true;
  }
  const conflicts = computeSavedConflicts(req.agendaItems, req.savedSessionIds);

  const dataModel: Record<string, unknown> = {
    savedSessions,
    conflicts,
    credits: {
      claimState: req.creditStatus,
      window: '09:00-19:00 Warsaw time',
      pool: '330 credits',
      validity: '12 hours after claiming',
    },
    query: req.query,
    intent,
  };

  let surfaceTitle: string;
  let surfaceSubtitle: string;
  let surfaceBadge = 'A2UI Local';
  const childNodes: A2UIComponentNode[] = [];

  switch (intent) {
    case 'track-ai': {
      surfaceTitle = 'AI & Agents Track';
      const timeWindow = detectTimeWindow(req.query);
      surfaceSubtitle =
        timeWindow === 'morning'
          ? 'Morning non-overlapping AI & Agents schedule'
          : timeWindow === 'afternoon'
            ? 'Afternoon non-overlapping AI & Agents schedule'
            : 'Full-day non-overlapping AI & Agents schedule';

      const picks = buildNonOverlappingTrack(
        req.agendaItems,
        req.programme,
        ['ai', 'agent', 'adk', 'gemini', 'gemma', 'mcp', 'devtools', 'antigravity', 'llm', 'eval'],
        req.query,
      );

      childNodes.push({
        id: 'track-ai-banner',
        component: 'CalloutBanner',
        parentId: 'surface-root',
        props: {
          tone: 'info',
          kicker: 'Curated Track',
          title: `${picks.length} non-overlapping AI & Agents sessions`,
          body: 'Selected across Auditorium and Classroom with zero time overlaps so you can attend every slot.',
        },
      });

      for (const item of picks) {
        childNodes.push(
          makeSessionCard(
            `track-ai-${item.id}`,
            item,
            req.programme,
            `Fits ${item.start}–${item.end ?? ''} without overlapping other picks`,
          ),
        );
      }
      break;
    }

    case 'track-cloud': {
      surfaceTitle = 'Cloud, SRE & Backend Track';
      surfaceSubtitle = 'Non-overlapping infrastructure & scaling sessions';

      const picks = buildNonOverlappingTrack(
        req.agendaItems,
        req.programme,
        [
          'cloud',
          'gcp',
          'sre',
          'reliability',
          'infrastructure',
          'scaling',
          'eventarc',
          'mongodb',
          'hugging face',
          'serverless',
        ],
        req.query,
      );

      childNodes.push({
        id: 'track-cloud-banner',
        component: 'CalloutBanner',
        parentId: 'surface-root',
        props: {
          tone: 'info',
          kicker: 'Cloud & Backend',
          title: `${picks.length} Cloud, SRE & Infrastructure picks`,
          body: 'Focused on GCP event-driven pipelines, SRE for AI, and scaling production systems.',
        },
      });

      for (const item of picks) {
        childNodes.push(
          makeSessionCard(
            `track-cloud-${item.id}`,
            item,
            req.programme,
            `Cloud & infrastructure highlight (${formatSpace(item.space)})`,
          ),
        );
      }
      break;
    }

    case 'credits-workshops': {
      surfaceTitle = '$5 Google Cloud Credits & Workshops';
      surfaceSubtitle = 'Classroom labs & credit claim rules';
      surfaceBadge = '330 Credits Pool';

      const byId = new Map(req.agendaItems.map((item) => [item.id, item]));
      const workshopItems = CREDIT_WORKSHOP_IDS.map((id) => byId.get(id)).filter(
        (item): item is AgendaItem => Boolean(item),
      );

      childNodes.push({
        id: 'credits-banner',
        component: 'CalloutBanner',
        parentId: 'surface-root',
        props: {
          tone: 'success',
          kicker: 'Google Cloud Credits',
          title: '$5 Google Cloud credits for attendees',
          body: `330 credits available on Nov 21 (09:00–19:00 Warsaw time), valid for 12 hours after claiming. Current status: ${req.creditStatus || 'check on-site'}.`,
        },
      });

      childNodes.push({
        id: 'credit-guide-card',
        component: 'CreditGuideCard',
        parentId: 'surface-root',
        props: {
          title: '$5 Google Cloud Credits & Classroom Labs',
          claimWindow: '09:00–19:00 Warsaw time (Nov 21, 2026)',
          validity: '12 hours after claiming',
          poolSize: '330 credits',
          statusSummary: `Claim state: ${req.creditStatus || 'available'} · Pool: 330 credits`,
          steps: [
            'Bring your own laptop (BYOD) to join hands-on Classroom workshops.',
            'Claim your $5 Google Cloud credit between 09:00 and 19:00 Warsaw time on Nov 21.',
            'Use the credit within 12 hours after claiming during or right after the labs.',
            'Ask workshop mentors in the Classroom if you need help activating your project.',
          ],
          workshops: workshopItems.map((item) => ({
            sessionId: item.id,
            title: item.title,
            time: `${item.start}–${item.end ?? ''}`,
            space: formatSpace(item.space),
            speaker: item.speakers.map((s) => s.name).join(', '),
            href: item.href ?? `/sessions/${item.id}/`,
          })),
        },
      });

      for (const item of workshopItems) {
        childNodes.push(
          makeSessionCard(
            `workshop-${item.id}`,
            item,
            req.programme,
            'Hands-on Classroom workshop (BYOD)',
          ),
        );
      }
      break;
    }

    case 'compare-rooms': {
      const comparison = buildCompareRoomsNodes(req);
      surfaceTitle = comparison.title;
      surfaceSubtitle = comparison.subtitle;
      childNodes.push(...comparison.nodes);
      break;
    }

    case 'logistics-venue': {
      surfaceTitle = 'Venue & Event Logistics';
      surfaceSubtitle = 'Google for Startups Campus Warsaw · Nov 21, 2026';

      childNodes.push({
        id: 'logistics-banner',
        component: 'CalloutBanner',
        parentId: 'surface-root',
        props: {
          tone: 'info',
          kicker: 'Venue & Travel',
          title: 'Google for Startups Campus Warsaw (Plac Konesera 10)',
          body: 'Doors open at 09:00. Take Metro M2 to Dworzec Wileński; free Saturday street parking and 24h Koneser underground car park are available.',
        },
      });

      childNodes.push({
        id: 'logistics-card',
        component: 'LogisticsCard',
        parentId: 'surface-root',
        props: {
          title: 'Practical Information',
          items: [
            {
              label: 'Venue',
              value: 'Google for Startups Campus Warsaw',
              detail: 'Plac Konesera 10, 03-736 Warszawa (Nov 21, 2026)',
            },
            {
              label: 'Metro & Transit',
              value: 'Metro M2 — Dworzec Wileński',
              detail: 'Short walk to Koneser; buses & trams serve Dworzec Wileński & Ząbkowska.',
            },
            {
              label: 'Parking',
              value: 'Free Saturday street parking + 24h Koneser underground car park',
              detail: 'Subject to space and signed local restrictions.',
            },
            {
              label: 'Schedule Milestones',
              value: 'Doors 09:00 · Lunch 14:00–15:00 · Closing 18:55–19:15',
              detail: 'Afterparty & networking from 19:15 until ~21:30.',
            },
            {
              label: 'Coffee & Wi-Fi',
              value: 'Coffee on-site & attendee Wi-Fi',
              detail: 'Unmonitored self-service cloakroom available — keep valuables with you.',
            },
            {
              label: 'Accessibility & Contact',
              value: 'Wheelchair accessible (step-free seating, ramps, lifts)',
              detail: 'Accessibility or general questions: hello@gdgwarsaw.pl',
            },
          ],
          directionsUrl:
            'https://www.google.com/maps/search/?api=1&query=Google+for+Startups+Campus+Warsaw+Plac+Konesera+10',
          visitAnchor: '/#visit',
        },
      });
      break;
    }

    case 'saved-schedule': {
      surfaceTitle = 'My Saved Schedule';
      surfaceSubtitle = 'Personal agenda & overlap checker';

      const savedItems = req.agendaItems
        .filter((item) => Boolean(savedSessions[item.id]))
        .sort((a, b) => a.start.localeCompare(b.start));

      const conflictCount = Object.keys(conflicts).length;

      if (savedItems.length === 0) {
        childNodes.push({
          id: 'saved-empty-banner',
          component: 'CalloutBanner',
          parentId: 'surface-root',
          props: {
            tone: 'info',
            kicker: 'No Saved Sessions Yet',
            title: 'Your personal schedule is empty',
            body: 'Bookmark any session below to build your day and automatically check for time overlaps.',
          },
        });

        const starterPicks = req.agendaItems
          .filter((item) => item.kind !== 'activity' && item.kind !== 'open')
          .slice(0, 3);
        for (const item of starterPicks) {
          childNodes.push(
            makeSessionCard(`starter-${item.id}`, item, req.programme, 'Popular starter pick'),
          );
        }
      } else if (conflictCount > 0) {
        childNodes.push({
          id: 'saved-conflict-banner',
          component: 'CalloutBanner',
          parentId: 'surface-root',
          props: {
            tone: 'warning',
            kicker: 'Schedule Overlap Detected',
            title: `${conflictCount} saved sessions overlap in time`,
            body: 'Review the conflict notes on each card below and pick one room per time slot.',
          },
        });

        for (const item of savedItems) {
          childNodes.push(makeSessionCard(`saved-${item.id}`, item, req.programme));
        }
      } else {
        childNodes.push({
          id: 'saved-ok-banner',
          component: 'CalloutBanner',
          parentId: 'surface-root',
          props: {
            tone: 'success',
            kicker: 'Conflict-Free',
            title: `${savedItems.length} saved session${savedItems.length === 1 ? '' : 's'} ready`,
            body: 'No overlapping time slots detected in your saved schedule.',
          },
        });

        for (const item of savedItems) {
          childNodes.push(makeSessionCard(`saved-${item.id}`, item, req.programme));
        }
      }
      break;
    }

    case 'team-organizer': {
      const displayMembers = matchedTeam.length > 0 ? matchedTeam : teamPool;
      const single = displayMembers.length === 1 ? displayMembers[0] : undefined;
      surfaceTitle = single ? single.name : 'DevFest Warsaw 2026 Organizing Team';
      surfaceSubtitle = 'GDG Warszawa organizers';
      surfaceBadge = 'Organizing Team';

      childNodes.push({
        id: 'team-banner',
        component: 'CalloutBanner',
        parentId: 'surface-root',
        props: {
          tone: 'info',
          title: single
            ? `${single.name} — GDG Warszawa Organizer`
            : `${displayMembers.length} DevFest Warsaw 2026 Organizers`,
          body: single
            ? `${single.name} is part of the DevFest Warsaw 2026 organizing team at Google Developer Groups Warszawa. Reach the organizers via hello@gdgwarsaw.pl.`
            : 'GDG Warszawa community volunteers running DevFest Warsaw 2026. Reach the team at hello@gdgwarsaw.pl.',
        },
      });

      childNodes.push({
        id: 'team-card',
        component: 'LogisticsCard',
        parentId: 'surface-root',
        props: {
          title: single ? 'Organizer Profiles' : 'Organizing Team Directory',
          items: displayMembers.map((member) => ({
            label: member.name,
            value: 'GDG Warszawa · DevFest 2026 Organizer',
            detail: [
              member.profileUrl,
              ...(member.socials ?? []).map((s) => `${s.name}: ${s.link}`),
            ]
              .filter(Boolean)
              .join(' · '),
          })),
          directionsUrl: '',
          visitAnchor: '/team/',
        },
      });
      break;
    }

    case 'overview':
    default: {
      surfaceTitle = 'DevFest Warsaw 2026 Concierge';
      surfaceSubtitle = 'Nov 21, 2026 · Google for Startups Campus Warsaw';

      childNodes.push({
        id: 'overview-banner',
        component: 'CalloutBanner',
        parentId: 'surface-root',
        props: {
          tone: 'info',
          kicker: 'Real Work, Real Lessons',
          title: 'Plan your DevFest Warsaw 2026 day',
          body: 'Build a conflict-free AI or Cloud track, compare Auditorium vs Classroom, check $5 Google Cloud credits, or get venue directions.',
        },
      });

      childNodes.push({
        id: 'overview-grid',
        component: 'ComparisonGrid',
        parentId: 'surface-root',
        props: {
          title: 'Event at a glance',
          columns: [
            {
              id: 'overview-auditorium',
              badge: 'Auditorium',
              heading: 'Production Talks & Panel',
              summary: 'Agents in production, Eventarc AI, AlphaEvolve, Hugging Face scaling.',
              bestFor: 'Real-world architecture & leadership lessons.',
            },
            {
              id: 'overview-classroom',
              badge: 'Classroom',
              heading: '6 Hands-on Workshops',
              summary: 'Browser AI, DevTools MCP, SRE for AI, ADK, Evals, and Gemma.',
              bestFor: 'BYOD coding + $5 Google Cloud credits (330 pool).',
            },
            {
              id: 'overview-logistics',
              badge: 'Campus',
              heading: 'Plac Konesera 10',
              time: '09:00–21:30',
              summary: 'Metro M2 Dworzec Wileński · Lunch 14:00–15:00 · Afterparty 19:15.',
              bestFor: 'Smooth arrival and full-day logistics.',
            },
          ],
        },
      });

      const featured = req.agendaItems
        .filter((item) => item.kind !== 'activity' && item.kind !== 'open')
        .slice(0, 2);
      for (const item of featured) {
        childNodes.push(
          makeSessionCard(`featured-${item.id}`, item, req.programme, 'Featured opening block'),
        );
      }
      break;
    }
  }

  childNodes.push(makeDefaultChips(intent));

  const rootNode: A2UIComponentNode = {
    id: 'surface-root',
    component: 'SurfaceContainer',
    parentId: null,
    children: childNodes.map((node) => node.id),
    props: {
      title: surfaceTitle,
      subtitle: surfaceSubtitle,
      badge: surfaceBadge,
    },
  };

  return [
    {
      type: 'createSurface',
      surfaceId,
      title: surfaceTitle,
      source: 'local-engine',
      timestamp: req.now,
    },
    {
      type: 'updateDataModel',
      surfaceId,
      data: dataModel,
    },
    {
      type: 'updateComponents',
      surfaceId,
      rootId: 'surface-root',
      components: [rootNode, ...childNodes],
    },
  ];
}
