import { customElement } from '@polymer/decorators';
import { html, PolymerElement } from '@polymer/polymer';
import '@material/web/button/filled-button.js';
import '../components/hero/simple-hero';
import '../elements/footer-block';
import '../elements/shared-styles';
import { heroSettings } from '../utils/data';
import { updateMetadata } from '../utils/metadata';

@customElement('not-found-page')
export class NotFoundPage extends PolymerElement {
  static get template() {
    return html`
      <style include="shared-styles">
        :host {
          display: block;
          min-height: 100vh;
          background: var(--primary-background-color);
          color: var(--primary-text-color);
        }

        .not-found-image {
          width: min(100%, 460px);
          height: auto;
        }

        .not-found-content {
          display: grid;
          grid-template-columns: minmax(0, 0.8fr) minmax(240px, 1fr);
          gap: 48px;
          align-items: center;
          padding-top: 48px;
          padding-bottom: 64px;
        }

        .not-found-message {
          max-width: 38ch;
          color: var(--terminal-muted);
          font-size: 18px;
          line-height: 1.6;
        }

        md-filled-button {
          margin-top: 24px;
          --md-filled-button-container-color: var(--google-blue);
          --md-filled-button-hover-container-color: var(--terminal-green);
          --md-filled-button-label-text-color: #fff;
          --md-filled-button-hover-label-text-color: #06101a;
          font-family: var(--font-mono);
          font-weight: 800;
          text-transform: uppercase;
        }

        @media (max-width: 640px) {
          .not-found-content {
            grid-template-columns: 1fr;
            gap: 24px;
            padding-top: 32px;
          }

          .not-found-image {
            order: -1;
            justify-self: center;
          }
        }
      </style>

      <simple-hero page="notFound"></simple-hero>

      <div class="container not-found-content">
        <div>
          <p class="not-found-message">
            This route is not available. Return to the event home to keep exploring the programme.
          </p>
          <md-filled-button href="/">Return home</md-filled-button>
        </div>
        <img
          class="not-found-image"
          src="/images/not-found.svg"
          alt="Illustration of a route that could not be found"
        />
      </div>

      <footer-block></footer-block>
    `;
  }

  private heroSettings = heroSettings.notFound;

  override connectedCallback() {
    super.connectedCallback();
    updateMetadata(this.heroSettings.title, this.heroSettings.metaDescription);
  }
}
