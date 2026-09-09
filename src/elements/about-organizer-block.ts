import { customElement, property } from '@polymer/decorators';
import '@polymer/iron-icon';
import '@material/web/button/text-button.js';
import { html, PolymerElement } from '@polymer/polymer';
import '../components/markdown/short-markdown';
import { RootState } from '../store';
import { ReduxMixin } from '../store/mixin';
import { initialUiState } from '../store/ui/state';
import { aboutOrganizerBlock } from '../utils/data';
import '../utils/icons';
import './shared-styles';

@customElement('about-organizer-block')
export class AboutOrganizerBlock extends ReduxMixin(PolymerElement) {
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
          color: var(--terminal-red);
          content: '> organizer --info';
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .block:not(:last-of-type) {
          margin-bottom: 24px;
          padding-bottom: 24px;
          border-bottom: 1px solid var(--divider-color);
        }

        .block h2 {
          color: var(--terminal-copy, var(--primary-text-color));
          font-family: var(--font-mono, monospace);
          text-transform: uppercase;
        }

        .team-icon {
          --iron-icon-height: 160px;
          --iron-icon-width: 160px;
          --iron-icon-fill-color: var(--default-primary-color);
          max-width: 50%;
        }

        .image-link {
          width: min(80%, 280px);
          padding: 20px;
          border: 1px solid var(--divider-color);
          border-radius: var(--border-radius);
          background: var(--terminal-panel, var(--default-background-color));
        }

        .organizers-photo {
          display: block;
          width: 100%;
          height: auto;
          object-fit: contain;
        }

        .description {
          color: var(--secondary-text-color);
          line-height: 1.7;
        }
      </style>

      <div class="container" layout horizontal>
        <div layout horizontal center-center flex hidden$="[[viewport.isPhone]]">
          <a href="/team" class="image-link">
            <img class="organizers-photo" src="[[aboutOrganizerBlock.image]]" alt="Organizer" />
          </a>
        </div>

        <div class="description-block" flex>
          <template is="dom-repeat" items="[[aboutOrganizerBlock.blocks]]" as="block">
            <div class="block">
              <h2>[[block.title]]</h2>

              <short-markdown class="description" content="[[block.description]]"></short-markdown>

              <template is="dom-if" if="[[block.callToAction.newTab]]">
                <md-text-button
                  href="[[block.callToAction.link]]"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="cta-button animated icon-right"
                  aria-label$="[[block.callToAction.label]] - [[block.title]]"
                >
                  <span>[[block.callToAction.label]]</span>
                  <iron-icon icon="hoverboard:arrow-right-circle"></iron-icon>
                </md-text-button>
              </template>
              <template is="dom-if" if="[[!block.callToAction.newTab]]">
                <md-text-button
                  href="[[block.callToAction.link]]"
                  class="cta-button animated icon-right"
                  aria-label$="[[block.callToAction.label]] - [[block.title]]"
                >
                  <span>[[block.callToAction.label]]</span>
                  <iron-icon icon="hoverboard:arrow-right-circle"></iron-icon>
                </md-text-button>
              </template>
            </div>
          </template>
        </div>
      </div>
    `;
  }

  private aboutOrganizerBlock = aboutOrganizerBlock;

  @property({ type: Object })
  private viewport = initialUiState.viewport;

  override stateChanged(state: RootState) {
    this.viewport = state.ui.viewport;
  }
}
