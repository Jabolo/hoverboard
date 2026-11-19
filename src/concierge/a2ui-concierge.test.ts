import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildAgenda,
  eventInstant,
  type AgendaItem,
  type DraftAgenda,
} from '../utils/agenda-preview-data';
import type { PreviewSource } from '../utils/speakers-preview-data';
import {
  ALLOWED_A2UI_COMPONENTS,
  A2UIMessageProcessor,
  type A2UIComponentNode,
  type A2UIMessage,
} from './a2ui-protocol';
import { computeSavedConflicts, generateLocalConciergeMessages } from './local-concierge-engine';

const agendaDraft = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'public/data/agenda-2026.json'), 'utf8'),
) as DraftAgenda;

const programme = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'public/data/programme-2026.json'), 'utf8'),
) as PreviewSource;

const agendaItems: AgendaItem[] = buildAgenda(agendaDraft, programme);

function collectNodesByComponent(
  processor: A2UIMessageProcessor,
  component: A2UIComponentNode['component'],
): A2UIComponentNode[] {
  const surface = processor.getActiveSurface();
  if (!surface) return [];
  return Array.from(surface.componentsById.values()).filter((node) => node.component === component);
}

describe('A2UIMessageProcessor', () => {
  it('processes surface creation, deep-merged data model, components, and deletion', () => {
    const processor = new A2UIMessageProcessor();

    processor.processBatch([
      {
        type: 'createSurface',
        surfaceId: 's1',
        title: 'Test Surface',
        source: 'local-engine',
        timestamp: 1000,
      },
      {
        type: 'updateDataModel',
        surfaceId: 's1',
        data: {
          credits: { claimState: 'available', pool: '330 credits' },
          savedSessions: { 'CFP-021': true },
        },
      },
      {
        type: 'updateDataModel',
        surfaceId: 's1',
        data: {
          credits: { claimState: 'claimed' },
        },
      },
      {
        type: 'updateComponents',
        surfaceId: 's1',
        rootId: 'root',
        components: [
          {
            id: 'root',
            component: 'SurfaceContainer',
            parentId: null,
            children: ['banner-1'],
            props: { title: 'Root' },
          },
          {
            id: 'banner-1',
            component: 'CalloutBanner',
            parentId: 'root',
            props: { tone: 'info', title: 'Hello', body: 'World' },
          },
        ],
      },
    ]);

    const surface = processor.getActiveSurface();
    expect(surface?.surfaceId).toBe('s1');
    expect(surface?.rootId).toBe('root');
    expect(surface?.componentsById.size).toBe(2);
    expect(processor.resolveBinding('credits.claimState', 'unknown')).toBe('claimed');
    expect(processor.resolveBinding('credits.pool', 'unknown', 's1')).toBe('330 credits');
    expect(processor.resolveBinding('s1', 'savedSessions.CFP-021', false)).toBe(true);
    expect(processor.resolveBinding('s1', 'missing.path', 'fallback')).toBe('fallback');

    processor.process({ type: 'deleteSurface', surfaceId: 's1' });
    expect(processor.getSurface('s1')).toBeUndefined();
    expect(processor.getActiveSurface()).toBeUndefined();
  });

  it('drops non-allowlisted component types safely and blocks prototype pollution', () => {
    const processor = new A2UIMessageProcessor();
    const maliciousComponent = {
      id: 'evil-1',
      component: 'ScriptTag',
      parentId: 'root',
      props: { html: '<script>alert(1)</script>' },
    } as unknown as A2UIComponentNode;

    const messages: A2UIMessage[] = [
      {
        type: 'createSurface',
        surfaceId: 'safe-surface',
        title: 'Safe',
        source: 'gemini-4-hydrogen',
        timestamp: 2000,
      },
      {
        type: 'updateDataModel',
        surfaceId: 'safe-surface',
        data: JSON.parse('{"__proto__":{"polluted":true},"ok":"yes"}') as Record<string, unknown>,
      },
      {
        type: 'updateComponents',
        surfaceId: 'safe-surface',
        rootId: 'root',
        components: [
          {
            id: 'root',
            component: 'SurfaceContainer',
            parentId: null,
            children: ['evil-1'],
            props: { title: 'Root' },
          },
          maliciousComponent,
        ],
      },
    ];

    processor.processBatch(messages);
    const surface = processor.getActiveSurface();
    expect(ALLOWED_A2UI_COMPONENTS.has('SurfaceContainer')).toBe(true);
    expect(surface?.componentsById.has('root')).toBe(true);
    expect(surface?.componentsById.has('evil-1')).toBe(false);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(processor.resolveBinding('ok', 'no')).toBe('yes');
  });
});

describe('computeSavedConflicts', () => {
  it('returns empty object when fewer than two sessions or no overlaps exist', () => {
    expect(computeSavedConflicts(agendaItems, [])).toEqual({});
    expect(computeSavedConflicts(agendaItems, ['CFP-021'])).toEqual({});
    // 10:15-10:45 and 11:00-11:45 do not overlap
    expect(computeSavedConflicts(agendaItems, ['CFP-021', 'CFP-002'])).toEqual({});
    // 12:00-13:00 (CFP-050) and 13:00-13:45 (CFP-034) share boundary 13:00 -> half-open, no overlap
    expect(computeSavedConflicts(agendaItems, ['CFP-050', 'CFP-034'])).toEqual({});
  });

  it('detects overlapping saved sessions across Auditorium and Classroom', () => {
    const conflicts = computeSavedConflicts(agendaItems, ['CFP-021', 'INVITED-004']);
    expect(conflicts['CFP-021']).toContain('AI at Zero Token Cost');
    expect(conflicts['CFP-021']).toContain('Classroom');
    expect(conflicts['INVITED-004']).toContain('Written by Agents');
    expect(conflicts['INVITED-004']).toContain('Auditorium');
  });
});

describe('generateLocalConciergeMessages', () => {
  const baseNow = eventInstant('08:30');

  it('generates overview surface with welcome banner, comparison grid, and action chips', () => {
    const processor = new A2UIMessageProcessor();
    const messages = generateLocalConciergeMessages({
      query: '',
      intent: 'overview',
      agendaItems,
      programme,
      savedSessionIds: [],
      creditStatus: 'available',
      now: baseNow,
    });

    processor.processBatch(messages);
    const surface = processor.getActiveSurface();
    expect(surface?.source).toBe('local-engine');
    expect(collectNodesByComponent(processor, 'CalloutBanner')).toHaveLength(1);
    expect(collectNodesByComponent(processor, 'ComparisonGrid')).toHaveLength(1);
    expect(collectNodesByComponent(processor, 'ActionChipRow')).toHaveLength(1);
    expect(processor.resolveBinding('credits.pool', '')).toBe('330 credits');
  });

  it('builds a non-overlapping AI & Agents track and respects morning/afternoon filters', () => {
    const processor = new A2UIMessageProcessor();
    const morningMessages = generateLocalConciergeMessages({
      query: 'Build my AI agents track in the morning before lunch',
      agendaItems,
      programme,
      savedSessionIds: ['CFP-021'],
      creditStatus: 'available',
      now: baseNow,
    });

    processor.processBatch(morningMessages);
    const cards = collectNodesByComponent(processor, 'SessionCard');
    expect(cards.length).toBeGreaterThanOrEqual(3);
    for (const card of cards) {
      expect(String(card.props['start']) < '14:00').toBe(true);
      expect(card.props['bindSavedPath']).toBe(`savedSessions.${String(card.props['sessionId'])}`);
    }

    // Verify no overlaps among selected cards
    for (let i = 1; i < cards.length; i++) {
      const prevEnd = eventInstant(String(cards[i - 1]!.props['end']));
      const currStart = eventInstant(String(cards[i]!.props['start']));
      expect(currStart).toBeGreaterThanOrEqual(prevEnd);
    }
  });

  it('builds a non-overlapping Cloud, SRE & Backend track', () => {
    const processor = new A2UIMessageProcessor();
    const messages = generateLocalConciergeMessages({
      query: 'Show me GCP Cloud, SRE, and Hugging Face scaling talks',
      agendaItems,
      programme,
      savedSessionIds: [],
      creditStatus: 'available',
      now: baseNow,
    });

    processor.processBatch(messages);
    const cards = collectNodesByComponent(processor, 'SessionCard');
    const ids = cards.map((c) => c.props['sessionId']);
    expect(ids).toContain('CFP-002');
    expect(ids).toContain('INVITED-005');
    expect(ids).toContain('scaling-hugging-face-hub');
  });

  it('renders grounded CreditGuideCard and Classroom workshops for credits-workshops intent', () => {
    const processor = new A2UIMessageProcessor();
    const messages = generateLocalConciergeMessages({
      query: 'How do $5 Google Cloud credits and workshops work?',
      agendaItems,
      programme,
      savedSessionIds: [],
      creditStatus: 'claimed',
      now: baseNow,
    });

    processor.processBatch(messages);
    const creditCards = collectNodesByComponent(processor, 'CreditGuideCard');
    expect(creditCards).toHaveLength(1);
    const guide = creditCards[0]!;
    expect(guide.props['poolSize']).toBe('330 credits');
    expect(guide.props['validity']).toBe('12 hours after claiming');
    expect(String(guide.props['claimWindow'])).toContain('09:00–19:00');
    const workshops = guide.props['workshops'] as Array<{ sessionId: string }>;
    expect(workshops.map((w) => w.sessionId)).toEqual([
      'INVITED-004',
      'CFP-050',
      'INVITED-005',
      'CFP-015',
      'INVITED-003',
      'INVITED-001',
    ]);
  });

  it('compares live rooms during event day and parallel slots outside event day', () => {
    const liveProcessor = new A2UIMessageProcessor();
    const liveMessages = generateLocalConciergeMessages({
      query: 'Compare Auditorium vs Classroom right now',
      agendaItems,
      programme,
      savedSessionIds: [],
      creditStatus: 'available',
      now: eventInstant('12:15'),
    });

    liveProcessor.processBatch(liveMessages);
    const liveGrids = collectNodesByComponent(liveProcessor, 'ComparisonGrid');
    expect(liveGrids).toHaveLength(1);
    expect(String(liveGrids[0]!.props['title'])).toContain('12:00');

    const offDayProcessor = new A2UIMessageProcessor();
    const offDayMessages = generateLocalConciergeMessages({
      query: 'Compare Auditorium vs Classroom at 16:10',
      agendaItems,
      programme,
      savedSessionIds: [],
      creditStatus: 'available',
      now: Date.parse('2026-11-19T12:00:00+01:00'),
    });

    offDayProcessor.processBatch(offDayMessages);
    const offDayGrids = collectNodesByComponent(offDayProcessor, 'ComparisonGrid');
    expect(String(offDayGrids[0]!.props['title'])).toContain('16:10');
  });

  it('renders grounded venue & logistics info from faq.md', () => {
    const processor = new A2UIMessageProcessor();
    const messages = generateLocalConciergeMessages({
      query: 'How do I get to the venue by metro and where is parking?',
      agendaItems,
      programme,
      savedSessionIds: [],
      creditStatus: 'available',
      now: baseNow,
    });

    processor.processBatch(messages);
    const logisticsCards = collectNodesByComponent(processor, 'LogisticsCard');
    expect(logisticsCards).toHaveLength(1);
    const card = logisticsCards[0]!;
    expect(card.props['visitAnchor']).toBe('/#visit');
    const serialized = JSON.stringify(card.props);
    expect(serialized).toContain('Google for Startups Campus Warsaw');
    expect(serialized).toContain('Plac Konesera 10');
    expect(serialized).toContain('Dworzec Wileński');
    expect(serialized).toContain('hello@gdgwarsaw.pl');
  });

  it('checks saved schedule for conflicts and binds conflict warnings into dataModel', () => {
    const processor = new A2UIMessageProcessor();
    const messages = generateLocalConciergeMessages({
      query: 'Check my saved schedule',
      agendaItems,
      programme,
      savedSessionIds: ['CFP-021', 'INVITED-004'],
      creditStatus: 'available',
      now: baseNow,
    });

    processor.processBatch(messages);
    const banners = collectNodesByComponent(processor, 'CalloutBanner');
    expect(banners[0]?.props['tone']).toBe('warning');
    expect(processor.resolveBinding('savedSessions.CFP-021', false)).toBe(true);
    expect(processor.resolveBinding('conflicts.CFP-021', '')).toContain('AI at Zero Token Cost');
  });

  it('matches organizers accent-insensitively and limits follow-up chips to 2', () => {
    const processor = new A2UIMessageProcessor();
    const messages = generateLocalConciergeMessages({
      query: 'who is michal jablonski?',
      agendaItems,
      programme,
      savedSessionIds: [],
      creditStatus: 'available',
      now: baseNow,
    });

    processor.processBatch(messages);
    const banners = collectNodesByComponent(processor, 'CalloutBanner');
    expect(banners[0]?.props['title']).toContain('Michał Jabłoński');
    const chips = collectNodesByComponent(processor, 'ActionChipRow');
    expect((chips[0]?.props['chips'] as unknown[]).length).toBeLessThanOrEqual(2);
  });
});
