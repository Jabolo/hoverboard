import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ThemedElement } from '../components/themed-element';
import {
  buildAgenda,
  eventInstant,
  type AgendaItem,
  type DraftAgenda,
} from '../utils/agenda-preview-data';
import type { PreviewSource } from '../utils/speakers-preview-data';

const spaceLabel = { auditorium: 'Auditorium', classroom: 'Classroom', both: 'Event-wide' };
const kindLabel = {
  session: 'Talk',
  workshop: 'Workshop',
  panel: 'Panel',
  activity: 'Event',
  open: 'Open slot',
};

/** Keep started activities without an end distinct from events known to be in progress. */
export function homeAgendaAt(items: AgendaItem[], now: number) {
  const ordered = [...items]
    .filter((item) => item.kind !== 'open')
    .sort((a, b) => a.start.localeCompare(b.start) || a.space.localeCompare(b.space));
  if (!ordered.length) return { state: 'before' as const, current: [], started: [], upcoming: [] };
  const firstStart = eventInstant(ordered[0]!.start);
  const latestStart = ordered[ordered.length - 1]!.start;
  const lastTimedEnd = Math.max(
    firstStart,
    ...ordered.filter((item) => item.end).map((item) => eventInstant(item.end!)),
  );
  // A final entry without an end remains listed as started for its calendar day;
  // midnight is a display boundary, not a claim about when the activity ends.
  const hasFinalUntimed = ordered.some((item) => !item.end && item.start === latestStart);
  const displayEnd = hasFinalUntimed ? eventInstant('23:59') + 60_000 : lastTimedEnd;
  const state = now < firstStart ? 'before' : now < displayEnd ? 'during' : 'after';
  if (state === 'after') return { state, current: [], started: [], upcoming: [] };
  if (state === 'before') {
    const firstStarts = [...new Set(ordered.map((item) => item.start))].slice(0, 3);
    return {
      state,
      current: [],
      started: [],
      upcoming: ordered.filter((item) => firstStarts.includes(item.start)),
    };
  }
  const current = ordered.filter(
    (item) => item.end && eventInstant(item.start) <= now && now < eventInstant(item.end),
  );
  const started = ordered.filter((item) => {
    if (item.end || eventInstant(item.start) > now) return false;
    const nextStart = ordered.find((candidate) => candidate.start > item.start)?.start;
    return nextStart ? now < eventInstant(nextStart) : true;
  });
  // A slot is a start time, not an individual room. Keep every live room,
  // even if parallel activities started at different times, then fill the
  // remaining places with the nearest distinct upcoming starts.
  const activeStarts = new Set([...current, ...started].map((item) => item.start));
  const futureStarts = [
    ...new Set(ordered.filter((item) => eventInstant(item.start) > now).map((item) => item.start)),
  ].slice(0, Math.max(0, 3 - activeStarts.size));
  return {
    state,
    current,
    started,
    upcoming: ordered.filter((item) => futureStarts.includes(item.start)),
  };
}

/** Consecutive start times form one slot each, with every parallel room retained. */
function groupByStart(items: AgendaItem[]): AgendaItem[][] {
  const groups: AgendaItem[][] = [];
  for (const item of items) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup?.[0]?.start === item.start) lastGroup.push(item);
    else groups.push([item]);
  }
  return groups;
}

@customElement('schedule-block')
export class ScheduleBlock extends ThemedElement {
  @state() private items: AgendaItem[] = [];
  @state() private status: 'loading' | 'ready' | 'stale' | 'error' = 'loading';
  @state() private now = Date.now();
  private clockTimer?: number;
  private refreshTimer?: number;
  private requestVersion = 0;

  override connectedCallback() {
    super.connectedCallback();
    void this.load();
    this.clockTimer = window.setInterval(() => {
      this.now = Date.now();
    }, 15_000);
    this.refreshTimer = window.setInterval(() => {
      if (!document.hidden) void this.load();
    }, 300_000);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.requestVersion++;
    window.clearInterval(this.clockTimer);
    window.clearInterval(this.refreshTimer);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  private readonly onVisibilityChange = () => {
    if (!document.hidden) {
      this.now = Date.now();
      void this.load();
    }
  };

  private async load() {
    const version = ++this.requestVersion;
    try {
      const [agenda, programme] = await Promise.all([
        fetch('/data/agenda-2026.json', { cache: 'no-store' }),
        fetch('/data/programme-2026.json', { cache: 'no-store' }),
      ]);
      if (!agenda.ok || !programme.ok) throw new Error('Programme unavailable');
      const next = buildAgenda(
        (await agenda.json()) as DraftAgenda,
        (await programme.json()) as PreviewSource,
      );
      if (!next.length) throw new Error('Programme is empty');
      if (version !== this.requestVersion || !this.isConnected) return;
      this.items = next;
      this.status = 'ready';
    } catch {
      if (version !== this.requestVersion || !this.isConnected) return;
      this.status = this.items.length ? 'stale' : 'error';
    }
  }

  static override get styles() {
    return [
      ...super.styles,
      css`
        :host {
          display: block;
          border-bottom: 1px solid var(--divider-color);
          background: var(--primary-background-color);
          color: var(--terminal-copy);
        }
        * {
          box-sizing: border-box;
        }
        .container {
          padding-top: 56px;
          padding-bottom: 56px;
        }
        .heading-row {
          display: flex;
          align-items: end;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 20px;
        }
        h2 {
          margin: 0;
          font-family: var(--font-mono, monospace);
          font-size: clamp(28px, 4vw, 40px);
          letter-spacing: -0.025em;
          line-height: 1.1;
        }
        .intro {
          margin: 12px 0 0;
          color: var(--terminal-muted);
          font-size: 15px;
          line-height: 1.5;
        }
        .schedule-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
          padding: 0 18px;
          border: 1px solid var(--google-blue);
          border-radius: 4px;
          color: var(--primary-text-color);
          font-weight: 700;
          text-decoration: none;
          margin-top: 24px;
        }
        .schedule-link:hover {
          background: var(--secondary-background-color);
        }
        a:focus-visible,
        button:focus-visible {
          outline: 2px solid var(--terminal-green);
          outline-offset: 4px;
        }
        .programme {
          margin-top: 30px;
          border-top: 1px solid var(--terminal-line);
        }
        .group {
          padding-top: 22px;
        }
        .group + .group {
          margin-top: 8px;
        }
        h3 {
          margin: 0 0 12px;
          color: var(--terminal-green);
          font-family: var(--font-mono, monospace);
          font-size: 14px;
          line-height: 1.4;
        }
        ul {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        li {
          border-bottom: 1px solid var(--terminal-line);
        }
        .row {
          display: grid;
          grid-template-columns: 118px minmax(0, 1fr);
          gap: 12px 24px;
          align-items: start;
          min-height: 64px;
          padding: 16px 0;
          color: inherit;
          text-decoration: none;
        }
        a.row:hover .title {
          color: var(--terminal-green);
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .time {
          color: var(--terminal-green);
          font-family: var(--font-mono, monospace);
          font-size: 15px;
          font-weight: 700;
          line-height: 1.5;
          font-variant-numeric: tabular-nums;
        }
        .details {
          min-width: 0;
        }
        .metadata {
          display: flex;
          flex-wrap: wrap;
          gap: 6px 12px;
          margin-bottom: 6px;
          color: var(--terminal-muted);
          font-family: var(--font-mono, monospace);
          font-size: 13px;
          font-weight: 700;
          line-height: 1.4;
        }
        .metadata span:first-child {
          color: var(--terminal-blue);
        }
        .title {
          display: block;
          color: var(--terminal-copy);
          font-size: 17px;
          font-weight: 700;
          line-height: 1.4;
          overflow-wrap: anywhere;
        }
        .speakers {
          display: block;
          margin: 5px 0 0;
          color: var(--terminal-muted);
          font-size: 14px;
          line-height: 1.4;
        }
        .message {
          color: var(--terminal-muted);
          line-height: 1.55;
        }
        .notice {
          color: var(--terminal-yellow);
          line-height: 1.5;
        }
        @media (max-width: 600px) {
          .container {
            padding-top: 28px;
            padding-bottom: 40px;
          }
          h2 {
            font-size: 26px;
          }
          .intro {
            margin-top: 8px;
            font-size: 13px;
          }
          .programme {
            margin-top: 20px;
          }
          .group {
            padding-top: 16px;
          }
          h3 {
            margin-bottom: 8px;
          }
          .heading-row {
            align-items: start;
          }
          .row {
            grid-template-columns: 1fr;
            gap: 4px;
            padding: 15px 0;
          }
          .metadata {
            margin: 3px 0 6px;
          }
          .title {
            font-size: 16px;
          }
        }
      `,
    ];
  }

  private renderItem(item: AgendaItem) {
    const content = html` <span class="time"
        ><time datetime=${`2026-11-21T${item.start}:00+01:00`}>${item.start}</time
        >${item.end ? html`–${item.id === 'networking' ? '≈' : nothing}<time datetime=${`2026-11-21T${item.end}:00+01:00`}>${item.end}</time>` : nothing}</span
      >
      <span class="details">
        <span class="metadata"
          ><span>${spaceLabel[item.space]}</span><span>${kindLabel[item.kind]}</span></span
        >
        <span class="title">${item.title}</span>
        ${item.speakers.length ? html`<span class="speakers">${item.speakers.map((speaker) => speaker.name).join(' · ')}</span>` : nothing}
      </span>`;
    return html`<li>
      ${item.href ? html`<a class="row" href=${item.href}>${content}</a>` : html`<div class="row">${content}</div>`}
    </li>`;
  }

  override render() {
    const selection = homeAgendaAt(this.items, this.now);
    const upcomingGroups = groupByStart(selection.upcoming);
    return html` <section id="schedule" class="container" aria-labelledby="schedule-title">
      <div class="heading-row">
        <div>
          <h2 id="schedule-title">The programme</h2>
          <p class="intro">21 November · Warsaw time · device clock</p>
        </div>
      </div>
      <div class="programme" aria-live="polite">
        ${this.status === 'loading' ? html`<p class="message">Loading the programme…</p>` : nothing}
        ${this.status === 'error' ? html`<p class="message">The programme couldn’t be loaded. <a href="/schedule/">Open the full schedule</a> or try again when you’re online.</p>` : nothing}
        ${this.status === 'stale' ? html`<p class="notice">Couldn’t refresh the programme. Times shown may be out of date.</p>` : nothing}
        ${
          this.status === 'ready' || this.status === 'stale'
            ? html`
                ${selection.state === 'after' ? html`<p class="message">See the full programme for the day’s sessions.</p>` : nothing}
                ${
                  selection.state === 'during'
                    ? html`<div class="group">
                        <h3>Happening now</h3>
                        ${
                          selection.current.length
                            ? html`<ul>
                                ${selection.current.map((item) => this.renderItem(item))}
                              </ul>`
                            : html`<p class="message">No timed sessions are listed right now.</p>`
                        }
                      </div>`
                    : nothing
                }
                ${
                  selection.started.length
                    ? html`<div class="group">
                        <h3>Started · end time not listed</h3>
                        <ul>
                          ${selection.started.map((item) => this.renderItem(item))}
                        </ul>
                      </div>`
                    : nothing
                }
                ${
                  upcomingGroups.length
                    ? html`${upcomingGroups.map(
                        (group, index) =>
                          html`<div class="group">
                            ${
                              selection.state === 'before' && index === 0
                                ? nothing
                                : html`<h3>
                                    ${index === 0 ? 'Up next' : `Then · ${group[0]!.start}`}
                                  </h3>`
                            }
                            <ul>
                              ${group.map((item) => this.renderItem(item))}
                            </ul>
                          </div>`,
                      )}`
                    : nothing
                }
              `
            : nothing
        }
      </div>
      <a class="schedule-link" href="/schedule/">View full schedule →</a>
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'schedule-block': ScheduleBlock;
  }
}
