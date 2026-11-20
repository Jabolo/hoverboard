import '@material/web/button/outlined-button.js';
import { computed, customElement, property } from '@polymer/decorators';
import { html, PolymerElement } from '@polymer/polymer';
import { eveneaEmbed } from '../utils/data';
import { buildAttributedUrl } from '../utils/attribution';

@customElement('evenea-embed')
export class EveneaEmbed extends PolymerElement {
  static get template() {
    return html`
      <style>
        :host {
          display: block;
          margin: 0 auto;
          max-width: 960px;
          scroll-margin-top: 96px;
        }

        :host(:not([opened])) {
          display: none;
        }

        :host([opened]) {
          margin-top: 36px;
          padding-top: 28px;
          border-top: 1px dashed var(--divider-color);
          animation: slideDownFade 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideDownFade {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .embed-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
          padding: 14px 16px;
          background: var(--secondary-background-color);
          border: 1px solid var(--divider-color);
          border-radius: var(--border-radius);
          text-align: left;
        }

        .embed-bar-copy {
          min-width: 0;
        }

        .embed-bar-copy h2 {
          margin: 0;
          color: var(--primary-text-color);
          font-family: var(--font-mono, monospace);
          font-size: 16px;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        .active-selection {
          margin: 4px 0 0;
          color: var(--secondary-text-color);
          font-size: 14px;
          line-height: 1.45;
        }

        .active-selection strong {
          color: var(--primary-text-color);
          font-weight: 700;
        }

        .close-embed-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          min-height: 44px;
          background: transparent;
          border: 1px solid var(--divider-color);
          color: var(--primary-text-color);
          padding: 8px 14px;
          border-radius: 4px;
          cursor: pointer;
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          transition:
            background 0.2s,
            color 0.2s,
            border-color 0.2s;
        }

        .close-embed-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: var(--primary-text-color);
          border-color: var(--google-blue);
        }

        .preview-card,
        .offline-card {
          box-sizing: border-box;
          max-width: 680px;
          margin: 0 auto;
          padding: 24px;
          border: 1px solid var(--divider-color);
          border-radius: var(--border-radius);
          background: var(--secondary-background-color);
          text-align: center;
        }

        .preview-card p,
        .offline-card p {
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
          /* Fallback height: the official Evenea resizer replaces this with
             the exact content height after the iframe finishes loading. */
          height: 1180px;
          min-height: 0;
          border: 0;
          border-radius: var(--border-radius);
          background: #fff;
          overflow: auto;
        }

        @media (min-width: 640px) {
          iframe {
            height: 1000px;
          }
        }

        @media (max-width: 639px) {
          .embed-top-bar {
            flex-direction: column;
            align-items: stretch;
          }

          .close-embed-btn {
            width: 100%;
          }
        }
      </style>

      <section hidden$="[[!enabled]]">
        <div class="embed-top-bar">
          <div class="embed-bar-copy" role="status" aria-live="polite">
            <h2>[[eveneaEmbed.title]]</h2>
            <p class="active-selection">
              <template is="dom-if" if="[[selectedTicketName]]">
                <span
                  >Selected ticket: <strong>[[selectedTicketName]]</strong> — complete your details
                  in the Evenea form below.</span
                >
              </template>
              <template is="dom-if" if="[[!selectedTicketName]]">
                <span>Choose your ticket and quantity in the Evenea form below.</span>
              </template>
            </p>
          </div>
          <button type="button" class="close-embed-btn" on-click="handleClose">Close form</button>
        </div>
        <template is="dom-if" if="[[hasBeenOpened]]">
          <template is="dom-if" if="[[isOffline]]">
            <div class="offline-card">
              <p>Ticketing registration requires an active internet connection.</p>
              <md-outlined-button on-click="retryConnection">Retry connection</md-outlined-button>
            </div>
          </template>
          <template is="dom-if" if="[[!isOffline]]">
            <template is="dom-if" if="[[published]]">
              <iframe
                id="ticketFrame"
                src$="[[registrationSrc]]"
                title="Evenea registration"
                scrolling="auto"
                loading="lazy"
                referrerpolicy="strict-origin-when-cross-origin"
                sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-top-navigation-by-user-activation"
                on-load="handleFrameLoad"
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
          </template>
        </template>
      </section>
    `;
  }

  private eveneaEmbed = eveneaEmbed;

  @property({ type: Boolean })
  private enabled = Boolean(eveneaEmbed.iframeSrc);

  @property({ type: Boolean })
  private published = Boolean(eveneaEmbed.published);

  @property({ type: Boolean, reflectToAttribute: true, observer: 'openedChanged' })
  opened = false;

  @property({ type: Boolean })
  private hasBeenOpened = false;

  @property({ type: Boolean })
  private isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

  @property({ type: String })
  selectedTicketName = '';

  @property({ type: String })
  selectedTicketId = '';

  private resizerFrame: HTMLIFrameElement | null = null;

  @computed('selectedTicketId')
  private get registrationSrc() {
    const registrationUrl = new URL(buildAttributedUrl(eveneaEmbed.iframeSrc));

    if (this.selectedTicketId) {
      registrationUrl.searchParams.set(`ticket[${this.selectedTicketId}]`, '1');
    }

    return registrationUrl.toString();
  }

  override connectedCallback() {
    super.connectedCallback();
    if (this.opened && this.enabled && this.published && eveneaEmbed.resizerScriptSrc) {
      this.loadResizerScript();
    }
    window.addEventListener('online', this.updateNetworkStatus);
    window.addEventListener('offline', this.updateNetworkStatus);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('online', this.updateNetworkStatus);
    window.removeEventListener('offline', this.updateNetworkStatus);
  }

  private updateNetworkStatus = () => {
    this.isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  };

  private retryConnection() {
    this.updateNetworkStatus();
    if (!this.isOffline) {
      const frame = this.shadowRoot?.querySelector<HTMLIFrameElement>('#ticketFrame');
      if (frame) {
        frame.src = this.registrationSrc;
      }
    }
  }

  private openedChanged(opened: boolean) {
    if (opened) {
      this.hasBeenOpened = true;
      if (this.enabled && this.published && eveneaEmbed.resizerScriptSrc) {
        this.loadResizerScript();
      }
      window.setTimeout(() => {
        this.initializeResizer();
      }, 100);
    }
  }

  private handleClose() {
    this.opened = false;
    this.dispatchEvent(new CustomEvent('close-registration', { bubbles: true, composed: true }));
  }

  private loadResizerScript() {
    const scriptSelector = `script[src="${eveneaEmbed.resizerScriptSrc}"]`;
    const existingScript = document.querySelector<HTMLScriptElement>(scriptSelector);
    if (existingScript) {
      existingScript.addEventListener('load', this.initializeResizer, { once: true });
      window.setTimeout(this.initializeResizer, 0);
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = eveneaEmbed.resizerScriptSrc;
    script.addEventListener('load', this.initializeResizer, { once: true });
    document.head.appendChild(script);
  }

  private handleFrameLoad() {
    this.initializeResizer();
  }

  private initializeResizer = () => {
    const frame = this.shadowRoot?.querySelector<HTMLIFrameElement>('#ticketFrame');
    const resizerWindow = window as Window & {
      iFrameResize?: (options: Record<string, unknown>, element?: HTMLIFrameElement) => void;
    };

    if (!frame || typeof resizerWindow.iFrameResize !== 'function') {
      return;
    }

    if (this.resizerFrame === frame) {
      return;
    }

    resizerWindow.iFrameResize(
      {
        checkOrigin: ['https://app.evenea.pl', 'https://evenea.pl'],
        heightCalculationMethod: 'bodyOffset',
        // Keep the form reachable if the cross-origin resize handshake is delayed or fails.
        scrolling: true,
      },
      frame,
    );
    this.resizerFrame = frame;
  };
}
