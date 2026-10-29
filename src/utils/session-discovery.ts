import type { Session } from '../models/session';
import type { Speaker } from '../models/speaker';

type Person = Pick<Speaker, 'id' | 'name' | 'company'> & Partial<Pick<Speaker, 'photoUrl'>>;
export type DiscoverableSession = Omit<Session, 'speakers'> & {
  speakers?: (Person | string)[];
};
export interface SessionDiscoveryItem {
  id: string;
  title: string;
  href: string;
  excerpt: string;
  people: (Person & { href: string })[];
  topics: string[];
  searchText: string;
}

export const normaliseSessionSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[łŁ]/g, 'l')
    .replace(/[øØ]/g, 'o')
    .toLocaleLowerCase()
    .trim();

/** Group the supplied taxonomy into readable browsing topics; never infer a track or room. */
export function sessionTopics(tags: string[] = []): string[] {
  return [
    ...new Set(
      tags
        .map((tag) => {
          if (tag.startsWith('AI - ') || tag === 'Gemini' || tag === 'Gemma') return 'AI';
          if (tag.startsWith('Cloud - ')) return 'Google Cloud';
          if (tag.startsWith('Web - ')) return 'Web';
          if (tag === 'Dart - Flutter') return 'Flutter';
          return tag.trim();
        })
        .filter(Boolean),
    ),
  ];
}

export function sessionExcerpt(description: string, limit = 240): string {
  const plain = description
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#*_`>[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= limit) return plain;
  const shortened = plain.slice(0, limit);
  const lastSpace = shortened.lastIndexOf(' ');
  return `${shortened.slice(0, lastSpace > limit / 2 ? lastSpace : limit).trimEnd()}…`;
}

export function buildSessionDiscovery(
  sessions: readonly DiscoverableSession[],
  speakers: readonly Person[] = [],
): SessionDiscoveryItem[] {
  const people = new Map(speakers.map((speaker) => [speaker.id, speaker]));
  return sessions.map((session) => {
    const linkedPeople = (session.speakers || []).flatMap((speaker) => {
      const person =
        typeof speaker === 'string'
          ? people.get(speaker)
          : { ...people.get(speaker.id), ...speaker };
      return person?.id && person.name
        ? [{ ...person, href: `/speakers/${encodeURIComponent(person.id)}` }]
        : [];
    });
    return {
      id: session.id,
      title: session.title,
      href: `/sessions/${encodeURIComponent(session.id)}`,
      excerpt: sessionExcerpt(session.description || ''),
      people: linkedPeople,
      topics: sessionTopics(session.tags),
      searchText: normaliseSessionSearch(
        [
          session.title,
          session.description,
          ...(session.tags || []),
          ...linkedPeople.flatMap((person) => [person.name, person.company]),
        ].join(' '),
      ),
    };
  });
}

export function filterSessionDiscovery(
  sessions: readonly SessionDiscoveryItem[],
  query = '',
  topic = '',
): SessionDiscoveryItem[] {
  const terms = normaliseSessionSearch(query).split(/\s+/).filter(Boolean);
  return sessions.filter(
    (session) =>
      (!topic || session.topics.includes(topic)) &&
      terms.every((term) => session.searchText.includes(term)),
  );
}

export function discoveryUrl(search: string, query: string, topic: string): string {
  const params = new URLSearchParams(search);
  if (query.trim()) params.set('q', query.trim());
  else params.delete('q');
  if (topic) params.set('topic', topic);
  else params.delete('topic');
  return `/sessions/${params.size ? `?${params.toString()}` : ''}`;
}

export function surpriseSession(
  sessions: readonly SessionDiscoveryItem[],
  random = Math.random(),
): SessionDiscoveryItem | undefined {
  return sessions[Math.min(sessions.length - 1, Math.max(0, Math.floor(random * sessions.length)))];
}
