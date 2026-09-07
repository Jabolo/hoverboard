import { Initialized } from '@abraham/remotedata';
import { computed, customElement, property } from '@polymer/decorators';
import '@polymer/iron-icon';
import '@material/web/button/text-button.js';
import { html, PolymerElement } from '@polymer/polymer';
import '@power-elements/lazy-image';
import { PreviousSpeaker } from '../models/previous-speaker';
import { router } from '../router';
import { RootState, store } from '../store';
import { ReduxMixin } from '../store/mixin';
import { fetchPreviousSpeakers } from '../store/previous-speakers/actions';
import { selectRandomPreviousSpeakers } from '../store/previous-speakers/selectors';
import {
  initialPreviousSpeakersState,
  PreviousSpeakersState,
} from '../store/previous-speakers/state';
import { previousSpeakersBlock } from '../utils/data';
import '../utils/icons';
import './shared-styles';

@customElement('previous-speakers-block')
export class PreviousSpeakersBlock extends ReduxMixin(PolymerElement) {
  static get template() {
    return html`
      <style include="shared-styles flex flex-alignment positioning">
        :host {
          margin: 32px auto;
          display: block;
          text-align: center;
        }

        .speakers-wrapper {
          margin: 40px -8px 32px;
          position: relative;
          display: flex;
          flex-wrap: wrap;
          overflow: hidden;
          justify-content: center;
        }

        .speaker {
          margin: 8px;
        }

        .empty-state {
          margin: 0;
          color: var(--secondary-text-color);
        }

        .photo {
          --lazy-image-width: 64px;
          --lazy-image-height: 64px;
          --lazy-image-fit: cover;
          width: var(--lazy-image-width);
          height: var(--lazy-image-height);
          background-color: var(--contrast-additional-background-color);
          border-radius: 50%;
          overflow: hidden;
          transform: translateZ(0);
        }

        @media (min-width: 640px) {
          .speakers-wrapper {
            margin-right: -12px;
            margin-left: -12px;
          }

          .speaker {
            margin: 12px;
          }

          .photo {
            --lazy-image-width: 96px;
            --lazy-image-height: 96px;
          }
        }
      </style>

      <div class="container" hidden$="[[!hasSpeakers]]">
        <h2 class="container-title">[[previousSpeakersBlock.title]]</h2>

        <div class="speakers-wrapper">
          <template is="dom-repeat" items="[[speakers]]" as="speaker">
            <a class="speaker" href$="[[previousSpeakerUrl(speaker.id)]]">
              <lazy-image
                class="photo"
                src="[[speaker.photoUrl]]"
                alt="[[speaker.name]]"
              ></lazy-image>
            </a>
          </template>
        </div>

        <a href="[[previousSpeakersBlock.callToAction.link]]" hidden$="[[!hasSpeakers]]">
          <md-text-button class="animated icon-right" trailing-icon>
            [[previousSpeakersBlock.callToAction.label]]
            <iron-icon slot="icon" icon="hoverboard:arrow-right-circle"></iron-icon>
          </md-text-button>
        </a>
      </div>
    `;
  }

  private previousSpeakersBlock = previousSpeakersBlock;
  @property({ type: Object })
  previousSpeakers: PreviousSpeakersState = initialPreviousSpeakersState;
  @property({ type: Array })
  speakers: PreviousSpeaker[] = [];

  @computed('speakers')
  get hasSpeakers() {
    return this.speakers.length > 0;
  }

  override stateChanged(state: RootState) {
    this.previousSpeakers = state.previousSpeakers;
    this.speakers = selectRandomPreviousSpeakers(state);
  }

  override connectedCallback() {
    super.connectedCallback();
    if (this.previousSpeakers instanceof Initialized) {
      store.dispatch(fetchPreviousSpeakers);
    }
  }

  previousSpeakerUrl(id: string) {
    return router.urlForName('previous-speaker-page', { id });
  }
}
