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
import { huntSiteLinks } from '../hunt/site-links';
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

        .terminal-command + .terminal-command {
          margin-top: 8px;
        }

        .y2k-activities {
          padding: 40px 24px;
          color: var(--terminal-copy, var(--primary-text-color));
          background: var(--terminal-panel, var(--secondary-background-color));
        }

        .y2k-inner {
          max-width: 980px;
          margin: 0 auto;
        }

        .y2k-inner h2 {
          margin: 0;
          font-family: var(--font-mono, monospace);
          font-size: clamp(24px, 5vw, 36px);
        }

        .y2k-inner p {
          margin: 12px 0 20px;
        }

        .y2k-links {
          display: flex;
          gap: 8px 12px;
          flex-wrap: wrap;
        }

        .y2k-link {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          padding: 0 12px;
          border: 1px solid var(--terminal-muted, var(--divider-color));
          border-radius: 4px;
          color: inherit;
          font-weight: 700;
          text-decoration: none;
        }

        .y2k-link-primary {
          background: var(--google-blue-strong);
          border-color: var(--google-blue-strong);
          color: #fff;
        }

        .y2k-link:hover {
          text-decoration: underline;
        }

        .y2k-link:focus-visible {
          outline: 2px solid var(--google-blue);
          outline-offset: 3px;
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
      </style>

      <hero-block
        id="hero"
        background-image="[[heroSettings.background.image]]"
        background-color="[[heroSettings.background.color]]"
        font-color="[[heroSettings.fontColor]]"
        hide-logo
      >
        <div class="home-content" layout vertical center>
          <h1 class="sr-only">[[siteTitle]]</h1>
          <div class="home-grid">
            <div class="home-intro" layout vertical center>
              <div class="hero-command">&gt; devfest.init</div>
              <div class="brand-lockup">
                <img
                  class="devfest-lockup"
                  src="/images/logos/devfest-2026-wordmark-dark.svg"
                  alt="DevFest 2026"
                />
              </div>

              <google-developers-brand class="hero-community"></google-developers-brand>

              <div class="event-details">
                <div class="event-date">[[eventDate]]</div>
                <div class="event-location">Google for Startups Campus / Warsaw</div>
                <p class="event-description">[[heroSettings.description]]</p>
              </div>

              <event-countdown></event-countdown>

              <div class="action-buttons" layout horizontal center-justified wrap>
                <template is="dom-if" if="[[hasHighlights]]">
                  <md-outlined-button class="watch-video" on-click="playVideo">
                    <iron-icon icon="hoverboard:movie" slot="icon"></iron-icon>
                    [[viewHighlights]]
                  </md-outlined-button>
                </template>
                <md-outlined-button href="/sessions/">Explore sessions</md-outlined-button>
                <md-filled-button on-click="scrollToTickets">
                  <iron-icon icon="hoverboard:ticket" slot="icon"></iron-icon>
                  [[ticketActionLabel]]
                </md-filled-button>
              </div>
            </div>

            <div class="terminal-column">
              <div class="terminal-window" aria-label="Event status">
                <div class="terminal-bar"><i></i><i></i><i></i><span>devfest-status.sh</span></div>
                <div class="terminal-body">
                  <div class="terminal-line">
                    <span class="prompt">$</span><span>./event --status</span>
                  </div>
                  <div class="terminal-line">
                    <span></span
                    ><span
                      ><span class="key">status:</span> <span class="green">confirmed</span></span
                    >
                  </div>
                  <div class="terminal-line">
                    <span></span
                    ><span
                      ><span class="key">date:</span> <span class="blue">Nov 21, 2026</span></span
                    >
                  </div>
                  <div class="terminal-line">
                    <span></span
                    ><span><span class="key">theme:</span> real_work / real_lessons</span>
                  </div>
                  <div class="terminal-line">
                    <span></span
                    ><span
                      ><span class="key">spaces:</span> Auditorium, Classroom and Vibe Zone</span
                    >
                  </div>
                  <div class="terminal-line">
                    <span></span
                    ><span
                      ><span class="blue">attendees</span>:
                      <span class="green">[[heroSettings.attendanceClaim]]</span></span
                    >
                  </div>
                  <hr />
                  <div class="terminal-line">
                    <span class="prompt">$</span><span>./programme --status</span>
                  </div>
                  <div class="terminal-line">
                    <span></span><span><span class="key">lineup:</span> complete</span>
                  </div>
                  <div class="terminal-line">
                    <span></span
                    ><span><span class="key">programme:</span> [[programmeSummary]]</span>
                  </div>
                  <div class="terminal-line">
                    <span></span
                    ><span><span class="key">focus:</span> practical_ai / real_world_lessons</span>
                  </div>
                  <hr />
                  <a class="terminal-command" href="/schedule/">View full programme →</a>
                  <a class="terminal-command" href$="[[huntLinks.activities]]">
                    Y2K Vibe Lab &amp; Arcade →
                  </a>
                </div>
              </div>
            </div>
          </div>

          <button
            class="scroll-down"
            type="button"
            aria-label="Scroll to event details"
            on-click="scrollNextBlock"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              version="1.1"
              id="Layer_2"
              x="0px"
              y="0px"
              viewBox="0 0 25.166666 37.8704414"
              enable-background="new 0 0 25.166666 37.8704414"
              xml:space="preserve"
              aria-hidden="true"
            >
              <path
                class="stroke"
                fill="none"
                stroke="#c7c4b8"
                stroke-width="2.5"
                stroke-miterlimit="10"
                d="M12.5833445
                36.6204414h-0.0000229C6.3499947
                36.6204414
                1.25
                31.5204487
                1.25
                25.2871208V12.5833216C1.25
                6.3499947
                6.3499951
                1.25
                12.5833216
                1.25h0.0000229c6.2333269
                0
                11.3333216
                5.0999947
                11.3333216
                11.3333216v12.7037992C23.916666
                31.5204487
                18.8166714
                36.6204414
                12.5833445
                36.6204414z"
              ></path>
              <path
                class="scroller"
                fill="#c7c4b8"
                d="M13.0833359
                19.2157116h-0.9192753c-1.0999985
                0-1.9999971-0.8999996-1.9999971-1.9999981v-5.428606c0-1.0999994
                0.8999987-1.9999981
                1.9999971-1.9999981h0.9192753c1.0999985
                0
                1.9999981
                0.8999987
                1.9999981
                1.9999981v5.428606C15.083334
                18.315712
                14.1833344
                19.2157116
                13.0833359
                19.2157116z"
              ></path>
            </svg>
            <i class="icon icon-arrow-down"></i>
          </button>
        </div>
      </hero-block>
      <cloud-credit-block></cloud-credit-block>
      <speakers-block id="speakers" style="scroll-margin-top: 80px;"></speakers-block>
      <template is="dom-if" if="{{showForkMeBlock}}">
        <fork-me-block></fork-me-block>
      </template>
      <about-block></about-block>
      <div id="tickets" style="scroll-margin-top: 80px;"></div>
      <tickets-block id="registration"></tickets-block>
      <partners-block id="partners" style="scroll-margin-top: 80px;"></partners-block>
      <schedule-block></schedule-block>
      <section id="y2k-activities" class="y2k-activities" aria-labelledby="y2k-heading">
        <div class="y2k-inner">
          <h2 id="y2k-heading" tabindex="-1">Y2K Vibe Lab &amp; Arcade</h2>
          <p>Scratch your first card, find more around DevFest and keep them in My Collection.</p>
          <div class="y2k-links">
            <a class="y2k-link y2k-link-primary" href$="[[huntLinks.activities]]"
              >Enter Y2K Arcade</a
            >
            <a class="y2k-link" href$="[[huntLinks.collection]]">My Collection</a>
            <a class="y2k-link" href="/hunt/c/y6597cd/">Scratch the Welcome Disc</a>
            <a class="y2k-link" href="/hunt/c/pvbusdb/">Open the Vibe Lab prompt</a>
            <a class="y2k-link" href="/hunt/c/rmz75w8/">Play at the Arcade</a>
          </div>
        </div>
      </section>
      <linkedin-updates-block></linkedin-updates-block>
      <subscribe-block></subscribe-block>
      <previous-speakers-block></previous-speakers-block>
      <past-devfests-block></past-devfests-block>
      <about-organizer-block></about-organizer-block>
      <map-block></map-block>
      <visit-block></visit-block>
      <footer-block></footer-block>
    `;
  }

  @property({ type: String })
  private programmeSummary = 'Loading programme…';

  private siteTitle = title;
  private huntLinks = huntSiteLinks;
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
    window.addEventListener('click', this.onSectionLinkClick);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.onHashChange);
    window.removeEventListener('click', this.onSectionLinkClick);
  }

  private onHashChange = () => {
    this.checkHashAndScroll();
  };

  private onSectionLinkClick = (event: MouseEvent) => {
    // A repeated click on the same fragment does not emit hashchange. The
    // target is inside a shadow root, so native fragment scrolling cannot help.
    if (
      event
        .composedPath()
        .some(
          (node) =>
            node instanceof HTMLAnchorElement &&
            (node.getAttribute('href') === '/#partners' ||
              node.getAttribute('href') === huntSiteLinks.activities),
        )
    ) {
      this.checkHashAndScroll();
    }
  };

  private checkHashAndScroll() {
    const { hash } = window.location;
    if (hash === '#partners' || hash === '#y2k-activities') {
      void loadHomeSections().then(() => {
        requestAnimationFrame(() => {
          const section = this.shadowRoot?.querySelector(hash);
          if (section) {
            scrollToElement(section);
            if (hash === '#y2k-activities') {
              section.querySelector<HTMLElement>('#y2k-heading')?.focus({ preventScroll: true });
            }
          }
        });
      });
    }
    if (hash === '#tickets' || hash === '#registration') {
      window.setTimeout(() => this.scrollToTickets(), 50);
    }
  }
}
