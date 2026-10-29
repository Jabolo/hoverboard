/**
 * THESIS: A searchable reading shelf for confirmed talks, never a timetable.
 * OWN-WORLD: Inherit DevFest's dark terminal surfaces, blue focus and green links.
 * STORY: Choose an interest, scan real abstracts and people, then open a session.
 * FIRST VIEWPORT: Sessions heading, playful invitation, search and topic controls;
 * a compact result count introduces a generous single-column editorial list.
 * FOOTPRINT: Client-only discovery over the existing generated programme store.
 */
import { Failure, Initialized, Pending, Success } from '@abraham/remotedata';
import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ThemedElement } from '../components/themed-element';
import '../components/hero/hero-block';
import '../elements/footer-block';
import { RootState, store } from '../store';
import { ReduxMixin } from '../store/mixin';
import { fetchSessions } from '../store/sessions/actions';
import { initialSessionsState } from '../store/sessions/state';
import { fetchSpeakers } from '../store/speakers/actions';
import { initialSpeakersState } from '../store/speakers/state';
import { updateMetadata } from '../utils/metadata';
import {
  buildSessionDiscovery,
  discoveryUrl,
  filterSessionDiscovery,
  surpriseSession,
} from '../utils/session-discovery';
import type { SessionDiscoveryItem } from '../utils/session-discovery';
import { Router } from '@vaadin/router';

@customElement('sessions-page')
export class SessionsPage extends ReduxMixin(ThemedElement) {
  @state() private sessions = initialSessionsState;
  @state() private speakers = initialSpeakersState;
  @state() private query = new URLSearchParams(window.location.search).get('q') || '';
  @state() private topic = new URLSearchParams(window.location.search).get('topic') || '';

  static override get styles() {
    return [
      ...super.styles,
      css`
        :host {
          background: var(--primary-background-color);
          color: var(--primary-text-color);
        }
        .explorer {
          max-width: 1040px;
          margin: 0 auto;
          padding: 40px 24px 72px;
        }
        .intro {
          max-width: 65ch;
          margin: 0 0 32px;
        }
        h2 {
          margin: 0 0 12px;
          font-size: clamp(26px, 4vw, 36px);
          line-height: 1.25;
        }
        .intro p,
        .status {
          color: var(--terminal-muted);
          line-height: 1.65;
        }
        .intro p {
          margin: 0;
        }
        .search-label {
          display: block;
          margin-bottom: 10px;
          font-weight: 600;
        }
        .search-row {
          display: flex;
          align-items: stretch;
          flex-wrap: wrap;
          gap: 12px;
        }
        input {
          flex: 1 1 360px;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          min-height: 52px;
          border: 1px solid var(--terminal-line);
          border-radius: 12px;
          background: var(--terminal-panel);
          color: var(--terminal-copy);
          padding: 12px 16px;
          font: inherit;
          font-size: 16px;
        }
        input::placeholder {
          color: var(--terminal-muted);
          opacity: 1;
        }
        button {
          min-height: 44px;
          border: 1px solid var(--terminal-line);
          border-radius: 12px;
          padding: 10px 16px;
          font: inherit;
          font-weight: 600;
          color: var(--terminal-copy);
          background: var(--terminal-panel);
          cursor: pointer;
        }
        button:hover,
        .session-title a:hover {
          color: var(--terminal-green);
          border-color: var(--terminal-green);
        }
        button:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .surprise {
          border-color: var(--terminal-green);
          color: var(--terminal-green);
        }
        a:focus-visible,
        button:focus-visible,
        input:focus-visible {
          outline: 2px solid var(--terminal-blue);
          outline-offset: 4px;
        }
        .topics {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 20px 0 0;
          padding: 0;
          border: 0;
        }
        .topics legend {
          padding: 0 0 10px;
          color: var(--terminal-muted);
          font-size: 14px;
        }
        .topics button {
          font-size: 14px;
        }
        .topics button[aria-pressed='true'] {
          color: var(--terminal-background);
          background: var(--terminal-green);
          border-color: var(--terminal-green);
        }
        .results-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 28px 0 8px;
        }
        .results-count {
          color: var(--terminal-muted);
          margin: 0;
          line-height: 1.6;
        }
        .reset {
          background: transparent;
        }
        .session-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 16px;
        }
        .session-item {
          background: var(--terminal-panel);
          border: 1px solid var(--terminal-line);
          border-radius: 16px;
          padding: 28px 32px;
        }
        .session-title {
          max-width: 45ch;
          margin: 10px 0 12px;
          font-size: clamp(21px, 3vw, 28px);
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .session-title a {
          color: var(--terminal-copy);
          text-decoration: none;
        }
        .session-title a:hover {
          text-decoration: underline;
          text-underline-offset: 5px;
        }
        .session-topics {
          color: var(--terminal-green);
          font-size: 13px;
          line-height: 1.6;
        }
        .excerpt {
          margin: 0;
          max-width: 68ch;
          color: var(--terminal-muted);
          font-size: 16px;
          line-height: 1.75;
        }
        .people {
          list-style: none;
          display: flex;
          flex-wrap: wrap;
          gap: 12px 24px;
          margin: 24px 0 12px;
          padding: 0;
        }
        .people a {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          min-height: 44px;
          padding: 4px 0;
          color: var(--terminal-copy);
          text-decoration: none;
          font-size: 14px;
          line-height: 1.5;
        }
        .portrait {
          position: relative;
          display: grid;
          place-items: center;
          flex: 0 0 56px;
          width: 56px;
          height: 56px;
          overflow: hidden;
          border-radius: 50%;
          background: var(--terminal-panel);
          color: var(--terminal-copy);
          font-weight: 600;
        }
        .portrait img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .person-details {
          display: flex;
          flex-direction: column;
        }
        .person-name {
          font-weight: 600;
        }
        .people a:hover .person-name {
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .company {
          color: var(--terminal-muted);
          font-size: 13px;
        }
        .read-session {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          color: var(--terminal-green);
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
        }
        .read-session:hover {
          text-decoration: underline;
          text-underline-offset: 4px;
        }
        .empty {
          margin: 40px 0;
          padding: 24px;
          background: var(--terminal-panel);
          border-radius: 12px;
        }
        .empty h3 {
          margin: 0 0 8px;
        }
        .empty p {
          max-width: 65ch;
          line-height: 1.65;
          color: var(--terminal-muted);
        }
        @media (max-width: 480px) {
          .explorer {
            padding: 32px 20px 56px;
          }
          .search-row input {
            flex-basis: 100%;
          }
          .session-item {
            padding: 24px 20px;
          }
        }
      `,
    ];
  }

  override connectedCallback() {
    super.connectedCallback();
    updateMetadata(
      'Sessions',
      'Explore confirmed DevFest Warsaw 2026 sessions by topic, speaker or company. Timetable coming later.',
    );
    if (this.sessions instanceof Initialized) store.dispatch(fetchSessions);
    if (this.speakers instanceof Initialized) store.dispatch(fetchSpeakers);
    window.addEventListener('popstate', this.readUrl);
    window.addEventListener('vaadin-router-location-changed', this.routeChanged);
    this.readUrl();
  }

  override disconnectedCallback() {
    window.removeEventListener('popstate', this.readUrl);
    window.removeEventListener('vaadin-router-location-changed', this.routeChanged);
    super.disconnectedCallback();
  }

  override stateChanged(state: RootState) {
    this.sessions = state.sessions;
    this.speakers = state.speakers;
  }

  private routeChanged = () => {
    if (/^\/sessions\/?$/.test(window.location.pathname)) this.readUrl();
  };

  private readUrl = () => {
    const params = new URLSearchParams(window.location.search);
    this.query = params.get('q') || '';
    this.topic = params.get('topic') || '';
  };

  private updateUrl() {
    const next = discoveryUrl(window.location.search, this.query, this.topic);
    if (`${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState(window.history.state, '', `${next}${window.location.hash}`);
    }
  }

  private search(event: Event) {
    this.query = (event.target as HTMLInputElement).value;
    this.updateUrl();
  }

  private chooseTopic(topic: string) {
    this.topic = topic;
    this.updateUrl();
  }

  private reset() {
    this.query = '';
    this.topic = '';
    this.updateUrl();
    this.renderRoot.querySelector<HTMLInputElement>('#session-search')?.focus();
  }

  private openSurprise(items: SessionDiscoveryItem[]) {
    const chosen = surpriseSession(items);
    if (chosen) Router.go(chosen.href);
  }

  private sessionItem(session: SessionDiscoveryItem) {
    return html`<li class="session-item" data-session-id=${session.id}>
      <article aria-labelledby=${`session-${session.id}`}>
        <div class="session-topics">${session.topics.join(' · ')}</div>
        <h3 class="session-title" id=${`session-${session.id}`}>
          <a href=${session.href}>${session.title}</a>
        </h3>
        <p class="excerpt">${session.excerpt}</p>
        <ul class="people" aria-label="Session speakers">
          ${session.people.map(
            (person) =>
              html`<li>
                <a href=${person.href}>
                  <span class="portrait" aria-hidden="true">
                    ${person.name
                      .trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join('')
                      .toLocaleUpperCase()}
                    ${person.photoUrl ? html`<img src=${person.photoUrl} alt="" loading="lazy" decoding="async" @error=${(event: Event) => ((event.currentTarget as HTMLImageElement).hidden = true)} />` : nothing}
                  </span>
                  <span class="person-details">
                    <span class="person-name">${person.name}</span>
                    ${person.company ? html`<span class="company">${person.company}</span>` : nothing}
                  </span>
                </a>
              </li>`,
          )}
        </ul>
        <a class="read-session" href=${session.href} aria-label=${`Read ${session.title}`}
          >Read the session <span aria-hidden="true">&nbsp;→</span></a
        >
      </article>
    </li>`;
  }

  override render() {
    const items = buildSessionDiscovery(
      this.sessions instanceof Success ? this.sessions.data : [],
      this.speakers instanceof Success ? this.speakers.data : [],
    );
    const filtered = filterSessionDiscovery(items, this.query, this.topic);
    const topics = [...new Set(items.flatMap((item) => item.topics))].sort((a, b) =>
      a.localeCompare(b),
    );
    const loading = this.sessions instanceof Initialized || this.sessions instanceof Pending;
    const failed = this.sessions instanceof Failure;
    const filteredState = Boolean(this.query || this.topic);
    return html` <hero-block
        background-color="var(--terminal-background)"
        font-color="var(--terminal-copy)"
      >
        <div class="hero-command">&gt; sessions --explore</div>
        <h1 class="hero-title">Sessions</h1>
      </hero-block>
      <section class="explorer" aria-label="Session explorer">
        <div class="intro">
          <h2>Pick your rabbit hole.</h2>
          <p>
            Confirmed sessions. Timetable coming later.<br />Find your next idea by topic, speaker
            or company.
          </p>
        </div>
        <label class="search-label" for="session-search">What are you curious about?</label>
        <div class="search-row">
          <input
            id="session-search"
            type="search"
            autocomplete="off"
            placeholder="Try Gemini, Flutter, a speaker or a company…"
            .value=${this.query}
            @input=${(event: Event) => this.search(event)}
            aria-controls="session-results"
          /><button
            class="surprise"
            @click=${() => this.openSurprise(filtered)}
            ?disabled=${!filtered.length}
          >
            Surprise me <span aria-hidden="true">↗</span>
          </button>
        </div>
        <fieldset class="topics">
          <legend>Explore a topic</legend>
          <button
            type="button"
            aria-pressed=${String(!this.topic)}
            @click=${() => this.chooseTopic('')}
          >
            All topics</button
          >${topics.map((topic) => html`<button type="button" aria-pressed=${String(this.topic === topic)} @click=${() => this.chooseTopic(topic)}>${topic}</button>`)}
        </fieldset>
        <div class="results-bar">
          <p class="results-count" role="status" aria-live="polite">
            ${loading ? 'Loading confirmed sessions…' : failed ? 'Sessions could not be loaded.' : `${filtered.length} of ${items.length} confirmed sessions${this.topic ? ` · ${this.topic}` : ''}`}
          </p>
          ${filteredState ? html`<button class="reset" @click=${() => this.reset()}>Reset filters</button>` : nothing}
        </div>
        ${
          failed
            ? html`<div class="empty" role="alert">
                <h3>The sessions took a wrong turn.</h3>
                <p>
                  We couldn’t load the confirmed programme. Please reload this page to try again.
                </p>
                <button @click=${() => window.location.reload()}>Reload sessions</button>
              </div>`
            : nothing
        }
        ${
          !loading && !failed && !filtered.length
            ? html`<div class="empty">
                <h3>
                  ${items.length ? 'No sessions down this rabbit hole.' : 'Session details are on their way.'}
                </h3>
                <p>
                  ${items.length ? 'Try another topic, a shorter search or a speaker’s name.' : 'The confirmed programme could not be displayed. Please check back shortly.'}
                </p>
                ${filteredState ? html`<button @click=${() => this.reset()}>Show all sessions</button>` : nothing}
              </div>`
            : nothing
        }
        <ul
          class="session-list"
          id="session-results"
          aria-label="Confirmed sessions"
          aria-busy=${String(loading)}
        >
          ${filtered.map((item) => this.sessionItem(item))}
        </ul>
      </section>
      <footer-block></footer-block>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sessions-page': SessionsPage;
  }
}
