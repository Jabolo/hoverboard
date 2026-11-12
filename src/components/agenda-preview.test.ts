import { afterEach, describe, expect, it, jest } from '@jest/globals';
import draft from '../../public/data/agenda-2026.json';
import programme from '../../public/data/programme-2026.json';
import { buildAgenda, eventInstant } from '../utils/agenda-preview-data';
import type { AgendaItem, DraftAgenda } from '../utils/agenda-preview-data';
import type { PreviewSource } from '../utils/speakers-preview-data';
import type { SessionFavorite } from './session-favorite';
import { AgendaPreview } from './agenda-preview';

afterEach(() => {
  document.body.replaceChildren();
  window.localStorage.clear();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('local agenda presentation', () => {
  it('shows lunch details while preserving the live progress indicator', async () => {
    jest
      .spyOn(AgendaPreview.prototype as unknown as { load: () => Promise<void> }, 'load')
      .mockResolvedValue(undefined);
    const agenda = document.createElement('agenda-preview') as AgendaPreview;
    document.body.append(agenda);
    const state = agenda as unknown as { items: AgendaItem[]; loadState: 'ready'; now: number };
    state.items = buildAgenda(draft as DraftAgenda, programme as PreviewSource);
    state.loadState = 'ready';
    state.now = eventInstant('14:30');
    await agenda.updateComplete;
    const lunch = agenda.shadowRoot!.querySelector('.entry.lunch')!;
    expect(lunch).toHaveTextContent('Wraps and salad bowls for everyone');
    expect(lunch.querySelector('.lunch-icons')).toHaveAttribute('aria-hidden', 'true');
    expect(lunch.querySelector('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '50');
  });

  it('uses the real clock to advance live progress without demo controls', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-21T11:15:00Z'));
    jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    jest
      .spyOn(AgendaPreview.prototype as unknown as { load: () => Promise<void> }, 'load')
      .mockResolvedValue(undefined);
    const agenda = document.createElement('agenda-preview') as AgendaPreview;
    document.body.append(agenda);
    const state = agenda as unknown as { items: AgendaItem[]; loadState: 'ready' };
    state.items = buildAgenda(draft as DraftAgenda, programme as PreviewSource);
    state.loadState = 'ready';
    await agenda.updateComplete;
    const root = agenda.shadowRoot!;
    const getWidth = () =>
      parseFloat((root.querySelectorAll('.now-progress span')[1] as HTMLElement).style.width);
    expect(root.querySelector('select')).toBeNull();
    expect(root.textContent).not.toContain('Demo time');
    expect(getWidth()).toBe(25);
    jest.advanceTimersByTime(60_000);
    await agenda.updateComplete;
    expect(getWidth()).toBeGreaterThan(26);
  });

  it('shows current sessions with their room, speaker and elapsed progress', async () => {
    jest
      .spyOn(AgendaPreview.prototype as unknown as { load: () => Promise<void> }, 'load')
      .mockResolvedValue(undefined);
    const agenda = document.createElement('agenda-preview') as AgendaPreview;
    document.body.append(agenda);
    const state = agenda as unknown as { items: AgendaItem[]; loadState: 'ready'; now: number };
    state.items = buildAgenda(draft as DraftAgenda, programme as PreviewSource);
    state.loadState = 'ready';
    state.now = eventInstant('12:15');
    await agenda.updateComplete;
    const cards = agenda.shadowRoot!.querySelectorAll('.now-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveAttribute('href', '/sessions/CFP-014/');
    expect(cards[0]).toHaveTextContent('Auditorium');
    expect(cards[0]).toHaveTextContent('Ivan Lapa');
    expect(cards[1]).toHaveTextContent('Classroom');
    expect(cards[1]).toHaveTextContent('Dominika Zając');
    expect(cards[1]!.querySelector('.now-progress span')).toHaveStyle({ width: '25%' });
  });

  it('shows a welcome without an invented room and filters saved sessions', async () => {
    jest
      .spyOn(AgendaPreview.prototype as unknown as { load: () => Promise<void> }, 'load')
      .mockResolvedValue(undefined);
    const agenda = document.createElement('agenda-preview') as AgendaPreview;
    document.body.append(agenda);
    const state = agenda as unknown as { items: AgendaItem[]; loadState: 'ready' };
    state.items = buildAgenda(draft as DraftAgenda, programme as PreviewSource);
    state.loadState = 'ready';
    await agenda.updateComplete;
    const root = agenda.shadowRoot!;
    const welcome = root.querySelector('.opening')!;
    expect(welcome.textContent).toContain('Welcome to DevFest!');
    expect(welcome.querySelector('.space')).toBeNull();
    expect(root.textContent).not.toContain('Working draft.');
    expect(root.textContent).toContain('Times may change');
    expect(root.querySelectorAll('session-favorite')).toHaveLength(14);
    expect(root.querySelector('h2')?.textContent).toContain('09:00');
    const registration = root.querySelector('.registration')!;
    expect(registration.textContent).toContain('From 09:00');
    expect(registration.textContent).toContain('Registration, networking & games');
    expect(registration.textContent).toContain('coffee and a croissant');
    expect(welcome.querySelectorAll('.confetti i')).toHaveLength(10);
    expect(registration.querySelector('.progress')).toBeNull();
    expect(root.querySelector('.networking .disco-ball')).not.toBeNull();
    expect(root.querySelectorAll('.networking .party-lights i')).toHaveLength(10);

    const heart = root.querySelector('session-favorite') as SessionFavorite;
    await heart.updateComplete;
    heart.shadowRoot!.querySelector('button')!.click();
    await agenda.updateComplete;
    (root.querySelector('.saved-filter') as HTMLButtonElement).click();
    await agenda.updateComplete;
    expect(root.querySelectorAll('session-favorite')).toHaveLength(1);
    expect(root.querySelector('.saved-filter')).toHaveAttribute('aria-pressed', 'true');
    expect(root.querySelector('.opening')).toBeNull();
    expect(root.querySelector('session-favorite')).toHaveAttribute('session-id', 'CFP-021');
  });
});
