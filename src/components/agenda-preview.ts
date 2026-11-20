import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ThemedElement } from './themed-element';
import './session-favorite';
import { isSessionFavorite, subscribeSessionFavorites } from '../utils/session-favorites';
import {
  AgendaFilter,
  AgendaGroup,
  AgendaItem,
  AgendaSpeaker,
  DraftAgenda,
  buildAgenda,
  eventState,
  groupAgenda,
  progressAt,
} from '../utils/agenda-preview-data';
import type { PreviewSource } from '../utils/speakers-preview-data';

const filters: { value: AgendaFilter; label: string }[] = [
  { value: 'all', label: 'All spaces' },
  { value: 'auditorium', label: 'Auditorium' },
  { value: 'classroom', label: 'Classroom' },
  { value: 'vibe', label: 'Vibe Zone' },
];
const spaces = { auditorium: 'Auditorium', classroom: 'Classroom', both: 'Event-wide' };
const kinds = {
  session: 'Talk',
  workshop: 'Workshop',
  panel: 'Panel',
  activity: 'Event',
  open: 'Open slot',
};
const agendaTitle = (item: AgendaItem): string =>
  item.id === 'opening'
    ? 'Welcome to DevFest!'
    : item.id === 'networking'
      ? 'Afterparty · Networking · Disco Party'
      : item.title;

/** Timetable built from the published agenda and programme data. */
@customElement('agenda-preview')
export class AgendaPreview extends ThemedElement {
  @state() private items: AgendaItem[] = [];
  @state() private filter: AgendaFilter = 'all';
  @state() private loadState: 'loading' | 'ready' | 'error' = 'loading';
  @state() private now = Date.now();
  @state() private savedOnly = false;
  @state() private favoritesRevision = 0;
  private timer: number | undefined;
  private unsubscribeFavorites: (() => void) | undefined;
  private groupedItems: AgendaItem[] | undefined;
  private groupedFilter: AgendaFilter | undefined;
  private groupedSavedOnly = false;
  private groupedFavoritesRevision = -1;
  private cachedGroups: AgendaGroup[] = [];
  private readonly refreshClock = () => {
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = undefined;
    if (document.hidden) return;
    const current = Date.now();
    this.now = current;
    const active = eventState(this.now) === 'during';
    const delay = active ? 1000 : 60_000 - (current % 60_000);
    this.timer = window.setTimeout(this.refreshClock, delay);
  };

  static override get styles() {
    return [
      ...super.styles,
      css`
        :host {
          display: block;
          min-height: 100vh;
          color: var(--terminal-copy);
        }
        * {
          box-sizing: border-box;
        }
        .agenda {
          width: min(100%, 1136px);
          margin: 0 auto;
          padding: 36px 20px 96px;
        }
        .intro {
          display: flex;
          flex-wrap: wrap;
          align-items: end;
          justify-content: space-between;
          gap: 22px;
          margin-bottom: 30px;
        }
        .intro h1 {
          margin: 0 0 9px;
          padding: 0;
          font-size: clamp(28px, 4vw, 40px);
          line-height: 1.15;
          letter-spacing: -0.03em;
        }
        .intro p {
          color: var(--terminal-muted);
          line-height: 1.6;
          margin: 0;
          max-width: 60ch;
        }
        .date {
          color: var(--terminal-copy);
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .date-note {
          margin-top: 5px;
          color: var(--terminal-muted);
          font-size: 13px;
          line-height: 1.5;
        }
        .filter-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px 16px;
        }
        .saved-filter {
          min-height: 44px;
        }
        .filters {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 0;
          padding: 0;
          border: 0;
        }
        .filters legend {
          margin-bottom: 10px;
          color: var(--terminal-muted);
          font-size: 14px;
        }
        button {
          min-height: 44px;
          padding: 9px 16px;
          border: 1px solid var(--terminal-line);
          border-radius: 10px;
          background: var(--terminal-panel);
          color: var(--terminal-copy);
          font: inherit;
          font-weight: 650;
        }
        button {
          cursor: pointer;
        }
        button[aria-pressed='true'] {
          background: var(--terminal-green);
          border-color: var(--terminal-green);
          color: #07150d;
        }
        button:hover:not([aria-pressed='true']) {
          border-color: var(--terminal-green);
        }
        button:focus-visible,
        a:focus-visible {
          outline: 3px solid var(--terminal-blue);
          outline-offset: 3px;
        }
        .now-summary {
          min-width: 0;
          margin: 26px 0 12px;
          padding: 18px 0;
          border-top: 1px solid var(--terminal-line);
          border-bottom: 1px solid var(--terminal-line);
        }
        .now-heading {
          display: flex;
          align-items: center;
          gap: 9px;
          margin: 0 0 12px;
          padding: 0;
          color: var(--terminal-copy);
          font-size: 18px;
          line-height: 1.3;
        }
        .now-heading::before {
          content: '';
          width: 8px;
          height: 8px;
          flex: 0 0 8px;
          border-radius: 50%;
          background: var(--terminal-green);
        }
        .now-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
          gap: 10px;
        }
        .now-card {
          display: flex;
          flex-direction: column;
          gap: 7px;
          min-width: 0;
          min-height: 44px;
          padding: 14px 16px 12px;
          border: 1px solid #426a52;
          border-radius: 10px;
          background: #101f1b;
          color: var(--terminal-copy);
          text-decoration: none;
        }
        a.now-card:hover {
          border-color: var(--terminal-green);
          background: #162a20;
        }
        .now-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 5px 10px;
          color: var(--terminal-green);
          font-size: 12px;
          font-weight: 700;
          line-height: 1.4;
          font-variant-numeric: tabular-nums;
        }
        .now-title {
          color: var(--terminal-copy);
          font-size: 15px;
          font-weight: 700;
          line-height: 1.4;
          overflow-wrap: anywhere;
        }
        .now-speakers,
        .now-empty {
          color: #b5cfbf;
          font-size: 13px;
          line-height: 1.45;
        }
        .now-progress {
          height: 3px;
          margin-top: auto;
          border-radius: 3px;
          background: #547960;
          overflow: hidden;
        }
        .now-progress span {
          display: block;
          height: 100%;
          background: var(--terminal-green);
          transition: width 300ms ease-out;
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip-path: inset(50%);
          white-space: nowrap;
        }
        .column-headings {
          display: none;
        }
        .timeline {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .time-group {
          padding: 20px 0;
          border-bottom: 1px solid var(--terminal-line);
        }
        .time-heading {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0 0 12px;
          font-size: 18px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .time-heading::after {
          content: '';
          height: 1px;
          background: var(--terminal-line);
          flex: 1;
        }
        .entries {
          display: grid;
          gap: 10px;
        }
        .entry {
          display: flex;
          flex-direction: column;
          min-width: 0;
          padding: 18px;
          border: 1px solid var(--terminal-line);
          border-radius: 12px;
          background: var(--terminal-panel);
          transition: border-color 150ms ease;
        }
        .entry:hover:not(.current):not(.open) {
          border-color: #3e5a84;
        }
        .entry.current {
          border-color: var(--terminal-green);
        }
        .entry.activity {
          background: #111f2c;
        }
        .entry.lunch {
          background: linear-gradient(115deg, #152b29, #132432);
          border-color: #426b5c;
        }
        .entry.lunch.current {
          border-color: var(--terminal-green);
        }
        .lunch-icons {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 10px;
          color: #9ed7c3;
        }
        .lunch-icons svg {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }
        .entry.opening {
          position: relative;
          background: #14283a;
          border-color: #526e91;
        }
        .activity-copy {
          margin: 4px 0 0;
          max-width: 60ch;
          color: #d0e0f4;
          font-size: 14px;
          line-height: 1.5;
        }
        .entry.networking {
          position: relative;
          overflow: hidden;
          padding-right: 112px;
          background: #1c1a32;
          border-color: #655583;
        }
        .party-copy {
          margin: 4px 0 0;
          color: #e4d6f5;
          font-size: 14px;
          line-height: 1.5;
        }
        .disco-ball {
          position: absolute;
          top: 9px;
          right: 17px;
          width: 76px;
          height: 90px;
          pointer-events: none;
        }
        .entry.open {
          border-style: dashed;
          background: transparent;
        }
        .meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 7px 12px;
          color: #c4d6ef;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.4;
        }
        .space {
          padding: 2px 7px;
          border: 1px solid #496384;
          border-radius: 4px;
          background: #1a2c46;
          color: #a9c8ff;
        }
        .classroom .space {
          border-color: #79565f;
          background: #382630;
          color: #f2bece;
        }
        .entry h3 {
          margin: 10px 0 7px;
          font-size: clamp(17px, 2vw, 20px);
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .entry-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }
        .entry-heading h3 {
          min-width: 0;
          flex: 1;
        }
        .entry-heading session-favorite {
          flex: 0 0 auto;
          margin-top: 4px;
        }
        .entry a {
          display: inline-block;
          min-height: 44px;
          color: var(--terminal-copy);
          text-decoration-color: #6b8bc2;
          text-underline-offset: 4px;
        }
        .entry a:hover {
          color: var(--terminal-green);
        }
        .speakers {
          display: grid;
          gap: 12px;
          margin: 14px 0 0;
          padding: 0;
          list-style: none;
        }
        .entry .speaker {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 48px;
          text-decoration: none;
        }
        .speaker-photo {
          width: 48px;
          height: 48px;
          flex: 0 0 48px;
          border-radius: 50%;
          object-fit: cover;
          background: #1b2c3b;
        }
        .speaker-details {
          min-width: 0;
          font-family: var(--default-font-family, sans-serif);
          line-height: 1.35;
        }
        .speaker-name {
          display: block;
          color: var(--terminal-copy);
          font-size: 14px;
          font-weight: 700;
        }
        .speaker-role {
          display: block;
          margin-top: 3px;
          color: var(--terminal-muted);
          font-size: 13px;
          overflow-wrap: anywhere;
        }
        .speaker:hover .speaker-name {
          color: var(--terminal-green);
        }
        .live {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--terminal-green);
          font-size: 13px;
          font-weight: 800;
        }
        .live::before {
          content: '';
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: currentColor;
        }
        .progress {
          height: 4px;
          flex-shrink: 0;
          margin-top: auto;
          transform: translateY(8px);
          overflow: hidden;
          border-radius: 4px;
          background: #547960;
        }
        .progress span {
          display: block;
          height: 100%;
          background: var(--terminal-green);
          transition: width 300ms ease-out;
        }
        .empty {
          margin: 28px 0;
          padding: 26px;
          border: 1px solid var(--terminal-line);
          border-radius: 12px;
          background: var(--terminal-panel);
        }
        .empty h2 {
          margin: 0 0 10px;
          font-size: 21px;
        }
        .empty p {
          margin: 0;
          color: var(--terminal-muted);
          line-height: 1.65;
        }
        .error {
          color: #ffd6d2;
        }
        @media (max-width: 479px) {
          .filters {
            width: 100%;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .saved-filter {
            width: 100%;
          }
        }
        @media (min-width: 480px) and (max-width: 759px), (min-width: 960px) {
          .panel .speakers {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 760px) {
          .agenda {
            padding: 48px 32px 112px;
          }
          .column-headings {
            position: sticky;
            top: 64px;
            z-index: 10;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            padding: 14px 0 10px;
            background: var(--terminal-background);
            border-bottom: 1px solid var(--terminal-line);
            color: var(--terminal-muted);
            font-size: 13px;
            font-weight: 700;
          }
          .column-headings span {
            padding: 0 18px;
          }
          .entries.all {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            align-items: stretch;
          }
          .entries.all .auditorium {
            grid-column: 1;
          }
          .entries.all .classroom {
            grid-column: 2;
          }
          .entries.all .both {
            grid-column: 1 / -1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .entry,
          .progress span,
          .now-progress span {
            transition: none;
          }
        }
      `,
    ];
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.unsubscribeFavorites = subscribeSessionFavorites(() => {
      this.favoritesRevision += 1;
    });
    document.addEventListener('visibilitychange', this.refreshClock);
    this.refreshClock();
    void this.load();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribeFavorites?.();
    this.unsubscribeFavorites = undefined;
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    document.removeEventListener('visibilitychange', this.refreshClock);
  }

  private async load(): Promise<void> {
    try {
      const [draftResponse, programmeResponse] = await Promise.all([
        fetch('/data/agenda-2026.json', { cache: 'no-store' }),
        fetch('/data/programme-2026.json', { cache: 'no-store' }),
      ]);
      if (!draftResponse.ok || !programmeResponse.ok) throw new Error('Agenda data unavailable');
      this.items = buildAgenda(
        (await draftResponse.json()) as DraftAgenda,
        (await programmeResponse.json()) as PreviewSource,
      );
      this.loadState = 'ready';
    } catch {
      this.loadState = 'error';
    }
  }

  private toggleSaved = (): void => {
    this.savedOnly = !this.savedOnly;
  };

  private renderSpeaker(speaker: AgendaSpeaker) {
    const role = [speaker.title, speaker.company].filter(Boolean).join(' · ');
    return html`<li>
      <a class="speaker" href=${`/speakers/${speaker.id}/`}>
        ${speaker.photoUrl ? html`<img class="speaker-photo" src=${speaker.photoUrl} alt="" width="48" height="48" loading="lazy" />` : nothing}
        <span class="speaker-details">
          <span class="speaker-name">${speaker.name}</span>
          ${role ? html`<span class="speaker-role">${role}</span>` : nothing}
        </span>
      </a>
    </li>`;
  }

  private renderNowSummary(items: AgendaItem[]) {
    const cards = items.length
      ? html`<div class="now-cards">${items.map((item) => this.renderNowItem(item))}</div>`
      : html`<div class="now-empty">No timed sessions right now.</div>`;
    return html`<section class="now-summary" aria-labelledby="now-heading">
      <h2 class="now-heading" id="now-heading">Happening now</h2>
      ${cards}
    </section>`;
  }

  private renderNowItem(item: AgendaItem) {
    const progress = progressAt(item, this.now) ?? 0;
    const content = html`
      <div class="now-meta">
        <span>${item.id === 'opening' ? 'Event' : spaces[item.space]}</span>
        <span>${item.start}–${item.end}</span>
      </div>
      <div class="now-title">${agendaTitle(item)}</div>
      ${item.speakers.length ? html`<div class="now-speakers">${item.speakers.map((speaker) => speaker.name).join(' · ')}</div>` : nothing}
      <div class="now-progress" aria-hidden="true"><span style="width: ${progress}%"></span></div>
    `;
    return item.href
      ? html`<a class="now-card" href=${item.href}>${content}</a>`
      : html`<div class="now-card">${content}</div>`;
  }

  private renderItem(item: AgendaItem) {
    const progress = item.kind === 'open' ? null : progressAt(item, this.now);
    const opening = item.id === 'opening';
    const registration = item.id === 'registration';
    const party = item.id === 'networking';
    const lunch = item.id === 'lunch';
    const title = agendaTitle(item);
    return html`
      <article
        class="entry ${item.space} ${item.kind} ${opening ? 'opening' : ''} ${registration ? 'registration' : ''} ${party ? 'networking' : ''} ${lunch ? 'lunch' : ''} ${progress !== null ? 'current' : ''}"
      >
        ${
          party
            ? html`<svg class="disco-ball" viewBox="0 0 80 96" aria-hidden="true" focusable="false">
                <defs>
                  <radialGradient id="disco-shine" cx="35%" cy="25%" r="75%">
                    <stop offset="0" stop-color="#fff" />
                    <stop offset=".4" stop-color="#c8d2e8" />
                    <stop offset="1" stop-color="#52617f" />
                  </radialGradient>
                  <clipPath id="disco-clip"><circle cx="40" cy="55" r="28" /></clipPath>
                </defs>
                <path d="M40 0v24" stroke="#cbd5e8" stroke-width="1.5" />
                <path d="M35 24h10v5H35z" fill="#aab9d1" />
                <circle cx="40" cy="55" r="28" fill="url(#disco-shine)" />
                <g
                  clip-path="url(#disco-clip)"
                  fill="none"
                  stroke="#64718b"
                  stroke-width="1.4"
                  opacity=".8"
                >
                  <path d="M12 42h56M10 51h60M10 60h60M12 69h56M17 77h46" />
                  <path
                    d="M40 27v56M29 28c-7 17-7 37 0 54M51 28c7 17 7 37 0 54M20 33c-7 15-7 29 0 44M60 33c7 15 7 29 0 44"
                  />
                </g>
                <g class="disco-sparkle" fill="#fff">
                  <path d="M61 20l2.2 5.8L69 28l-5.8 2.2L61 36l-2.2-5.8L53 28l5.8-2.2z" />
                  <path d="M13 52l1.4 3.6L18 57l-3.6 1.4L13 62l-1.4-3.6L8 57l3.6-1.4z" />
                </g>
              </svg>`
            : nothing
        }
        <div class="meta">
          ${!opening && !registration ? html`<span class="space">${spaces[item.space]}</span>` : nothing}
          <span>${item.end ? `${item.start}–${item.end}` : `From ${item.start}`}</span>
          <span>${kinds[item.kind]}</span>
          ${progress !== null ? html`<span class="live">Live now</span>` : nothing}
        </div>
        <div class="entry-heading">
          <h3>${item.href ? html`<a href=${item.href}>${title}</a>` : title}</h3>
          ${item.href ? html`<session-favorite session-id=${item.id} session-title=${item.title}></session-favorite>` : nothing}
        </div>
        ${registration ? html`<p class="activity-copy">Grab a coffee and a croissant, meet the community, and jump into the games.</p>` : nothing}
        ${opening ? html`<p class="activity-copy">Let’s kick off a day of ideas, community and inspiration.</p>` : nothing}
        ${
          lunch
            ? html`<p class="activity-copy">
                  Wraps and salad bowls for everyone. Grab a bite and recharge!
                </p>
                <div class="lunch-icons" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M4 11h16a8 8 0 0 1-16 0Z" />
                    <path d="M8 19h8" />
                    <path d="M9 7c0-1.5 1-2.5 1-4" />
                    <path d="M14 7c0-1.5 1-2.5 1-4" />
                  </svg>
                </div>`
            : nothing
        }
        ${party ? html`<p class="party-copy">Good people, good vibes, and a little 2000s sparkle. Planned until approximately 21:30.</p>` : nothing}
        ${
          item.speakers.length
            ? html`<ul class="speakers">
                ${item.speakers.map((speaker) => this.renderSpeaker(speaker))}
              </ul>`
            : nothing
        }
        ${progress !== null ? html`<div class="progress" role="progressbar" aria-label="${title}: time elapsed" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.floor(progress)} aria-valuetext="${Math.floor(progress)}% elapsed"><span style="width: ${progress}%"></span></div>` : nothing}
      </article>
    `;
  }

  override render() {
    if (
      this.groupedItems !== this.items ||
      this.groupedFilter !== this.filter ||
      this.groupedSavedOnly !== this.savedOnly ||
      this.groupedFavoritesRevision !== this.favoritesRevision
    ) {
      this.groupedItems = this.items;
      this.groupedFilter = this.filter;
      this.groupedSavedOnly = this.savedOnly;
      this.groupedFavoritesRevision = this.favoritesRevision;
      this.cachedGroups = groupAgenda(
        this.savedOnly
          ? this.items.filter((item) => item.href && isSessionFavorite(item.id))
          : this.items,
        this.filter,
      );
    }
    const groups = this.cachedGroups;
    const currentItems = this.items.filter(
      (item) =>
        item.kind !== 'open' &&
        (!this.savedOnly || (item.href && isSessionFavorite(item.id))) &&
        this.filter !== 'vibe' &&
        (this.filter === 'all' || item.space === 'both' || item.space === this.filter) &&
        progressAt(item, this.now) !== null,
    );
    return html`
      <section class="agenda" aria-labelledby="agenda-heading">
        <div class="intro">
          <div>
            <h1 id="agenda-heading">Your day, at a glance.</h1>
            <p>Find a session, move between spaces, and make time for the community.</p>
          </div>
          <div>
            <div class="date">Saturday, 21 November · Warsaw</div>
            <div class="date-note">16 sessions · Auditorium, Classroom &amp; Vibe Zone</div>
          </div>
        </div>
        <div class="filter-bar">
          <fieldset class="filters">
            <legend>Explore by space</legend>
            ${filters.map(
              ({ value, label }) =>
                html`<button
                  type="button"
                  aria-pressed=${this.filter === value ? 'true' : 'false'}
                  @click=${() => {
                    this.filter = value;
                  }}
                >
                  ${label}
                </button>`,
            )}
          </fieldset>
          <button
            class="saved-filter"
            type="button"
            aria-pressed=${this.savedOnly ? 'true' : 'false'}
            @click=${this.toggleSaved}
          >
            Saved sessions
          </button>
        </div>
        ${
          eventState(this.now) === 'during' && this.filter !== 'vibe' && this.loadState === 'ready'
            ? this.renderNowSummary(currentItems)
            : nothing
        }
        <span class="sr-only" role="status" aria-live="polite" aria-atomic="true"
          >${eventState(this.now) === 'during' && this.filter !== 'vibe' && this.loadState === 'ready' ? `Now: ${currentItems.length ? currentItems.map(agendaTitle).join(', ') : 'No timed sessions right now'}` : ''}</span
        >
        ${this.loadState === 'loading' ? html`<p role="status">Loading the agenda…</p>` : nothing}
        ${this.loadState === 'error' ? html`<p class="error" role="alert">The agenda could not be loaded. Reload the page to try again.</p>` : nothing}
        ${
          this.loadState === 'ready' && this.filter === 'vibe'
            ? html`<section class="empty">
                <h2>Vibe Zone</h2>
                <p>
                  Open all day (09:00–19:15) — community booths, games, Pin Hunt &amp; networking.
                </p>
              </section>`
            : nothing
        }
        ${
          this.loadState === 'ready' && this.filter !== 'vibe' && this.savedOnly && !groups.length
            ? html`<section class="empty">
                <h2>No saved sessions here yet</h2>
                <p>Choose a heart on a session to add it to your saved list.</p>
              </section>`
            : nothing
        }
        ${
          this.loadState === 'ready' && this.filter !== 'vibe' && groups.length
            ? html`
                ${this.filter === 'all' ? html`<div class="column-headings" aria-hidden="true"><span>Auditorium</span><span>Classroom</span></div>` : nothing}
                <ol class="timeline">
                  ${groups.map(
                    (group) =>
                      html`<li class="time-group">
                        <h2 class="time-heading">
                          <time datetime="2026-11-21T${group.start}:00+01:00">${group.start}</time>
                        </h2>
                        <div class="entries ${this.filter}">
                          ${group.items.map((item) => this.renderItem(item))}
                        </div>
                      </li>`,
                  )}
                </ol>
              `
            : nothing
        }
      </section>
    `;
  }
}
