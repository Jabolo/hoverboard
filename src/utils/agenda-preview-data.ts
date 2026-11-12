import type { PreviewSource } from './speakers-preview-data';

export type AgendaSpace = 'auditorium' | 'classroom' | 'both';
export type AgendaFilter = 'all' | 'auditorium' | 'classroom' | 'vibe';
export type AgendaKind = 'session' | 'workshop' | 'panel' | 'activity' | 'open';

export interface DraftAgendaItem {
  id: string;
  start: string;
  end?: string;
  space: AgendaSpace;
  kind: AgendaKind;
  title?: string;
  detailsPending?: boolean;
}
export interface DraftAgenda {
  date: string;
  timezone: string;
  items: DraftAgendaItem[];
}
export interface AgendaItem extends DraftAgendaItem {
  title: string;
  speakers: AgendaSpeaker[];
  href: string | null;
}
export interface AgendaSpeaker {
  id: string;
  name: string;
  title: string;
  company: string;
  photoUrl: string;
}
export interface AgendaGroup {
  start: string;
  items: AgendaItem[];
}

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export const EVENT_DATE = '2026-11-21';
export const EVENT_TIMEZONE = 'Europe/Warsaw';

/** The event falls in Warsaw standard time. These instants do not depend on the visitor's timezone. */
export function eventInstant(time: string): number {
  if (!timePattern.test(time)) throw new Error(`Invalid agenda time: ${time}`);
  return Date.parse(`${EVENT_DATE}T${time}:00+01:00`);
}

export function buildAgenda(draft: DraftAgenda, programme: PreviewSource): AgendaItem[] {
  if (
    draft.date !== EVENT_DATE ||
    draft.timezone !== EVENT_TIMEZONE ||
    !Array.isArray(draft.items)
  ) {
    throw new Error('Invalid event date or timezone');
  }
  const ids = new Set<string>();
  return draft.items
    .map((item) => {
      if (!item.id || ids.has(item.id)) throw new Error('Missing or duplicate agenda ID');
      ids.add(item.id);
      if (!['auditorium', 'classroom', 'both'].includes(item.space))
        throw new Error('Invalid space');
      if (!['session', 'workshop', 'panel', 'activity', 'open'].includes(item.kind)) {
        throw new Error('Invalid agenda item type');
      }
      const start = eventInstant(item.start);
      if (!item.end && item.kind !== 'activity') throw new Error('Missing end time');
      if (item.end && eventInstant(item.end) <= start) throw new Error('Invalid time range');
      if (item.detailsPending && item.kind !== 'workshop')
        throw new Error('Only workshops can have pending details');
      if (item.kind === 'activity' || item.kind === 'open' || item.detailsPending) {
        if (!item.title?.trim()) throw new Error('Missing activity title');
        return { ...item, title: item.title, speakers: [], href: null };
      }
      const session = programme.sessions[item.id];
      if (!session?.title || !session.speakers?.length)
        throw new Error(`Missing session: ${item.id}`);
      const speakers: AgendaSpeaker[] = session.speakers.map((id) => {
        const speaker = programme.speakers[id];
        if (!speaker?.name) throw new Error(`Missing speaker: ${id}`);
        return {
          id,
          name: speaker.name,
          title: speaker.title || '',
          company: speaker.company || '',
          photoUrl: speaker.photoUrl || '',
        };
      });
      return { ...item, title: session.title, speakers, href: `/sessions/${item.id}/` };
    })
    .sort((a, b) => a.start.localeCompare(b.start) || a.space.localeCompare(b.space));
}

export function groupAgenda(items: AgendaItem[], filter: AgendaFilter): AgendaGroup[] {
  if (filter === 'vibe') return [];
  const result: AgendaGroup[] = [];
  for (const item of items) {
    if (item.kind === 'open') continue;
    if (filter !== 'all' && item.space !== 'both' && item.space !== filter) continue;
    let group = result[result.length - 1];
    if (!group || group.start !== item.start) {
      group = { start: item.start, items: [] };
      result.push(group);
    }
    group.items.push(item);
  }
  return result;
}

export function progressAt(
  item: Pick<DraftAgendaItem, 'start' | 'end'>,
  now: number,
): number | null {
  if (!item.end) return null;
  const start = eventInstant(item.start);
  const end = eventInstant(item.end);
  return now >= start && now < end ? ((now - start) / (end - start)) * 100 : null;
}

export function eventState(now: number): 'before' | 'during' | 'after' {
  if (now < eventInstant('09:00')) return 'before';
  return now < eventInstant('21:30') ? 'during' : 'after';
}

export function warsawTime(now: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: EVENT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(now));
}
