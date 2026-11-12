import { describe, expect, it } from '@jest/globals';
import draft from '../../public/data/agenda-2026.json';
import programme from '../../public/data/programme-2026.json';
import {
  buildAgenda,
  eventInstant,
  eventState,
  groupAgenda,
  progressAt,
  warsawTime,
} from './agenda-preview-data';
import type { DraftAgenda } from './agenda-preview-data';
import { isAgendaPreviewEnabled } from './agenda-preview-mode';
import type { PreviewSource } from './speakers-preview-data';

const items = () => buildAgenda(draft as DraftAgenda, programme as PreviewSource);

describe('published agenda', () => {
  it('matches the scheduled sessions and common event blocks', () => {
    const all = items();
    expect(all.filter((item) => item.href)).toHaveLength(14);
    expect(
      all.filter((item) => item.href).map(({ id, start, end, space }) => [id, start, end, space]),
    ).toEqual([
      ['CFP-021', '10:15', '10:45', 'auditorium'],
      ['CFP-043', '10:15', '10:45', 'classroom'],
      ['CFP-002', '11:00', '11:45', 'auditorium'],
      ['CFP-012', '11:00', '11:45', 'classroom'],
      ['CFP-014', '12:00', '12:45', 'auditorium'],
      ['CFP-050', '12:00', '13:00', 'classroom'],
      ['CFP-034', '13:00', '13:45', 'auditorium'],
      ['PANEL-01', '15:00', '16:00', 'auditorium'],
      ['CFP-028', '16:10', '16:40', 'auditorium'],
      ['CFP-015', '16:10', '16:55', 'classroom'],
      ['scaling-hugging-face-hub', '17:05', '17:35', 'auditorium'],
      ['INVITED-003', '17:05', '17:50', 'classroom'],
      ['INVITED-002', '18:00', '18:45', 'auditorium'],
      ['INVITED-001', '18:00', '18:45', 'classroom'],
    ]);
    expect(all.some((item) => item.kind === 'open')).toBe(false);
    expect(all.find(({ id }) => id === 'CFP-050')).toMatchObject({
      start: '12:00',
      end: '13:00',
      space: 'classroom',
    });
    expect(all.find(({ id }) => id === 'CFP-015')).toMatchObject({
      start: '16:10',
      end: '16:55',
      speakers: [
        expect.objectContaining({
          id: 'ivan-lapa',
          name: 'Ivan Lapa',
          title: 'Senior UI Engineer',
          company: 'Netflix',
          photoUrl: expect.stringContaining('/images/speakers/2026/'),
        }),
      ],
    });
    expect(all.find(({ id }) => id === 'INVITED-001')).toMatchObject({
      start: '18:00',
      end: '18:45',
      kind: 'workshop',
    });
    expect(all.find(({ id }) => id === 'scaling-hugging-face-hub')?.href).toBe(
      '/sessions/scaling-hugging-face-hub/',
    );
    expect(all.find(({ id }) => id === 'lunch')).toMatchObject({ start: '14:00', end: '15:00' });
    expect(all.find(({ id }) => id === 'registration')).toMatchObject({ start: '09:00' });
    expect(all.find(({ id }) => id === 'registration')?.end).toBeUndefined();
    expect(all.find(({ id }) => id === 'closing')).toMatchObject({ start: '18:55', end: '19:15' });
    expect(all.find(({ id }) => id === 'networking')).toMatchObject({
      start: '19:15',
      end: '21:30',
    });
  });

  it('aligns the evening blocks and keeps ten minutes between classroom workshops', () => {
    const all = items();
    for (const start of ['16:10', '17:05', '18:00']) {
      expect(groupAgenda(all, 'all').find((group) => group.start === start)?.items).toHaveLength(2);
    }
    const workshops = ['CFP-015', 'INVITED-003', 'INVITED-001'].map((id) =>
      all.find((item) => item.id === id)!,
    );
    for (let i = 1; i < workshops.length; i++) {
      expect(eventInstant(workshops[i]!.start) - eventInstant(workshops[i - 1]!.end!)).toBe(
        10 * 60 * 1000,
      );
    }
    expect(eventInstant('18:55') - eventInstant('18:45')).toBe(10 * 60 * 1000);
  });

  it('keeps parallel sessions together and filters spaces without inventing Vibe Zone times', () => {
    const all = items();
    for (const filter of ['all', 'auditorium', 'classroom'] as const) {
      const groups = groupAgenda(all, filter);
      expect(groups.some(({ start }) => start === '13:15')).toBe(false);
      expect(
        groups.flatMap(({ items: entries }) => entries).some(({ kind }) => kind === 'open'),
      ).toBe(false);
    }
    expect(groupAgenda(all, 'all').find(({ start }) => start === '12:00')?.items).toHaveLength(2);
    expect(
      groupAgenda(all, 'auditorium')
        .flatMap(({ items: entries }) => entries)
        .every(({ space }) => space !== 'classroom'),
    ).toBe(true);
    expect(
      groupAgenda(all, 'classroom')
        .flatMap(({ items: entries }) => entries)
        .every(({ space }) => space !== 'auditorium'),
    ).toBe(true);
    expect(groupAgenda(all, 'vibe')).toEqual([]);
  });

  it('computes live status from Warsaw instants, including boundaries and simultaneous sessions', () => {
    const all = items();
    expect(eventState(Date.parse('2026-11-21T07:59:59Z'))).toBe('before');
    expect(eventState(Date.parse('2026-11-21T08:00:00Z'))).toBe('during');
    expect(progressAt({ start: '09:00' }, eventInstant('09:15'))).toBeNull();
    expect(eventState(Date.parse('2026-11-21T20:00:00Z'))).toBe('during');
    expect(eventState(Date.parse('2026-11-21T20:30:00Z'))).toBe('after');
    const noon = Date.parse('2026-11-21T11:15:00Z');
    expect(warsawTime(noon)).toBe('12:15');
    expect(all.filter((item) => progressAt(item, noon) !== null).map(({ id }) => id)).toEqual([
      'CFP-014',
      'CFP-050',
    ]);
    expect(progressAt({ start: '12:00', end: '13:00' }, noon)).toBe(25);
    expect(progressAt({ start: '12:00', end: '13:00' }, eventInstant('13:00'))).toBeNull();
    expect(all.filter((item) => progressAt(item, eventInstant('13:50')) !== null)).toEqual([]);
  });

  it('fails closed for unknown sessions and only enables the feature on an opted-in loopback build', () => {
    expect(() =>
      buildAgenda(
        {
          ...draft,
          items: [
            { id: 'missing', start: '12:00', end: '12:30', space: 'auditorium', kind: 'session' },
          ],
        } as DraftAgenda,
        programme as PreviewSource,
      ),
    ).toThrow('Missing session');
    expect(isAgendaPreviewEnabled('localhost', '1')).toBe(true);
    expect(isAgendaPreviewEnabled('127.0.0.1', '1')).toBe(true);
    expect(isAgendaPreviewEnabled('warsaw.devfest.pl', '1')).toBe(false);
    expect(isAgendaPreviewEnabled('localhost', '0')).toBe(false);
  });
});
