import { customElement, property } from '@polymer/decorators';
import { html, PolymerElement } from '@polymer/polymer';
import '../components/hero/simple-hero';
import '../components/markdown/remote-markdown';
import '../elements/footer-block';
import { heroSettings, privacy } from '../utils/data';
import { updateMetadata } from '../utils/metadata';

@customElement('privacy-page')
export class PrivacyPage extends PolymerElement {
  static get template() {
    return html`
      <style>
        :host {
          display: block;
        }
      </style>

      <simple-hero page="faq"></simple-hero>
      <remote-markdown path="[[source]]"></remote-markdown>
      <footer-block></footer-block>
    `;
  }

  private heroSettings = heroSettings.faq;

  @property({ type: String })
  source = privacy;

  override connectedCallback() {
    super.connectedCallback();
    updateMetadata('Privacy & newsletter', this.heroSettings.metaDescription);
  }
}
