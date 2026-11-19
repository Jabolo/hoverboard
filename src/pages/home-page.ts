import { Success } from '@abraham/remotedata';
import { computed, customElement, property, query } from '@polymer/decorators';
import '@polymer/iron-icon';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import { html, PolymerElement } from '@polymer/polymer';
import '../components/event-countdown';
import '../components/google-developers-brand';
import '../components/hero/hero-block';
import { HeroBlock } from '../components/hero/hero-block';
import { firebaseApp } from '../firebase';
import { RootState, store } from '../store';
import { ReduxMixin } from '../store/mixin';
import { queueSnackbar } from '../store/snackbars';
import { openVideoDialog } from '../store/ui/actions';
import {
  aboutBlock,
  buyTicket,
  eventDate,
  description,
  eveneaEmbed,
  heroSettings,
  showForkMeBlockForProjectIds,
  title,
  ticketingPreview,
  viewHighlights,
} from '../utils/data';
import '../utils/icons';
import { INCLUDE_SITE_TITLE, updateMetadata } from '../utils/metadata';
import { POSITION, scrollToElement } from '../utils/scrolling';
import { initialTicketsState, TicketsState } from '../store/tickets/state';
import { getProgrammeSummary, loadPublishedProgramme } from '../utils/published-programme';

// Let the browser paint the hero before loading the remaining page sections.
// Loading begins on the next frame rather than waiting for a scroll, so deep
// links and keyboard navigation continue to find the full page promptly.
let sectionsLoading: Promise<unknown> | undefined;
function loadHomeSections() {
  sectionsLoading ??= Promise.all([
    import('../components/about-block'),
    import('../elements/about-organizer-block'),
    import('../elements/attendee-photos-block'),
    import('../elements/cloud-credit-block'),
    import('../elements/linkedin-updates-block'),
    import('../elements/schedule-block'),
    import('../elements/visit-block'),
    import('../elements/footer-block'),
    import('../elements/map-block'),
    import('../elements/partners-block'),
    import('../elements/past-devfests-block'),
    import('../elements/previous-speakers-block'),
    import('../elements/speakers-block'),
    import('../elements/subscribe-block'),
    import('../elements/tickets-block'),
  ]).catch((error: unknown) => {
    sectionsLoading = undefined;
    console.error('Unable to load home page sections:', error);
  });
  return sectionsLoading;
}

@customElement('home-page')
export class HomePage extends ReduxMixin(PolymerElement) {
  static get template() {
    return html`
      <style include="shared-styles flex flex-alignment">
        :host {
          display: block;
          height: 100%;
        }

        hero-block {
          font-size: 24px;
          text-align: center;
        }

        linkedin-updates-block,
        previous-speakers-block,
        past-devfests-block,
        about-organizer-block,
        map-block,
        visit-block {
          content-visibility: auto;
          contain-intrinsic-size: auto 600px;
        }

        .home-content {
          width: min(100%, 980px);
          padding: 24px 20px 52px;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .home-grid {
          display: grid;
          width: 100%;
          gap: 28px;
          align-items: center;
        }

        .home-intro {
          min-width: 0;
        }

        .brand-lockup {
          width: min(100%, 560px);
          margin: 0;
          padding: 0;
          background: transparent;
        }

        .devfest-lockup {
          display: block;
          width: 100%;
          height: auto;
        }

        .hero-community {
          margin-top: 16px;
          --google-developers-brand-width: 170px;
        }

        .event-details {
          display: grid;
          gap: 8px;
          margin: 30px 0 0;
          text-align: left;
        }

        .event-date {
          color: var(--terminal-green);
          font-family: var(--font-mono);
          font-size: clamp(20px, 3vw, 28px);
          font-weight: 800;
          letter-spacing: 0.02em;
        }

        .event-location {
          color: var(--terminal-muted);
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .event-description {
          max-width: 38ch;
          margin: 4px 0 0;
          color: var(--terminal-copy);
          font-family: var(--font-mono);
          font-size: 18px;
          line-height: 1.45;
        }

        .action-buttons {
          margin: 0 -8px;
          font-size: 14px;
        }

        .action-buttons md-filled-button,
        .action-buttons md-outlined-button {
          min-height: 48px;
          margin: 8px;
          border-radius: 4px;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .action-buttons md-filled-button {
          --md-filled-button-container-color: var(--google-blue-strong);
          --md-filled-button-hover-container-color: var(--google-blue);
          --md-filled-button-label-text-color: #fff;
          --md-filled-button-hover-label-text-color: #fff;
          --md-filled-button-icon-color: #fff;
        }

        .action-buttons .watch-video {
          color: #fff;
          --md-outlined-button-label-text-color: #fff;
          --md-outlined-button-hover-label-text-color: #fff;
          --md-outlined-button-outline-color: #fff;
        }

        .action-buttons iron-icon {
          --iron-icon-fill-color: currentColor;
          margin-right: 8px;
        }

        .scroll-down {
          margin-top: 14px;
          color: currentColor;
          user-select: none;
          border: 0;
          padding: 10px;
          min-width: 44px;
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          font: inherit;
          cursor: pointer;
        }

        .scroll-down svg {
          width: 24px;
          opacity: 0.6;
        }

        .scroll-down .stroke {
          stroke: currentColor;
        }

        .scroll-down .scroller {
          fill: currentColor;
          animation: updown 2s infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .scroll-down .scroller {
            animation: none;
          }
        }

        @keyframes updown {
          0% {
            transform: translate(0, 0);
          }
          50% {
            transform: translate(0, 5px);
          }
          100% {
            transform: translate(0, 0);
          }
        }

        .terminal-column {
          display: grid;
          width: 100%;
          max-width: 520px;
          gap: 12px;
        }

        .terminal-window {
          overflow: hidden;
          border: 1px solid var(--terminal-line);
          border-radius: 10px;
          background: rgb(10 21 37 / 92%);
          box-shadow: 0 20px 48px rgb(0 0 0 / 28%);
          text-align: left;
        }

        .terminal-bar {
          display: flex;
          align-items: center;
          gap: 7px;
          min-height: 42px;
          padding: 0 14px;
          border-bottom: 1px solid var(--terminal-line);
        }

        .terminal-bar i {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--google-red);
        }

        .terminal-bar i:nth-child(2) {
          background: var(--google-yellow);
        }

        .terminal-bar i:nth-child(3) {
          background: var(--google-green);
        }

        .terminal-bar span {
          margin-left: 6px;
          color: var(--terminal-muted);
          font-family: var(--font-mono);
          font-size: 11px;
        }

        .terminal-body {
          padding: 18px 16px;
          color: var(--terminal-copy);
          font-family: var(--font-mono);
          font-size: 12px;
          line-height: 1.65;
        }

        .terminal-line {
          display: grid;
          grid-template-columns: 16px 1fr;
          gap: 6px;
        }

        .terminal-line + .terminal-line {
          margin-top: 8px;
        }

        .terminal-line .prompt {
          color: var(--terminal-green);
        }

        .terminal-line .key {
          color: var(--terminal-muted);
        }

        .terminal-line .value {
          color: var(--terminal-copy);
        }

        .terminal-line .green {
          color: var(--terminal-green);
        }

        .terminal-line .blue {
          color: #8cb5ff;
        }

        .terminal-body hr {
          margin: 14px 0;
          border: 0;
          border-top: 1px dashed var(--terminal-line);
        }

        .terminal-command {
          display: flex;
          align-items: center;
          min-height: 48px;
          padding: 0 12px;
          border: 1px solid rgb(126 242 165 / 36%);
          border-radius: 6px;
          background: rgb(126 242 165 / 8%);
          color: var(--terminal-green);
          font-family: var(--font-mono);
          font-size: 11px;
        }

        .terminal-command {
          text-decoration: none;
          font-weight: 700;
        }

        .terminal-command:hover {
          background: rgb(126 242 165 / 15%);
        }

        .terminal-command:focus-visible {
          outline: 2px solid var(--terminal-green);
          outline-offset: 4px;
        }

        @media (min-height: 500px) {
          hero-block {
            height: calc(100vh + 57px);
            max-height: calc(100vh + 1px);
          }

          .home-content {
            margin-top: -48px;
          }

          .scroll-down {
            position: absolute;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 2;
          }
        }

        @media (max-width: 811px) {
          hero-block {
            height: auto;
            min-height: 0;
            max-height: none;
          }

          .home-content {
            margin-top: 0;
            padding-top: 24px;
          }

          .scroll-down {
            position: static;
            transform: none;
          }
        }

        @media (min-width: 812px) {
          hero-block {
            height: calc(100vh + 65px);
          }

          .home-grid {
            grid-template-columns: minmax(0, 1fr) minmax(320px, 0.72fr);
            gap: clamp(28px, 5vw, 72px);
            text-align: left;
          }

          .home-intro {
            align-items: flex-start;
            text-align: left;
          }

          .terminal-column {
            justify-self: end;
          }
        }

        /* An event-day companion: useful links before the long-form story. */
        hero-block {
          height: auto;
          min-height: 0;
        }
        .home-content {
          width: min(100%, 1100px);
          padding: 10px 0 42px;
        }
        .home-grid {
          gap: 36px;
          align-items: end;
          text-align: left;
        }
        .home-intro {
          align-items: flex-start;
          text-align: left;
        }
        .brand-lockup {
          width: min(100%, 340px);
        }
        .hero-community {
          margin-top: 12px;
          --google-developers-brand-width: 145px;
        }
        .companion-heading {
          margin: 24px 0 0;
          max-width: 12ch;
          color: #fff;
          font-family: var(--font-family);
          font-size: clamp(42px, 7vw, 76px);
          font-weight: 800;
          letter-spacing: -0.035em;
          line-height: 1.02;
        }
        .event-details {
          margin-top: 16px;
          gap: 8px;
        }
        .event-date {
          font-size: 18px;
          letter-spacing: 0;
        }
        .event-location {
          color: var(--terminal-copy);
          font-size: 14px;
          letter-spacing: 0;
          text-transform: none;
        }
        .event-description {
          max-width: 42ch;
          font-family: var(--font-family);
          font-size: 17px;
        }
        .action-buttons {
          justify-content: flex-start;
          margin: 16px -8px 0;
        }
        .action-buttons md-filled-button,
        .action-buttons md-outlined-button {
          font-family: var(--font-family);
          font-size: 15px;
          letter-spacing: 0;
          text-transform: none;
        }
        .companion-links {
          width: 100%;
          display: grid;
          gap: 0;
          border-top: 1px solid #526783;
        }
        .companion-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          min-height: 52px;
          padding: 0 4px;
          border-bottom: 1px solid #526783;
          color: #fff;
          text-align: left;
          text-decoration: none;
          font-family: var(--font-family);
          font-size: 17px;
          font-weight: 700;
        }
        .companion-link:hover {
          color: var(--terminal-green);
        }
        button.companion-link {
          width: 100%;
          background: transparent;
          border: 0;
          border-bottom: 1px solid #526783;
          cursor: pointer;
        }
        .companion-link:focus-visible {
          outline: 2px solid #8ab4f8;
          outline-offset: 3px;
        }
        .companion-link svg {
          width: 22px;
          height: 22px;
          flex: none;
          stroke: currentColor;
          fill: none;
          stroke-width: 2;
        }
        @media (min-width: 812px) {
          hero-block {
            height: auto;
          }
          .home-content {
            padding: 12px 0 48px;
          }
          .home-grid {
            grid-template-columns: minmax(0, 1fr) minmax(250px, 0.52fr);
            gap: clamp(36px, 8vw, 110px);
          }
          .companion-links {
            margin-bottom: 16px;
          }
        }
      </style>

      <hero-block
        id="hero"
        background-image="[[heroSettings.background.image]]"
        background-color="[[heroSettings.background.color]]"
        font-color="[[heroSettings.fontColor]]"
        hide-logo
      >
        <div class="home-content" layout vertical center>
          <div class="home-grid">
            <div class="home-intro" layout vertical>
              <div class="brand-lockup">
                <img
                  class="devfest-lockup"
                  src="/images/logos/devfest-2026-wordmark-dark.svg"
                  alt="DevFest 2026"
                />
              </div>
              <google-developers-brand class="hero-community"></google-developers-brand>
              <h1 class="companion-heading">Your day at DevFest.</h1>
              <div class="event-details">
                <div class="event-date">[[eventDate]]</div>
                <div class="event-location">Google for Startups Campus · Warsaw</div>
                <p class="event-description">
                  Talks, workshops and conversations. Find what you need for the day.
                </p>
              </div>
              <div class="action-buttons" layout horizontal wrap>
                <md-filled-button href="/schedule/">View programme</md-filled-button>
                <md-outlined-button on-click="scrollToTickets"
                  >[[ticketActionLabel]]</md-outlined-button
                >
                <template is="dom-if" if="[[hasHighlights]]">
                  <md-outlined-button class="watch-video" on-click="playVideo"
                    >[[viewHighlights]]</md-outlined-button
                  >
                </template>
              </div>
            </div>
            <nav class="companion-links" aria-label="Event essentials">
              <a class="companion-link" href="/sessions/">
                <span>Speakers &amp; sessions</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </a>
              <a
                class="companion-link"
                href="https://www.google.com/maps/dir/?api=1&amp;destination=Plac%20Konesera%2010%2C%2003-736%20Warszawa"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>Directions to the venue</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M7 6h11v11" /></svg>
              </a>
              <a
                class="companion-link"
                href="https://photos.app.goo.gl/QbodNU6v6xyAS9J7"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>Community photo album</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M7 6h11v11" /></svg>
              </a>
              <button class="companion-link" type="button" on-click="scrollToVisit">
                <span>Practical information</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </nav>
          </div>
        </div>
      </hero-block>
      <schedule-block></schedule-block>
      <visit-block id="visit" style="scroll-margin-top: 80px;"></visit-block>
      <attendee-photos-block id="photos" style="scroll-margin-top: 80px;"></attendee-photos-block>
      <cloud-credit-block></cloud-credit-block>
      <speakers-block id="speakers" style="scroll-margin-top: 80px;"></speakers-block>
      <template is="dom-if" if="{{showForkMeBlock}}">
        <fork-me-block></fork-me-block>
      </template>
      <about-block></about-block>
      <div id="tickets" style="scroll-margin-top: 80px;"></div>
      <tickets-block id="registration"></tickets-block>
      <partners-block id="partners" style="scroll-margin-top: 80px;"></partners-block>
      <linkedin-updates-block></linkedin-updates-block>
      <subscribe-block></subscribe-block>
      <previous-speakers-block></previous-speakers-block>
      <past-devfests-block></past-devfests-block>
      <about-organizer-block></about-organizer-block>
      <map-block></map-block>
      <footer-block></footer-block>
    `;
  }

  @property({ type: String })
  private programmeSummary = 'Loading programme…';

  private siteTitle = title;
  private eventDate = eventDate;
  private viewHighlights = viewHighlights;
  private buyTicket = buyTicket;
  private heroSettings = heroSettings.home;
  private aboutBlock = aboutBlock;
  @property({ type: Boolean })
  private hasHighlights = Boolean(aboutBlock.callToAction.howItWas.youtubeId);
  private ticketingPreview = ticketingPreview;

  @property({ type: Object })
  tickets: TicketsState = initialTicketsState;

  @computed('tickets')
  private get hasAvailableTickets() {
    return this.tickets instanceof Success && this.tickets.data.some((ticket) => ticket.available);
  }

  @computed('tickets')
  private get ticketActionLabel() {
    if (eveneaEmbed.requiresAccessCode) {
      return this.ticketingPreview;
    }
    return this.hasAvailableTickets ? this.buyTicket : this.ticketingPreview;
  }

  @query('#hero')
  hero!: HeroBlock;

  @property({ type: Boolean })
  private showForkMeBlock: boolean = false;

  override stateChanged(state: RootState) {
    this.tickets = state.tickets;
  }

  private playVideo() {
    openVideoDialog({
      title: this.aboutBlock.callToAction.howItWas.label,
      youtubeId: this.aboutBlock.callToAction.howItWas.youtubeId,
    });
  }

  private scrollToTickets() {
    void loadHomeSections().then(() => {
      requestAnimationFrame(() => {
        const element = (this.$['registration'] || this.shadowRoot?.querySelector('#tickets')) as
          HTMLElement | undefined;
        if (element) {
          scrollToElement(element);
        } else {
          store.dispatch(queueSnackbar('Error scrolling to section.'));
        }
      });
    });
  }

  private scrollToVisit() {
    void loadHomeSections().then(() => {
      const visit = this.shadowRoot?.querySelector<HTMLElement>('#visit');
      if (visit) scrollToElement(visit);
    });
  }

  private scrollNextBlock() {
    scrollToElement(this.hero, POSITION.BOTTOM);
  }

  private shouldShowForkMeBlock(): boolean {
    const showForkMeBlock = firebaseApp.options.appId
      ? (showForkMeBlockForProjectIds as string[]).includes(firebaseApp.options.appId)
      : false;
    if (showForkMeBlock) {
      import('../elements/fork-me-block');
    }
    return showForkMeBlock;
  }

  override connectedCallback() {
    super.connectedCallback();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => void loadHomeSections());
    });
    updateMetadata(title, description, INCLUDE_SITE_TITLE.NO);
    this.showForkMeBlock = this.shouldShowForkMeBlock();
    void loadPublishedProgramme().then(
      (programme) => {
        this.programmeSummary = getProgrammeSummary(programme);
      },
      () => {
        this.programmeSummary = 'Programme unavailable';
      },
    );
    this.checkHashAndScroll();
    window.addEventListener('hashchange', this.onHashChange);
    window.addEventListener('click', this.onPartnerLinkClick);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.onHashChange);
    window.removeEventListener('click', this.onPartnerLinkClick);
  }

  private onHashChange = () => {
    this.checkHashAndScroll();
  };

  private onPartnerLinkClick = (event: MouseEvent) => {
    // A repeated click on the same fragment does not emit hashchange. The
    // target is inside a shadow root, so native fragment scrolling cannot help.
    if (
      event
        .composedPath()
        .some(
          (node) => node instanceof HTMLAnchorElement && node.getAttribute('href') === '/#partners',
        )
    ) {
      this.checkHashAndScroll();
    }
  };

  private checkHashAndScroll() {
    if (window.location.hash === '#partners') {
      void loadHomeSections().then(() => {
        requestAnimationFrame(() => {
          const partners = this.shadowRoot?.querySelector<HTMLElement>('#partners');
          if (partners) scrollToElement(partners);
        });
      });
    }
    if (window.location.hash === '#tickets' || window.location.hash === '#registration') {
      window.setTimeout(() => this.scrollToTickets(), 50);
    }
  }
}
