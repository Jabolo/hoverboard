import { describe, expect, it } from '@jest/globals';
import {
  buildSessionDiscovery,
  discoveryUrl,
  filterSessionDiscovery,
  normaliseSessionSearch,
  sessionExcerpt,
  sessionTopics,
  surpriseSession,
} from './session-discovery';
import type { DiscoverableSession } from './session-discovery';

const sessions: DiscoverableSession[] = [
  {
    id: 'CFP-043',
    title: 'Practical agents',
    description: 'Build an offline agent with Gemini and practical tooling.',
    tags: ['AI', 'Build with AI'],
    speakers: [{ id: 'michal-tajchert', name: 'Michał Tajchert', company: 'Fairtale' }],
  },
  {
    id: 'CFP-012',
    title: 'Flutter foundations',
    description: 'A deep dive into rendering.',
    tags: ['Dart - Flutter'],
    speakers: ['andrii-khrystian'],
  },
  {
    id: 'PANEL-01',
    title: 'Engineering culture',
    description: 'A shared discussion.',
    tags: ['Engineering Culture', 'AI'],
    speakers: [
      { id: 'dmytro', name: 'Dmytro', company: 'Google' },
      { id: 'sergiy', name: 'Sergiy', company: 'Netflix' },
    ],
  },
];
const items = buildSessionDiscovery(sessions, [
  { id: 'andrii-khrystian', name: 'Andrii Khrystian', company: 'LeanCode' },
]);

describe('session discovery', () => {
  it('searches full abstracts, names, companies and titles with diacritics normalised', () => {
    expect(normaliseSessionSearch('Łódź Çalgan')).toBe('lodz calgan');
    expect(filterSessionDiscovery(items, 'michal')).toHaveLength(1);
    expect(filterSessionDiscovery(items, 'LeanCode')[0]?.id).toBe('CFP-012');
    expect(filterSessionDiscovery(items, 'netflix')[0]?.id).toBe('PANEL-01');
    expect(filterSessionDiscovery(items, 'offline gemini')[0]?.id).toBe('CFP-043');
    expect(filterSessionDiscovery(items, 'offline google')).toEqual([]);
  });
  it('combines topic and query filters without duplicating the shared panel', () => {
    expect(filterSessionDiscovery(items, '', 'AI').map((item) => item.id)).toEqual([
      'CFP-043',
      'PANEL-01',
    ]);
    expect(filterSessionDiscovery(items, 'Google', 'Flutter')).toEqual([]);
    expect(items[2]?.people).toHaveLength(2);
    expect(items[1]?.people[0]?.href).toBe('/speakers/andrii-khrystian');
    expect(items[2]?.href).toBe('/sessions/PANEL-01');
  });
  it('groups only supplied tags and never manufactures programme metadata', () => {
    expect(
      sessionTopics([
        'AI - Gemini',
        'AI',
        'Cloud - Serverless & Containers',
        'Web - AI for Web Developers',
        'Dart - Flutter',
        'Offline-first',
      ]),
    ).toEqual(['AI', 'Google Cloud', 'Web', 'Flutter', 'Offline-first']);
    expect(sessionTopics()).toEqual([]);
    expect(Object.keys(items[0]!)).not.toContain('startTime');
  });
  it('provides readable bounded excerpts, keeping the full abstract searchable', () => {
    const description = '**A practical idea**\n\nwith enough detail to keep reading. Lastword';
    expect(sessionExcerpt(description, 38)).toBe('A practical idea with enough detail…');
    expect(sessionExcerpt('A short abstract.')).toBe('A short abstract.');
    const [long] = buildSessionDiscovery([
      { id: 'long', title: 'Long', description: 'word '.repeat(100) + 'needle' },
    ]);
    expect(long?.excerpt.length).toBeLessThanOrEqual(241);
    expect(filterSessionDiscovery([long!], 'needle')).toHaveLength(1);
  });
  it('keeps discovery URLs shareable and preserves unrelated query parameters', () => {
    expect(discoveryUrl('?utm_source=community&q=old', '  agent  ', 'AI')).toBe(
      '/sessions/?utm_source=community&q=agent&topic=AI',
    );
    expect(discoveryUrl('?q=old&topic=AI', '', '')).toBe('/sessions/');
  });
  it('picks only from the current filtered set and handles no matches', () => {
    const filtered = filterSessionDiscovery(items, '', 'Flutter');
    expect(surpriseSession(filtered, 0.6)?.id).toBe('CFP-012');
    expect(surpriseSession(items, 0)?.id).toBe('CFP-043');
    expect(surpriseSession(items, 0.999)?.id).toBe('PANEL-01');
    expect(surpriseSession([])).toBeUndefined();
  });
});
