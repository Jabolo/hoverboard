import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ScheduleBlock, homeAgendaAt } from './schedule-block';
import { buildAgenda, eventInstant, type DraftAgenda } from '../utils/agenda-preview-data';
import type { PreviewSource } from '../utils/speakers-preview-data';
import agenda from '../../public/data/agenda-2026.json';
import programme from '../../public/data/programme-2026.json';

const items = buildAgenda(agenda as DraftAgenda, programme as PreviewSource);
const ids = (list: typeof items) => list.map((item) => item.id);

describe('on-site homepage programme', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    document.body.replaceChildren();
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('shows the first three published starting times before the event', () => {
    const result = homeAgendaAt(items, eventInstant('09:00') - 1);
    expect(result.state).toBe('before');
    expect(ids(result.upcoming)).toEqual(['registration', 'opening', 'CFP-021', 'INVITED-004']);
    expect(result.current).toEqual([]);
  });

  it('shows parallel rooms at their exact start and the next two time slots', () => {
    const result = homeAgendaAt(items, eventInstant('10:15'));
    expect(ids(result.current)).toEqual(['CFP-021', 'INVITED-004']);
    expect(ids(result.upcoming)).toEqual(['CFP-002', 'CFP-012', 'CFP-014', 'CFP-050']);
  });

  it('handles missing end times and gaps without inventing a finish time', () => {
    expect(ids(homeAgendaAt(items, eventInstant('09:45')).current)).toEqual([]);
    expect(ids(homeAgendaAt(items, eventInstant('09:45')).started)).toEqual(['registration']);
    expect(ids(homeAgendaAt(items, eventInstant('10:00')).current)).toEqual(['opening']);
    expect(ids(homeAgendaAt(items, eventInstant('10:56')).current)).toEqual([]);
    expect(ids(homeAgendaAt(items, eventInstant('10:56')).upcoming)).toEqual([
      'CFP-002',
      'CFP-012',
      'CFP-014',
      'CFP-050',
      'CFP-034',
      'CFP-043',
    ]);
    expect(items.find((item) => item.id === 'registration')?.end).toBeUndefined();
  });

  it('retains differently-started live sessions and all rooms in the remaining slot', () => {
    const template = items.find((item) => item.id === 'CFP-021')!;
    const revised = [
      { ...template, id: 'long-live', start: '10:15', end: '12:30' },
      { ...template, id: 'ended', start: '10:15', end: '10:45' },
      { ...template, id: 'later-live', start: '11:00', end: '11:45' },
      { ...template, id: 'next-a', start: '12:00', end: '12:45', space: 'auditorium' as const },
      { ...template, id: 'next-b', start: '12:00', end: '12:45', space: 'classroom' as const },
      { ...template, id: 'later', start: '13:00', end: '13:45' },
    ];
    const result = homeAgendaAt(revised, eventInstant('11:15'));
    expect(ids(result.current)).toEqual(['long-live', 'later-live']);
    expect(ids(result.upcoming)).toEqual(['next-a', 'next-b']);
    expect(
      new Set([...result.current, ...result.started, ...result.upcoming].map((i) => i.start)).size,
    ).toBe(3);
  });

  it('never hides a live room when over three start times overlap', () => {
    const template = items.find((item) => item.id === 'CFP-021')!;
    const revised = ['10:00', '10:10', '10:20', '10:30'].map((start, index) => ({
      ...template,
      id: `live-${index}`,
      start,
      end: '12:00',
    }));
    revised.push({ ...template, id: 'next', start: '12:00', end: '12:30' });
    const result = homeAgendaAt(revised, eventInstant('11:00'));
    expect(ids(result.current)).toEqual(['live-0', 'live-1', 'live-2', 'live-3']);
    expect(result.upcoming).toEqual([]);
  });

  it('does not claim the last session continues after the published end', () => {
    const result = homeAgendaAt(items, eventInstant('21:30'));
    expect(result).toEqual({ state: 'after', current: [], started: [], upcoming: [] });
  });

  it('follows updated published times outside the original event window', () => {
    const opening = items.find((item) => item.id === 'opening')!;
    const revised = [
      { ...opening, id: 'early', start: '08:00', end: '08:30' },
      { ...opening, id: 'late', start: '22:00', end: '22:45' },
    ];
    expect(homeAgendaAt(revised, eventInstant('07:59')).state).toBe('before');
    expect(ids(homeAgendaAt(revised, eventInstant('08:15')).current)).toEqual(['early']);
    expect(ids(homeAgendaAt(revised, eventInstant('22:15')).current)).toEqual(['late']);
    expect(homeAgendaAt(revised, eventInstant('22:45')).state).toBe('after');
  });

  it('lists a final untimed activity as started until the end of its calendar day', () => {
    const registration = items.find((item) => item.id === 'registration')!;
    const revised = [{ ...registration, start: '22:00' }];
    const late = homeAgendaAt(revised, eventInstant('23:30'));
    expect(late.state).toBe('during');
    expect(late.current).toEqual([]);
    expect(ids(late.started)).toEqual(['registration']);
    expect(homeAgendaAt(revised, eventInstant('23:59') + 60_000).state).toBe('after');
  });

  it('renders published session titles, speakers, rooms and links', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(eventInstant('10:15'));
    globalThis.fetch = jest.fn<typeof fetch>(
      async (input) =>
        ({
          ok: true,
          json: async () => (String(input).includes('agenda-2026') ? agenda : programme),
        }) as Response,
    );
    const element = new ScheduleBlock();
    document.body.appendChild(element);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await element.updateComplete;
    const root = element.shadowRoot!;
    expect(root.textContent).toContain('Happening now');
    expect(root.textContent).toContain('Up next');
    expect(
      [...root.querySelectorAll('.group h3')].map((heading) => heading.textContent?.trim()),
    ).toEqual(['Happening now', 'Up next', 'Then · 12:00']);
    expect(root.textContent).toContain('Auditorium');
    expect(root.textContent).toContain('Classroom');
    expect(root.textContent).toContain(items.find((item) => item.id === 'CFP-021')?.title);
    expect(root.textContent).toContain(
      items.find((item) => item.id === 'CFP-021')?.speakers[0]?.name,
    );
    expect(root.querySelector('a[href="/sessions/CFP-021/"]')).not.toBeNull();
    expect(root.querySelector('a[href="/schedule/"]')).not.toBeNull();
    expect(root.textContent).toContain('Warsaw time');
    element.remove();
  });

  it('starts the pre-event list without the redundant green date heading', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(eventInstant('09:00') - 1000);
    globalThis.fetch = jest.fn<typeof fetch>(
      async (input) =>
        ({
          ok: true,
          json: async () => (String(input).includes('agenda-2026') ? agenda : programme),
        }) as Response,
    );
    const element = new ScheduleBlock();
    document.body.appendChild(element);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await element.updateComplete;
    expect(element.shadowRoot?.textContent).not.toContain('Coming up on 21 November');
    expect(element.shadowRoot?.querySelector('.group')?.textContent).toContain('Registration');
  });

  it('automatically advances the live programme when a session begins', async () => {
    jest.useFakeTimers().setSystemTime(eventInstant('10:15') - 5000);
    globalThis.fetch = jest.fn<typeof fetch>(
      async (input) =>
        ({
          ok: true,
          json: async () => (String(input).includes('agenda-2026') ? agenda : programme),
        }) as Response,
    );
    const element = new ScheduleBlock();
    document.body.appendChild(element);
    await jest.advanceTimersByTimeAsync(0);
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector('.group')?.textContent).toContain('Opening');

    await jest.advanceTimersByTimeAsync(15_000);
    await element.updateComplete;
    const liveGroup = element.shadowRoot?.querySelector('.group')?.textContent;
    expect(liveGroup).toContain(items.find((item) => item.id === 'CFP-021')?.title);
    expect(liveGroup).toContain(items.find((item) => item.id === 'INVITED-004')?.title);
    expect(liveGroup).not.toContain('Opening');
  });

  it('shows a recoverable state when programme data cannot be loaded', async () => {
    globalThis.fetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('offline'));
    const element = new ScheduleBlock();
    document.body.appendChild(element);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await element.updateComplete;
    expect(element.shadowRoot?.textContent).toContain('couldn’t be loaded');
    expect(element.shadowRoot?.querySelector('a[href="/schedule/"]')).not.toBeNull();
    element.remove();
  });
});
