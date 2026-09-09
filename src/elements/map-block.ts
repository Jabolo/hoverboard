import { customElement, property } from '@polymer/decorators';
import '@polymer/google-map';
import '@polymer/paper-icon-button';
import { html, PolymerElement } from '@polymer/polymer';
import { RootState } from '../store';
import { ReduxMixin } from '../store/mixin';
import { initialUiState } from '../store/ui/state';
import { CONFIG, getConfig } from '../utils/config';
import { location, mapBlock } from '../utils/data';
import '../utils/icons';
import './shared-styles';

@customElement('map-block')
export class MapBlock extends ReduxMixin(PolymerElement) {
  static get template() {
    return html`
      <style include="shared-styles flex flex-alignment positioning">
        :host {
          margin: 32px auto;
          display: block;
          position: relative;
          border-bottom: 1px solid var(--divider-color);
        }

        .description-card {
          margin: 0 -16px;
          padding: 16px;
          border: 1px solid var(--google-blue);
          background: var(--terminal-panel);
          color: var(--terminal-copy);
        }

        .description-card h2 {
          color: var(--google-green);
          font-family: var(--font-mono, monospace);
          text-transform: uppercase;
        }

        .description-card p {
          color: var(--terminal-muted);
          line-height: 1.6;
        }

        .bottom-info {
          margin-top: 24px;
        }

        .directions-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          color: var(--text-primary-color);
          text-decoration: none;
          transition:
            background-color var(--animation),
            color var(--animation);
        }

        .directions-link:hover {
          background-color: rgba(255, 255, 255, 0.08);
          color: var(--google-blue);
        }

        .directions-link iron-icon {
          --iron-icon-width: 24px;
          --iron-icon-height: 24px;
        }

        @media (min-width: 640px) {
          :host {
            margin: 64px auto 72px;
          }

          google-map {
            display: block;
            height: 640px;
          }

          .description-card {
            margin: 0;
            padding: 24px;
            max-width: 320px;
            border-radius: var(--border-radius);
          }

          :host([map-visible]) .description-card {
            transform: translateY(80px);
          }

          .address {
            font-size: 12px;
          }
        }
      </style>

      <template is="dom-if" if="[[showMap]]">
        <google-map
          id="map"
          latitude="[[location.mapCenter.latitude]]"
          longitude="[[location.mapCenter.longitude]]"
          api-key="[[googleMapApiKey]]"
          zoom="[[location.pointer.zoom]]"
          disable-default-ui
          draggable="false"
          additional-map-options="[[options]]"
        >
          <google-map-marker
            latitude="[[location.pointer.latitude]]"
            longitude="[[location.pointer.longitude]]"
            title="[[location.name]]"
            icon="images/map-marker.svg"
          ></google-map-marker>
        </google-map>
      </template>

      <div class="container" layout vertical end-justified fit$="[[viewport.isTabletPlus]]">
        <div class="description-card" layout vertical justified>
          <div>
            <h2>[[mapBlock.title]]</h2>
            <p>[[location.description]]</p>
          </div>
          <div class="bottom-info" layout horizontal justified center>
            <span class="address">[[location.address]]</span>
            <a
              class="directions-link"
              aria-label="Get directions to the venue"
              href="https://www.google.com/maps/dir/?api=1&amp;destination=[[location.address]]"
              target="_blank"
              rel="noopener noreferrer"
            >
              <iron-icon icon="hoverboard:directions"></iron-icon>
            </a>
          </div>
        </div>
      </div>
    `;
  }

  private location = location;
  private mapBlock = mapBlock;
  private googleMapApiKey = '';

  @property({ type: Boolean })
  private showMap = false;

  @property({ type: Object })
  private viewport = initialUiState.viewport;
  @property({ type: Object })
  private option = {
    disableDefaultUI: true,
    disableDoubleClickZoom: true,
    scrollwheel: false,
    draggable: false,
    styles: [
      {
        stylers: [{ lightness: 40 }, { visibility: 'on' }, { gamma: 0.9 }, { weight: 0.4 }],
      },
      {
        elementType: 'labels',
        stylers: [{ visibility: 'on' }],
      },
      {
        featureType: 'water',
        stylers: [{ color: '#5dc7ff' }],
      },
      {
        featureType: 'road',
        stylers: [{ visibility: 'off' }],
      },
    ],
  };

  override stateChanged(state: RootState) {
    this.viewport = state.ui.viewport;
  }

  override connectedCallback() {
    super.connectedCallback();

    try {
      this.googleMapApiKey = getConfig(CONFIG.GOOGLE_MAPS_API_KEY);
    } catch {
      this.googleMapApiKey = '';
    }

    this.showMap = Boolean(this.googleMapApiKey) && this.viewport.isTabletPlus;
    this.toggleAttribute('map-visible', this.showMap);
  }
}
