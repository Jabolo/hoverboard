import { customElement } from '@polymer/decorators';
import { html, PolymerElement } from '@polymer/polymer';
import '@power-elements/lazy-image';
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
          --lazy-image-width: calc(100% - 94px);
          --lazy-image-height: 400px;
          width: var(--lazy-image-width);
          height: var(--lazy-image-height);
          margin: 48px;
        }
      </style>

      <simple-hero page="notFound"></simple-hero>

      <lazy-image
        class="not-found-image"
        src="../../images/not-found.svg"
        alt="[[heroSettings.title]]"
      ></lazy-image>

      <footer-block></footer-block>
    `;
  }

  private heroSettings = heroSettings.notFound;

  override connectedCallback() {
    super.connectedCallback();
    updateMetadata(this.heroSettings.title, this.heroSettings.metaDescription);
  }
}
