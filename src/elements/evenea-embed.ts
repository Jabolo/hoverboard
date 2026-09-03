import { customElement, property } from '@polymer/decorators';
import { html, PolymerElement } from '@polymer/polymer';
import { eveneaEmbed } from '../utils/data';

@customElement('evenea-embed')
export class EveneaEmbed extends PolymerElement {
  static get template() {
    return html`
      <style>
        :host {
          display: block;
          margin: 48px auto 0;
          max-width: 960px;
        }

        .header {
          margin-bottom: 16px;
          text-align: center;
        }

        .description {
          margin: 0 auto;
          max-width: 680px;
          color: var(--secondary-text-color);
        }

        iframe {
          display: block;
          width: 100%;
          min-height: 520px;
          border: 0;
        }
      </style>

      <section hidden$="[[!enabled]]">
        <div class="header">
          <h2>[[eveneaEmbed.title]]</h2>
          <p class="description">[[eveneaEmbed.description]]</p>
        </div>
        <iframe
          id="ticketFrame"
          src$="[[eveneaEmbed.iframeSrc]]"
          title="Evenea registration"
          scrolling="no"
          loading="lazy"
          referrerpolicy="strict-origin-when-cross-origin"
        ></iframe>
      </section>
    `;
  }

  private eveneaEmbed = eveneaEmbed;

  @property({ type: Boolean })
  private enabled = Boolean(eveneaEmbed.iframeSrc);

  override connectedCallback() {
    super.connectedCallback();
    if (this.enabled && eveneaEmbed.resizerScriptSrc) {
      this.loadResizerScript();
    }
  }

  private loadResizerScript() {
    const scriptSelector = `script[src="${eveneaEmbed.resizerScriptSrc}"]`;
    if (document.querySelector(scriptSelector)) {
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = eveneaEmbed.resizerScriptSrc;
    document.head.appendChild(script);
  }
}
