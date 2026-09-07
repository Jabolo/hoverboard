import { customElement, property } from '@polymer/decorators';
import { html, PolymerElement } from '@polymer/polymer';
import '../components/hero/simple-hero';
import '../components/markdown/remote-markdown';
import '../elements/footer-block';
import { heroSettings, privacyNotice } from '../utils/data';
import { updateMetadata } from '../utils/metadata';

@customElement('privacy-page')
export class PrivacyPage extends PolymerElement {
  static get template() {
    return html`
      <style include="shared-styles">
        :host {
          display: block;
          background: var(--primary-background-color);
          color: var(--primary-text-color);
        }
      </style>

      <simple-hero page="privacy"></simple-hero>
      <remote-markdown toc path="[[source]]"></remote-markdown>
      <footer-block></footer-block>
    `;
  }

  private heroSettings = heroSettings.privacy;

  @property({ type: String })
  source = privacyNotice;

  override connectedCallback() {
    super.connectedCallback();
    updateMetadata(this.heroSettings.title, this.heroSettings.metaDescription);
  }
}
