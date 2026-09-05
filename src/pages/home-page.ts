import { Success } from '@abraham/remotedata';
import { computed, customElement, property, query } from '@polymer/decorators';
import '@polymer/iron-icon';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import { html, PolymerElement } from '@polymer/polymer';
import '../components/about-block';
import '../components/event-countdown';
import '../components/hero/hero-block';
import { HeroBlock } from '../components/hero/hero-block';
import '../elements/about-organizer-block';
import '../elements/footer-block';
import '../elements/fork-me-block';
import '../elements/map-block';
import '../elements/partners-block';
import '../elements/speakers-block';
import '../elements/subscribe-block';
import '../elements/tickets-block';
import { firebaseApp } from '../firebase';
import { RootState, store } from '../store';
import { ReduxMixin } from '../store/mixin';
import { queueSnackbar } from '../store/snackbars';
import { openVideoDialog } from '../store/ui/actions';
import {
  aboutBlock,
  buyTicket,
  dates,
  description,
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

        .home-content {
          width: min(100%, 980px);
          padding: 24px 20px 52px;
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

        .hero-logo {
          display: block;
          width: 100%;
          height: auto;
          max-width: 240px;
          max-height: 76px;
          object-fit: contain;
        }

        .community-logo {
          display: block;
          width: min(250px, 100%);
          height: auto;
          object-fit: contain;
          margin-bottom: 20px;
        }

        .info-items {
          margin: 24px auto;
          color: var(--terminal-copy);
          font-family: var(--font-mono);
          font-size: 22px;
          line-height: 1.35;
        }

        .info-item:first-child {
          color: var(--terminal-green);
          font-weight: 800;
          letter-spacing: 0.02em;
        }

        .info-items > *:not(:first-of-type) {
          margin-top: 4px;
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
          margin-top: 24px;
          color: currentColor;
          user-select: none;
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
          min-height: 40px;
          padding: 0 10px;
          border: 1px solid rgb(126 242 165 / 36%);
          border-radius: 6px;
          background: rgb(126 242 165 / 8%);
          color: var(--terminal-green);
          font-family: var(--font-mono);
          font-size: 11px;
        }

        .terminal-command .cursor {
          width: 6px;
          height: 14px;
          margin-left: 7px;
          background: var(--terminal-green);
          animation: blink 1.1s steps(2, start) infinite;
        }

        @keyframes blink {
          50% {
            opacity: 0;
          }
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

        @media (min-width: 812px) {
          hero-block {
            height: calc(100vh + 65px);
          }

          .hero-logo {
            max-width: 320px;
          }

          .info-items {
            margin: 48px auto;
            font-size: 28px;
            line-height: 1.1;
          }

          .home-grid {
            grid-template-columns: minmax(0, 0.9fr) minmax(320px, 0.8fr);
            gap: clamp(28px, 5vw, 72px);
            text-align: left;
          }

          .home-intro {
            align-items: flex-start;
            text-align: left;
          }

          .info-items {
            margin-right: 0;
            margin-left: 0;
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
          <div class="home-grid">
            <div class="home-intro" layout vertical center>
              <div class="hero-command">&gt; devfest.init --2026</div>
              <img
                class="community-logo"
                src="/images/logos/gdg-warsaw-white.svg"
                alt="Google Developer Groups Warszawa"
              />
              <img class="hero-logo" src="/images/logo.svg" alt="[[siteTitle]]" />

              <div class="info-items">
                <div class="info-item">[[dates]]</div>
                <div class="info-item">[[heroSettings.description]]</div>
              </div>

              <event-countdown></event-countdown>

              <div class="action-buttons" layout horizontal center-justified wrap>
                <template is="dom-if" if="[[hasHighlights]]">
                  <md-outlined-button class="watch-video" on-click="playVideo">
                    <iron-icon icon="hoverboard:movie" slot="icon"></iron-icon>
                    [[viewHighlights]]
                  </md-outlined-button>
                </template>
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
                      ><span class="key">status:</span>
                      <span class="green">preview_ready</span></span
                    >
                  </div>
                  <div class="terminal-line">
                    <span></span
                    ><span
                      ><span class="key">date:</span> <span class="blue">2026-11-21</span></span
                    >
                  </div>
                  <div class="terminal-line">
                    <span></span><span><span class="key">format:</span> one_day / in_person</span>
                  </div>
                  <hr />
                  <div class="terminal-line">
                    <span class="prompt">$</span><span>./registration --inspect</span>
                  </div>
                  <div class="terminal-line">
                    <span></span><span><span class="key">channel:</span> embedded / Evenea</span>
                  </div>
                  <div class="terminal-line">
                    <span></span><span><span class="key">capacity:</span> 300</span>
                  </div>
                  <hr />
                  <div class="terminal-command">
                    $ ./countdown --next <span class="cursor"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="scroll-down" on-click="scrollNextBlock">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              version="1.1"
              id="Layer_2"
              x="0px"
              y="0px"
              viewBox="0 0 25.166666 37.8704414"
              enable-background="new 0 0 25.166666 37.8704414"
              xml:space="preserve"
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
          </div>
        </div>
      </hero-block>
      <template is="dom-if" if="{{showForkMeBlock}}">
        <fork-me-block></fork-me-block>
      </template>
      <about-block></about-block>
      <speakers-block></speakers-block>
      <subscribe-block></subscribe-block>
      <tickets-block id="tickets-block"></tickets-block>
      <about-organizer-block></about-organizer-block>
      <map-block></map-block>
      <partners-block></partners-block>
      <footer-block></footer-block>
    `;
  }

  private siteTitle = title;
  private dates = dates;
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
    const element = this.$['tickets-block'];
    if (element) {
      scrollToElement(element);
    } else {
      store.dispatch(queueSnackbar('Error scrolling to section.'));
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
    updateMetadata(title, description, INCLUDE_SITE_TITLE.NO);
    this.showForkMeBlock = this.shouldShowForkMeBlock();
  }
}
