import { Failure, Initialized, Success } from '@abraham/remotedata';
import { computed, customElement, property } from '@polymer/decorators';
import '@polymer/paper-progress';
import { html, PolymerElement } from '@polymer/polymer';
import '@power-elements/lazy-image';
import '../components/hero/simple-hero';
import '../elements/content-loader';
import '../elements/shared-styles';
import { PreviousSession } from '../models/previous-session';
import { router } from '../router';
import { RootState, store } from '../store';
import { ReduxMixin } from '../store/mixin';
import { fetchPreviousSpeakers } from '../store/previous-speakers/actions';
import { initialPreviousSpeakersState } from '../store/previous-speakers/state';
import { contentLoaders, heroSettings, speakers } from '../utils/data';
import { updateMetadata } from '../utils/metadata';

@customElement('previous-speakers-page')
export class PreviousSpeakersPage extends ReduxMixin(PolymerElement) {
  @property({ type: Object })
  previousSpeakers = initialPreviousSpeakersState;

  static get template() {
    return html`
      <style include="shared-styles flex flex-alignment positioning">
        :host {
          display: block;
          height: 100%;
          background: var(--primary-background-color);
        }

        .container {
          margin: 32px auto;
          padding-top: 0;
          padding-bottom: 16px;
          display: grid;
          grid-template-columns: 1fr;
          grid-gap: 32px;
        }

        .empty-state {
          margin: 0;
          padding: 40px 32px;
          border: 1px solid var(--terminal-line);
          border-radius: var(--border-radius);
          color: var(--secondary-text-color);
          background: var(--secondary-background-color);
          text-align: center;
        }

        .container.empty-state-container {
          max-width: 760px;
          margin: 32px auto;
          grid-template-columns: minmax(0, 1fr);
        }

        .speaker:hover .photo {
          transform: scale(0.95);
        }

        .speaker {
          min-width: 0;
          padding: 16px;
          border: 1px solid var(--divider-color);
          border-radius: var(--border-radius);
          background: var(--secondary-background-color);
          transition:
            border-color var(--animation),
            box-shadow var(--animation),
            transform var(--animation);
        }

        .speaker:hover {
          border-color: var(--google-blue);
          box-shadow: var(--box-shadow-primary-color);
          transform: translateY(-2px);
        }

        .photo {
          --lazy-image-width: 96px;
          --lazy-image-height: 96px;
          --lazy-image-fit: cover;
          width: var(--lazy-image-width);
          height: var(--lazy-image-height);
          background-color: var(--contrast-additional-background-color);
          border: 3px solid var(--google-blue);
          border-radius: 50%;
          overflow: hidden;
          transform: translateZ(0);
          transition: transform var(--animation);
          flex-shrink: 0;
        }

        .company-logo {
          max-width: 88px;
          height: 16px;
          margin: 8px 0;
          padding: 3px 6px;
          border-radius: 3px;
          background: #fff;
        }

        .details {
          margin-left: 16px;
          color: var(--primary-text-color);
        }

        .name {
          color: var(--terminal-copy, var(--primary-text-color));
          font-family: var(--font-mono, monospace);
          font-weight: 700;
          font-size: 20px;
          line-height: 1;
        }

        .origin {
          margin-top: 4px;
          color: var(--google-green);
          font-family: var(--font-mono, monospace);
          font-size: 14px;
          line-height: 1.1;
        }

        .sessions {
          color: var(--terminal-muted);
          font-family: var(--font-mono, monospace);
          font-size: 13px;
          line-height: 1.1;
          font-weight: bold;
        }

        .sessions h5 {
          margin-right: 4px;
          font-weight: normal;
        }

        paper-progress {
          width: 100%;
          --paper-progress-active-color: var(--default-primary-color);
          --paper-progress-secondary-color: var(--default-primary-color);
        }

        @media (min-width: 640px) {
          .container {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 812px) {
          .container {
            grid-gap: 64px 32px;
          }

          .photo {
            --lazy-image-width: 115px;
            --lazy-image-height: 115px;
            border-width: 5px;
          }

          .name {
            font-size: 24px;
          }
        }

        @media (min-width: 1024px) {
          .container {
            grid-template-columns: repeat(3, 1fr);
            grid-gap: 64px 32px;
          }

          .photo {
            --lazy-image-width: 128px;
            --lazy-image-height: 128px;
          }
        }
      </style>

      <simple-hero page="previousSpeakers"></simple-hero>

      <paper-progress indeterminate hidden$="[[contentLoaderVisibility]]"></paper-progress>

      <content-loader
        class="container"
        card-padding="0"
        card-height="128px"
        avatar-size="128px"
        avatar-circle="64px"
        items-count="[[contentLoaders.itemsCount]]"
        hidden$="[[contentLoaderVisibility]]"
      ></content-loader>
      <div class="container" hidden$="[[empty]]">
        <template is="dom-repeat" items="[[previousSpeakers.data]]" as="speaker">
          <a class="speaker" href$="[[previousSpeakerUrl(speaker.id)]]" layout horizontal>
            <lazy-image
              class="photo"
              src="[[speaker.photoUrl]]"
              alt="[[speaker.name]]"
            ></lazy-image>

            <div class="details" layout vertical center-justified start>
              <h2 class="name">[[speaker.name]]</h2>
              <div class="origin">[[speaker.country]]</div>

              <template is="dom-if" if="[[speaker.companyLogo]]">
                <img
                  class="company-logo"
                  src$="[[speaker.companyLogo]]"
                  alt="[[speaker.company]]"
                />
              </template>

              <div class="sessions">
                <h5>[[previousYears]]:</h5>
                [[getYears(speaker.sessions)]]
              </div>
            </div>
          </a>
        </template>
      </div>

      <template is="dom-if" if="[[empty]]">
        <div class="container empty-state-container">
          <p class="empty-state" role="status">
            The previous speaker archive is being prepared and will appear here when available.
          </p>
        </div>
      </template>

      <footer-block></footer-block>
    `;
  }

  private heroSettings = heroSettings.previousSpeakers;
  private contentLoaders = contentLoaders.previousSpeakers;
  private previousYears = speakers.previousYears;

  @computed('previousSpeakers')
  private get empty() {
    return this.previousSpeakers instanceof Success && this.previousSpeakers.data.length === 0;
  }

  override stateChanged(state: RootState) {
    this.previousSpeakers = state.previousSpeakers;
  }

  override connectedCallback() {
    super.connectedCallback();
    updateMetadata(this.heroSettings.title, this.heroSettings.metaDescription);

    if (this.previousSpeakers instanceof Initialized) {
      store.dispatch(fetchPreviousSpeakers);
    }
  }

  @computed('previousSpeakers')
  private get contentLoaderVisibility(): boolean {
    return this.previousSpeakers instanceof Success || this.previousSpeakers instanceof Failure;
  }

  private getYears(sessions: { [key: number]: PreviousSession[] }) {
    return Object.keys(sessions || {})
      .map(Number)
      .sort((a, b) => b - a)
      .join(', ');
  }

  private previousSpeakerUrl(id: string) {
    return router.urlForName('previous-speaker-page', { id });
  }
}
