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
          margin: 56px auto 0;
          padding-top: 32px;
          border-top: 1px solid var(--divider-color);
          max-width: 960px;
        }

        .header {
          margin-bottom: 16px;
          text-align: center;
        }

        .header h2 {
          font-family: var(--font-mono, monospace);
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        .description {
          margin: 0 auto;
          max-width: 680px;
          color: var(--secondary-text-color);
        }

        .preview-card {
          box-sizing: border-box;
          max-width: 680px;
          margin: 0 auto;
          padding: 24px;
          border: 1px solid var(--divider-color);
          border-radius: var(--border-radius);
          background: var(--secondary-background-color);
          text-align: center;
        }

        .preview-card p {
          margin: 0 0 16px;
          color: var(--secondary-text-color);
        }

        .draft-link {
          color: var(--google-green, var(--default-primary-color));
          font-family: var(--font-mono, monospace);
          font-weight: 600;
        }

        iframe {
          display: block;
          width: 100%;
          /* Keep enough room for five ticket rows and the final join action
             without leaving a large empty tail below the form. */
          height: 980px;
          min-height: 980px;
          border: 0;
          border-radius: var(--border-radius);
          background: #fff;
          overflow: auto;
        }

        @media (min-width: 640px) {
          iframe {
            height: 820px;
            min-height: 820px;
          }
        }
      </style>

      <section hidden$="[[!enabled]]">
        <div class="header">
          <h2>[[eveneaEmbed.title]]</h2>
          <p class="description">[[eveneaEmbed.description]]</p>
        </div>
        <template is="dom-if" if="[[published]]">
          <iframe
            id="ticketFrame"
            src$="[[eveneaEmbed.iframeSrc]]"
            title="Evenea registration"
            scrolling="auto"
            loading="lazy"
            referrerpolicy="strict-origin-when-cross-origin"
          ></iframe>
        </template>
        <template is="dom-if" if="[[!published]]">
          <div class="preview-card">
            <p>
              This registration form is prepared in Evenea and is currently available only as a
              private organizer preview.
            </p>
            <a
              class="draft-link"
              href$="[[eveneaEmbed.draftUrl]]"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open the private Evenea draft
            </a>
          </div>
        </template>
      </section>
    `;
  }

  private eveneaEmbed = eveneaEmbed;

  @property({ type: Boolean })
  private enabled = Boolean(eveneaEmbed.iframeSrc);

  @property({ type: Boolean })
  private published = Boolean(eveneaEmbed.published);

  override connectedCallback() {
    super.connectedCallback();
    if (this.enabled && this.published && eveneaEmbed.resizerScriptSrc) {
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
