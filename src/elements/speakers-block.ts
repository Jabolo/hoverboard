import { speakersPreview } from '../utils/speakers-preview';
import { Initialized, Pending, Success } from '@abraham/remotedata';
import { computed, customElement, property } from '@polymer/decorators';
import '@polymer/iron-icon';
import '@material/web/button/text-button.js';
import { html, PolymerElement } from '@polymer/polymer';
import '@power-elements/lazy-image';
import '../components/text-truncate';
import '../components/speaker-affiliations';
import { Speaker } from '../models/speaker';
import { router } from '../router';
import { RootState, store } from '../store';
import { ReduxMixin } from '../store/mixin';
import { fetchSpeakers } from '../store/speakers/actions';
import { initialSpeakersState } from '../store/speakers/state';
import { randomOrder } from '../utils/arrays';
import { speakersBlock } from '../utils/data';
import '../utils/icons';
import './shared-styles';

@customElement('speakers-block')
export class SpeakersBlock extends ReduxMixin(PolymerElement) {
  private speakersPreview = speakersPreview;

  static get template() {
    return html`
      <style include="shared-styles flex flex-alignment positioning">
        :host {
          display: block;
          border-bottom: 1px solid var(--divider-color);
          background: var(--primary-background-color);
        }

        .container {
          position: relative;
          padding-top: 76px;
          padding-bottom: 56px;
        }

        .container::before {
          position: absolute;
          top: 28px;
          left: 16px;
          color: var(--google-blue);
          content: '> speakers --featured';
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .speakers-wrapper {
          margin: 40px 0 32px;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          grid-gap: 32px 16px;
        }

        .speaker {
          position: relative;
          padding: 16px 12px;
          border: 1px solid var(--divider-color);
          border-radius: var(--border-radius);
          background: var(--secondary-background-color);
          text-align: center;
          transition:
            border-color var(--animation),
            box-shadow var(--animation),
            transform var(--animation);
        }

        .speaker-link {
          display: block;
          color: inherit;
          text-decoration: none;
        }

        .speaker:hover {
          border-color: var(--google-blue);
          box-shadow: var(--box-shadow-primary-color);
          transform: translateY(-3px);
        }

        .photo {
          display: inline-block;
          --lazy-image-width: 72px;
          --lazy-image-height: 72px;
          --lazy-image-fit: cover;
          width: var(--lazy-image-width);
          height: var(--lazy-image-height);
          background-color: var(--accent-color);
          border-radius: 50%;
          border: 2px solid var(--google-blue);
          overflow: hidden;
          transform: translateZ(0);
        }

        .description {
          color: var(--primary-text-color);
        }

        .name {
          margin-top: 8px;
          color: var(--terminal-copy, var(--primary-text-color));
          font-family: var(--font-mono, monospace);
          font-weight: 700;
          line-height: 1.1;
        }

        .professional-role {
          margin-top: 8px;
          color: var(--terminal-copy, var(--primary-text-color));
          font-size: 14px;
          font-weight: 600;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .professional-company {
          margin-top: 2px;
          color: var(--terminal-green);
          font-size: 14px;
          font-weight: 600;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .professional-highlight {
          margin: 12px 0 0;
          color: var(--terminal-muted);
          font-size: 14px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .origin {
          margin-top: 4px;
          color: var(--terminal-muted);
          font-size: 12px;
          line-height: 1.5;
        }

        .cta-button {
          margin-top: 24px;
        }

        .status-message {
          margin: 24px 0;
          padding: 18px 20px;
          border: 1px solid var(--terminal-line);
          border-radius: var(--border-radius);
          background: var(--terminal-panel);
          color: var(--terminal-muted);
          font-family: var(--font-mono, monospace);
          font-size: 14px;
          line-height: 1.5;
        }

        @media (min-width: 640px) {
          .photo {
            --lazy-image-width: 128px;
            --lazy-image-height: 128px;
          }

          .name {
            font-size: 24px;
          }
        }

        @media (min-width: 812px) {
          .speakers-wrapper {
            grid-template-columns: repeat(3, 1fr);
          }

          .speaker:last-of-type {
            display: none;
          }

          .badges {
            left: calc(50% + 32px);
          }

          .badge:nth-of-type(2) {
            transform: translate(25%, 75%);
          }

          .badge:nth-of-type(2):hover {
            transform: translate3d(25%, 75%, 20px) scale(1.1);
          }

          .badge:nth-of-type(3) {
            transform: translate(10%, 180%);
          }

          .badge:nth-of-type(3):hover {
            transform: translate3d(10%, 180%, 20px) scale(1.1);
          }
        }

        @media (min-width: 1024px) {
          .speakers-wrapper {
            grid-template-columns: repeat(4, 1fr);
          }

          .speaker:last-of-type {
            display: block;
          }
        }
      </style>

      <div class="container">
        <h2 class="container-title">[[speakersBlock.title]]</h2>

        <div class="speakers-wrapper" hidden$="[[!hasSpeakers]]">
          <template is="dom-repeat" items="[[featuredSpeakers]]" as="speaker">
            <div class="speaker">
              <a class="speaker-link" href$="[[speakerUrl(speaker.id)]]">
                <lazy-image
                  class="photo"
                  src="[[speaker.photoUrl]]"
                  alt="[[speaker.name]]"
                ></lazy-image>

                <div class="description">
                  <h3 class="name">[[speaker.name]]</h3>
                  <template is="dom-if" if="[[speaker.title]]">
                    <div class="professional-role">[[speaker.title]]</div>
                  </template>
                  <template is="dom-if" if="[[speaker.company]]">
                    <div class="professional-company">[[speaker.company]]</div>
                  </template>
                  <template
                    is="dom-if"
                    if="[[professionalHighlight(speaker.shortBio, speaker.title, speaker.company)]]"
                  >
                    <p class="professional-highlight">
                      [[professionalHighlight(speaker.shortBio, speaker.title, speaker.company)]]
                    </p>
                  </template>
                  <template is="dom-if" if="[[speaker.country]]">
                    <div class="origin">[[speaker.country]]</div>
                  </template>
                </div>
              </a>
              <speaker-affiliations
                company="[[speaker.company]]"
                logo-url="[[speaker.companyLogoUrl]]"
                logo-background="[[speaker.companyLogoBackground]]"
                badges="[[speaker.badges]]"
              ></speaker-affiliations>
            </div>
          </template>
        </div>

        <p class="status-message" role="status" hidden$="[[!pending]]">
          Loading the speaker lineup…
        </p>
        <p class="status-message" role="status" hidden$="[[!empty]]">
          [[emptyMessage(speakersPreview)]]
        </p>

        <md-outlined-button
          href="[[speakersBlock.callToAction.link]]"
          class="cta-button animated icon-right"
        >
          <span>[[speakersBlock.callToAction.label]]</span>
          <iron-icon icon="hoverboard:arrow-right-circle"></iron-icon>
        </md-outlined-button>
      </div>
    `;
  }

  @property({ type: Object })
  speakers = initialSpeakersState;

  private professionalHighlight(shortBio = '', title = '', company = '') {
    const normalize = (value: string) =>
      value
        .trim()
        .toLocaleLowerCase()
        .replace(/[\s,|·–—-]+/g, ' ');
    const highlight = shortBio.trim();
    const repeated = [title, company, `${title} at ${company}`, `${title} ${company}`].map(
      normalize,
    );
    return highlight && !repeated.includes(normalize(highlight)) ? highlight : '';
  }

  private emptyMessage(preview: boolean) {
    return preview
      ? 'Confirmed speaker preview unavailable.'
      : 'Speaker profiles will appear here as the programme is confirmed. Got a talk or workshop idea?';
  }

  private speakersBlock = speakersPreview
    ? {
        ...speakersBlock,
        callToAction: { label: 'Meet the confirmed speakers', link: '/speakers' },
      }
    : speakersBlock;

  override connectedCallback() {
    super.connectedCallback();

    if (this.speakers instanceof Initialized) {
      store.dispatch(fetchSpeakers);
    }
  }

  override stateChanged(state: RootState) {
    super.stateChanged(state);
    this.speakers = state.speakers;
  }

  @computed('speakers')
  get featuredSpeakers(): Speaker[] {
    if (this.speakers instanceof Success) {
      const { data } = this.speakers;
      const filteredSpeakers = data.filter((speaker) => speaker.featured);
      const randomSpeakers = randomOrder(filteredSpeakers.length ? filteredSpeakers : data);
      return randomSpeakers.slice(0, 4);
    } else {
      return [];
    }
  }

  @computed('speakers')
  get hasSpeakers() {
    return this.speakers instanceof Success && this.speakers.data.length > 0;
  }

  @computed('speakers')
  get pending() {
    return this.speakers instanceof Pending;
  }

  @computed('speakers')
  get empty() {
    return this.speakers instanceof Success && this.speakers.data.length === 0;
  }

  speakerUrl(id: string) {
    return router.urlForName('speaker-page', { id });
  }
}
