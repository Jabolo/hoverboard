import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ScheduleBlock, homeAgendaAt } from './schedule-block';
import { buildAgenda, eventInstant, type DraftAgenda } from '../utils/agenda-preview-data';
import type { PreviewSource } from '../utils/speakers-preview-data';
import agenda from '../../public/data/agenda-2026.json';
import programme from '../../public/data/programme-2026.json';
import { getScheduleTestTime } from '../utils/schedule-test-time';

const items = buildAgenda(agenda as DraftAgenda, programme as PreviewSource);
const ids = (list: typeof items) => list.map((item) => item.id);

describe('on-site homepage programme', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    document.body.replaceChildren();
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
    jest.useRealTimers();
    history.replaceState({}, '', '/');
  });

  it('shows only the first published starting time before the event', () => {
    const result = homeAgendaAt(items, eventInstant('09:00') - 1);
    expect(result.state).toBe('before');
    expect(ids(result.upcoming)).toEqual(['registration']);
    expect(result.current).toEqual([]);
  });

  it('shows all live parallel rooms without later slots at their exact start', () => {
    const result = homeAgendaAt(items, eventInstant('10:15'));
    expect(ids(result.current)).toEqual(['CFP-021', 'INVITED-004']);
    expect(result.upcoming).toEqual([]);
  });

  it('handles missing end times and gaps without inventing a finish time', () => {
    expect(ids(homeAgendaAt(items, eventInstant('09:45')).current)).toEqual([]);
    expect(ids(homeAgendaAt(items, eventInstant('09:45')).started)).toEqual(['registration']);
    expect(ids(homeAgendaAt(items, eventInstant('10:00')).current)).toEqual(['opening']);
    expect(ids(homeAgendaAt(items, eventInstant('10:56')).current)).toEqual([]);
    expect(ids(homeAgendaAt(items, eventInstant('10:56')).upcoming)).toEqual([
      'CFP-002',
      'CFP-012',
    ]);
    expect(items.find((item) => item.id === 'registration')?.end).toBeUndefined();
  });

  it('retains differently-started live sessions without showing upcoming slots', () => {
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
    expect(result.upcoming).toEqual([]);
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
    expect(root.textContent).not.toContain('Up next');
    expect(
      [...root.querySelectorAll('.group h3')].map((heading) => heading.textContent?.trim()),
    ).toEqual(['Happening now']);
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

  it('shows only the next start and its parallel rooms during a gap', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(eventInstant('16:05'));
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
    expect(root.textContent).toContain('Up next');
    expect(root.textContent).not.toContain('Happening now');
    expect(root.querySelectorAll('.programme li')).toHaveLength(2);
    expect(root.querySelector('a[href="/sessions/CFP-028/"]')).not.toBeNull();
    expect(root.querySelector('a[href="/sessions/CFP-015/"]')).not.toBeNull();
    expect(root.textContent).not.toContain('17:05');
    expect(root.querySelector('progress')).toBeNull();
    expect(root.querySelector('.amenity')?.textContent).toContain('Coffee');
  });

  it('keeps an untimed started activity distinct from the next timed item', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(eventInstant('09:30'));
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
    expect(root.textContent).toContain('Started · end time not listed');
    expect(root.textContent).toContain('Registration');
    expect(root.textContent).toContain('Up next');
    expect(root.textContent).toContain('Opening');
    expect(root.textContent).not.toContain('Happening now');
    expect(root.querySelectorAll('.programme li')).toHaveLength(2);
    expect(root.querySelector('progress')).toBeNull();
    expect(root.querySelector('.amenity')?.textContent).toContain('Coffee');
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
    jest.spyOn(Date, 'now').mockReturnValue(eventInstant('11:05'));
    globalThis.fetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('offline'));
    const element = new ScheduleBlock();
    document.body.appendChild(element);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await element.updateComplete;
    expect(element.shadowRoot?.textContent).toContain('couldn’t be loaded');
    expect(element.shadowRoot?.querySelector('a[href="/schedule/"]')).not.toBeNull();
    expect(element.shadowRoot?.querySelector('.amenity')?.textContent).toContain('Coffee');
    element.remove();
  });

  it('shows the requested test moments from the public programme', () => {
    const selection = (time: string) =>
      homeAgendaAt(items, getScheduleTestTime('localhost', `?schedule-test=${time}`)!);
    expect(ids(selection('09:30').started)).toEqual(['registration']);
    expect(ids(selection('09:30').upcoming)).toEqual(['opening']);
    expect(ids(selection('11:05').current)).toEqual(['CFP-002', 'CFP-012']);
    expect(selection('11:05').upcoming).toEqual([]);
    expect(ids(selection('16:05').current)).toEqual([]);
    expect(ids(selection('16:05').upcoming)).toEqual(['CFP-028', 'CFP-015']);
  });

  it('labels simulated time and keeps it fixed as the real clock advances', async () => {
    history.replaceState({}, '', '/?ref=keep&schedule-test=11%3A05#programme');
    jest.useFakeTimers().setSystemTime(eventInstant('09:30'));
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
    const root = element.shadowRoot!;
    expect(root.textContent).toContain('TEST VIEW · 11:05 Warsaw time');
    expect(root.querySelector('.intro')?.textContent).toContain('simulated clock');
    expect(root.textContent).toContain(items.find((item) => item.id === 'CFP-002')!.title);
    expect(root.textContent).not.toContain('Started · end time not listed');
    const bars = [...root.querySelectorAll<HTMLProgressElement>('progress')];
    expect(bars).toHaveLength(2);
    expect(bars.map((bar) => bar.value)).toEqual([11, 11]);
    expect(bars[0]?.getAttribute('aria-label')).toContain('scheduled time elapsed');
    expect(root.querySelector('.elapsed-label')).toBeNull();
    expect(root.querySelector('.amenity')?.textContent).toContain('Coffee');
    const links = [...root.querySelectorAll<HTMLAnchorElement>('.test-options a')];
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      '09:30',
      '11:05',
      '16:05',
      'Use real time',
    ]);
    expect(links[0]?.getAttribute('href')).toBe('/?ref=keep&schedule-test=09%3A30#programme');
    expect(links[3]?.getAttribute('href')).toBe('/?ref=keep#programme');
    expect(links.every((link) => link.hasAttribute('router-ignore'))).toBe(true);
    await jest.advanceTimersByTimeAsync(30_000);
    await element.updateComplete;
    expect(root.textContent).toContain('TEST VIEW · 11:05 Warsaw time');
    expect(root.textContent).toContain(items.find((item) => item.id === 'CFP-002')!.title);
  });

  it('shows separate scheduled progress for live sessions with different durations', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(eventInstant('10:30'));
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
    const bars = [...element.shadowRoot!.querySelectorAll<HTMLProgressElement>('progress')];
    expect(bars.map((bar) => bar.value)).toEqual([50, 37]);
    expect(bars.every((bar) => bar.max === 100)).toBe(true);
    expect(bars[0]?.getAttribute('aria-label')).toContain('scheduled time elapsed');
    expect(bars[1]?.getAttribute('aria-label')).toContain('scheduled time elapsed');
  });

  it('advances live progress with the programme clock', async () => {
    jest.useFakeTimers().setSystemTime(eventInstant('11:00'));
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
    expect(element.shadowRoot?.querySelector<HTMLProgressElement>('progress')?.value).toBe(0);
    await jest.advanceTimersByTimeAsync(60_000);
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector<HTMLProgressElement>('progress')?.value).toBe(2);
  });

  it('labels progress as approximate when the published networking end is approximate', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(eventInstant('20:00'));
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
    const progress = element.shadowRoot?.querySelector<HTMLProgressElement>('progress');
    expect(progress?.getAttribute('aria-label')).toContain('approximate scheduled time elapsed');
    expect(progress?.value).toBe(33);
  });

  it('hides progress if programme refresh fails and marks the data as potentially stale', async () => {
    history.replaceState({}, '', '/?schedule-test=11%3A05#programme');
    jest.useFakeTimers().setSystemTime(eventInstant('11:05'));
    let requests = 0;
    globalThis.fetch = jest.fn<typeof fetch>(async (input) => {
      if (++requests > 2) throw new Error('offline');
      return {
        ok: true,
        json: async () => (String(input).includes('agenda-2026') ? agenda : programme),
      } as Response;
    });
    const element = new ScheduleBlock();
    document.body.appendChild(element);
    await jest.advanceTimersByTimeAsync(0);
    await element.updateComplete;
    expect(element.shadowRoot?.querySelectorAll('progress')).toHaveLength(2);
    await jest.advanceTimersByTimeAsync(300_000);
    await element.updateComplete;
    expect(element.shadowRoot?.textContent).toContain('Times shown may be out of date');
    expect(element.shadowRoot?.querySelector('progress')).toBeNull();
    expect(element.shadowRoot?.querySelector('.amenity')?.textContent).toContain('Coffee');
  });

  it('keeps the untimed amenity after the last session, but hides it after the event day', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(eventInstant('23:00'));
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
    expect(element.shadowRoot?.querySelector('.amenity')?.textContent).toContain('Coffee');
    expect(element.shadowRoot?.querySelector('progress')).toBeNull();
    element.remove();
    now.mockReturnValue(eventInstant('23:59') + 60_000);
    const nextDay = new ScheduleBlock();
    document.body.appendChild(nextDay);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextDay.updateComplete;
    expect(nextDay.shadowRoot?.querySelector('.amenity')).toBeNull();
  });
});
