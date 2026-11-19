import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ThemedElement } from '../components/themed-element';
import {
  buildAgenda,
  eventInstant,
  progressAt,
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
    const firstStartTime = ordered[0]!.start;
    return {
      state,
      current: [],
      started: [],
      upcoming: ordered.filter((item) => item.start === firstStartTime),
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
  // Show all live rooms. During a gap, keep every room at the next start time.
  const nextStart = current.length
    ? undefined
    : ordered.find((item) => eventInstant(item.start) > now)?.start;
  return {
    state,
    current,
    started,
    upcoming: nextStart ? ordered.filter((item) => item.start === nextStart) : [],
  };
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
        .elapsed {
          display: block;
          max-width: 360px;
          margin-top: 12px;
        }
        .elapsed progress {
          display: block;
          width: 100%;
          height: 4px;
          border: 0;
          border-radius: 3px;
          overflow: hidden;
          appearance: none;
          background: #547960;
          color: var(--terminal-green);
          accent-color: var(--terminal-green);
        }
        .elapsed progress::-webkit-progress-bar {
          background: #547960;
        }
        .elapsed progress::-webkit-progress-value {
          background: var(--terminal-green);
        }
        .elapsed progress::-moz-progress-bar {
          background: var(--terminal-green);
        }
        .amenity {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 8px 16px;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid var(--terminal-line);
        }
        .amenity strong {
          font-family: var(--font-mono, monospace);
          color: var(--terminal-green);
        }
        .amenity span {
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
    const progress = this.status === 'ready' ? progressAt(item, this.now) : null;
    const elapsed = progress === null ? null : Math.floor(progress);
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
        ${
          elapsed !== null
            ? html`<span class="elapsed" aria-live="off">
                <progress
                  value=${elapsed}
                  max="100"
                  aria-label=${`${item.title}: ${item.id === 'networking' ? 'approximate ' : ''}scheduled time elapsed`}
                >
                  ${elapsed}%
                </progress>
              </span>`
            : nothing
        }
      </span>`;
    return html`<li>
      ${item.href ? html`<a class="row" href=${item.href}>${content}</a>` : html`<div class="row">${content}</div>`}
    </li>`;
  }

  override render() {
    const selection = homeAgendaAt(this.items, this.now);
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
                  selection.current.length
                    ? html`<div class="group">
                        <h3>Happening now</h3>
                        <ul>
                          ${selection.current.map((item) => this.renderItem(item))}
                        </ul>
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
                  selection.upcoming.length
                    ? html`<div class="group">
                        ${selection.state === 'before' ? nothing : html`<h3>Up next</h3>`}
                        <ul>
                          ${selection.upcoming.map((item) => this.renderItem(item))}
                        </ul>
                      </div>`
                    : nothing
                }
              `
            : nothing
        }
      </div>
      ${
        this.now < eventInstant('23:59') + 60_000
          ? html`<div class="amenity"><strong>Coffee</strong><span>On-site amenity</span></div>`
          : nothing
      }
      <a class="schedule-link" href="/schedule/">View full schedule →</a>
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'schedule-block': ScheduleBlock;
  }
}
