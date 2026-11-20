import '../hunt/peek-card.js';
import { customElement, property, query } from '@polymer/decorators';
import { html, PolymerElement } from '@polymer/polymer';
import '../components/event-countdown';
import '../components/google-developers-brand';
import '../components/hero/hero-block';
import { HeroBlock } from '../components/hero/hero-block';
import '../elements/devfest-concierge';
import { firebaseApp } from '../firebase';
import { huntSiteLinks } from '../hunt/site-links';
import { store } from '../store';
import { queueSnackbar } from '../store/snackbars';
import {
  eventDate,
  description,
  heroSettings,
  showForkMeBlockForProjectIds,
  title,
} from '../utils/data';
import { INCLUDE_SITE_TITLE, updateMetadata } from '../utils/metadata';
import { POSITION, scrollToElement } from '../utils/scrolling';

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
    import('../elements/partners-block'),
    import('../elements/previous-speakers-block'),
    import('../elements/speakers-block'),
    import('../elements/tickets-block'),
  ]).catch((error: unknown) => {
    sectionsLoading = undefined;
    console.error('Unable to load home page sections:', error);
  });
  return sectionsLoading;
}

@customElement('home-page')
export class HomePage extends PolymerElement {
  static get template() {
    return html`
      <style include="shared-styles flex flex-alignment">
        :host {
          position: relative;
          display: block;
          height: 100%;
        }

        hero-block {
          font-size: 24px;
          text-align: center;
          min-height: 440px;
        }

        .deferred-sections {
          min-height: 85vh;
        }

        schedule-block {
          display: block;
          min-height: 340px;
        }

        visit-block {
          display: block;
          min-height: 480px;
        }

        linkedin-updates-block,
        previous-speakers-block,
        about-organizer-block,
        visit-block {
          content-visibility: auto;
          contain-intrinsic-size: auto 600px;
        }

        .home-content {
          width: min(100%, 980px);
          margin: 0 auto;
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
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          min-width: 0;
        }

        .home-intro devfest-concierge {
          margin-top: 20px;
          width: min(100%, 540px);
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
          text-align: center;
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
          font-size: 13px;
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

        .y2k-activities {
          padding: 40px 24px;
          color: var(--terminal-copy, var(--primary-text-color));
          background: var(--terminal-panel, var(--secondary-background-color));
        }

        .pin-hunt-note {
          margin-top: 28px;
          padding-top: 24px;
          border-top: 1px solid var(--divider-color);
        }
        .pin-hunt-note h3 {
          margin: 0;
          font-size: 22px;
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
            min-height: 440px;
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
            height: auto;
            min-height: 500px;
            max-height: none;
          }

          .home-content {
            margin-top: 0;
            padding-top: 0;
            padding-bottom: 0;
          }

          .home-grid {
            justify-items: center;
            text-align: center;
          }

          .home-intro {
            align-items: center;
            text-align: center;
          }

          .event-details {
            text-align: center;
          }

          .scroll-down {
            display: none;
          }
        }

        /* The event-day homepage gives the programme priority over promotion. */
        .event-description,
        event-countdown {
          display: none;
        }
        @media (max-width: 811px) {
          /* Put the Concierge and programme within reach for attendees already on site. */
          .scroll-down {
            display: none;
          }
          .home-content {
            padding: 0;
          }
          .hero-community {
            margin-top: 8px;
            --google-developers-brand-width: 150px;
          }
          .event-details {
            margin-top: 14px;
            text-align: center;
          }
          .home-intro devfest-concierge {
            margin-top: 16px;
            width: 100%;
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
            <div class="home-intro">
              <div class="brand-lockup">
                <img
                  class="devfest-lockup"
                  src="/images/logos/devfest-2026-wordmark-dark.svg"
                  alt="DevFest 2026"
                  width="2417"
                  height="282"
                />
              </div>

              <google-developers-brand class="hero-community"></google-developers-brand>

              <div class="event-details">
                <div class="event-date">[[eventDate]]</div>
                <div class="event-location">Google for Startups Campus / Warsaw</div>
                <p class="event-description">[[heroSettings.description]]</p>
              </div>

              <event-countdown></event-countdown>

              <devfest-concierge id="concierge" variant="hero"></devfest-concierge>
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
      <div class="deferred-sections">
        <schedule-block></schedule-block>
        <visit-block id="visit" style="scroll-margin-top: 80px;"></visit-block>
        <cloud-credit-block id="cloud-credit" style="scroll-margin-top: 80px;"></cloud-credit-block>
        <attendee-photos-block id="photos" style="scroll-margin-top: 80px;"></attendee-photos-block>
        <speakers-block id="speakers" style="scroll-margin-top: 80px;"></speakers-block>
        <template is="dom-if" if="{{showForkMeBlock}}">
          <fork-me-block></fork-me-block>
        </template>
        <about-block></about-block>
        <div id="tickets" style="scroll-margin-top: 80px;"></div>
        <tickets-block id="registration"></tickets-block>
        <partners-block id="partners" style="scroll-margin-top: 80px;"></partners-block>
      </div>
      <hunt-peek-card></hunt-peek-card>
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
          <aside class="pin-hunt-note" aria-labelledby="pin-hunt-heading">
            <h3 id="pin-hunt-heading">Meet Pin Hunt.</h3>
            <p>
              A separate hunt for physical pins around DevFest. Check the Pin Hunt site for how to
              play and when it starts.
            </p>
            <a
              class="y2k-link"
              href="https://pinhunt.gdgwarsaw.pl/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Explore Pin Hunt (opens in a new tab)"
              >Explore Pin Hunt ↗</a
            >
          </aside>
        </div>
      </section>
      <linkedin-updates-block></linkedin-updates-block>
      <previous-speakers-block></previous-speakers-block>
      <about-organizer-block></about-organizer-block>
      <footer-block></footer-block>
    `;
  }

  private siteTitle = title;
  private huntLinks = huntSiteLinks;
  private eventDate = eventDate;
  private heroSettings = heroSettings.home;

  @query('#hero')
  hero!: HeroBlock;

  @property({ type: Boolean })
  private showForkMeBlock: boolean = false;

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

  private openConcierge(e?: Event) {
    e?.preventDefault();
    const concierge = this.shadowRoot?.querySelector('#concierge') as
      (HTMLElement & { openAndFocus?: (initialIntent?: string) => void }) | null | undefined;
    if (concierge) {
      if (concierge.getBoundingClientRect().top < 0) {
        scrollToElement(concierge);
      }
      concierge.openAndFocus?.();
    } else {
      store.dispatch(queueSnackbar('Error opening concierge.'));
    }
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
    this.checkHashAndScroll();
    window.addEventListener('hashchange', this.onHashChange);
    window.addEventListener('click', this.onHomeAnchorClick);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.onHashChange);
    window.removeEventListener('click', this.onHomeAnchorClick);
  }

  private onHashChange = () => {
    this.checkHashAndScroll();
  };

  private onHomeAnchorClick = (event: MouseEvent) => {
    // Repeated clicks on the current fragment do not emit hashchange.
    if (
      event
        .composedPath()
        .some(
          (node) =>
            node instanceof HTMLAnchorElement &&
            [
              '/#partners',
              '/#visit',
              '/#concierge',
              '/#cloud-credit',
              huntSiteLinks.activities,
            ].includes(node.getAttribute('href') ?? '') &&
            node.getAttribute('href') === `/${window.location.hash}`,
        )
    ) {
      this.checkHashAndScroll();
    }
  };

  private checkHashAndScroll() {
    const { hash } = window.location;
    if (
      hash === '#partners' ||
      hash === '#visit' ||
      hash === '#y2k-activities' ||
      hash === '#concierge' ||
      hash === '#cloud-credit'
    ) {
      void loadHomeSections().then(() => {
        requestAnimationFrame(() => {
          const section = this.shadowRoot?.querySelector<HTMLElement>(hash);
          if (section) {
            scrollToElement(section);
            if (hash === '#y2k-activities') {
              section.querySelector<HTMLElement>('#y2k-heading')?.focus({ preventScroll: true });
            } else if (hash === '#concierge') {
              (
                section as HTMLElement & { openAndFocus?: (initialIntent?: string) => void }
              ).openAndFocus?.();
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
