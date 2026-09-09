import { computed, customElement, property } from '@polymer/decorators';
import { html, PolymerElement } from '@polymer/polymer';
import { eveneaEmbed } from '../utils/data';

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
          gap: 12px;
          margin-bottom: 20px;
          padding: 10px 16px;
          background: var(--secondary-background-color);
          border: 1px solid var(--divider-color);
          border-radius: var(--border-radius);
          font-family: var(--font-mono, monospace);
          font-size: 13px;
        }

        .active-selection {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--google-blue);
        }

        .active-selection strong {
          color: var(--primary-text-color);
          font-weight: 800;
        }

        .close-embed-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: 1px solid var(--divider-color);
          color: var(--secondary-text-color);
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 600;
          transition:
            background 0.2s,
            color 0.2s,
            border-color 0.2s;
        }

        .close-embed-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: var(--primary-text-color);
          border-color: var(--google-yellow);
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

        .registration-guide {
          box-sizing: border-box;
          display: flex;
          align-items: flex-start;
          gap: 14px;
          max-width: 760px;
          margin: 20px auto 24px;
          padding: 14px 16px;
          border: 1px solid rgba(66, 133, 244, 0.55);
          border-left: 4px solid var(--google-blue);
          border-radius: var(--border-radius);
          background: rgba(66, 133, 244, 0.08);
          text-align: left;
        }

        .registration-guide .step-number {
          display: grid;
          flex: 0 0 30px;
          width: 30px;
          height: 30px;
          place-items: center;
          border-radius: 50%;
          background: var(--google-blue);
          color: #fff;
          font-family: var(--font-mono, monospace);
          font-size: 14px;
          font-weight: 800;
        }

        .registration-guide .guide-copy {
          min-width: 0;
        }

        .registration-guide .guide-kicker {
          margin-bottom: 3px;
          color: var(--google-blue);
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .registration-guide .guide-title {
          color: var(--primary-text-color);
          font-size: 16px;
          font-weight: 800;
          line-height: 1.35;
        }

        .registration-guide .guide-title strong {
          color: var(--google-blue);
        }

        .registration-guide .guide-copy p {
          margin: 4px 0 0;
          color: var(--secondary-text-color);
          font-size: 14px;
          line-height: 1.45;
        }

        .registration-guide .join-label {
          color: var(--primary-text-color);
          font-family: var(--font-mono, monospace);
          font-size: 0.95em;
          font-weight: 800;
          white-space: nowrap;
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
            align-items: flex-start;
          }

          .close-embed-btn {
            width: 100%;
            justify-content: center;
          }

          .registration-guide {
            margin-top: 16px;
            margin-bottom: 18px;
            padding: 13px 14px;
          }

          .registration-guide .guide-title {
            font-size: 15px;
          }

          .registration-guide .guide-copy p {
            font-size: 13px;
          }
        }
      </style>

      <section hidden$="[[!enabled]]">
        <div class="embed-top-bar">
          <div class="active-selection">
            <template is="dom-if" if="[[selectedTicketName]]">
              <span>🎟️ Selected ticket: <strong>[[selectedTicketName]]</strong></span>
            </template>
            <template is="dom-if" if="[[!selectedTicketName]]">
              <span>🎟️ <strong>All tickets</strong> available in form</span>
            </template>
          </div>
          <button type="button" class="close-embed-btn" on-click="handleClose">▲ Close form</button>
        </div>

        <div class="header">
          <h2>[[eveneaEmbed.title]]</h2>
          <p class="description">[[eveneaEmbed.description]]</p>
        </div>
        <div class="registration-guide" role="status" aria-live="polite">
          <template is="dom-if" if="[[selectedTicketId]]">
            <div class="step-number">2</div>
            <div class="guide-copy">
              <div class="guide-kicker">Next step</div>
              <div class="guide-title">
                Your <strong>[[selectedTicketName]]</strong> ticket is ready below.
              </div>
              <p>Complete your details and continue in the Evenea form.</p>
            </div>
          </template>
          <template is="dom-if" if="[[!selectedTicketId]]">
            <div class="step-number">1</div>
            <div class="guide-copy">
              <div class="guide-kicker">Start here</div>
              <div class="guide-title">Choose your ticket in the Evenea form below.</div>
              <p>
                Set the quantity, then click
                <span class="join-label">JOIN / DOŁĄCZAM!</span> to continue.
              </p>
            </div>
          </template>
        </div>
        <template is="dom-if" if="[[hasBeenOpened]]">
          <template is="dom-if" if="[[published]]">
            <iframe
              id="ticketFrame"
              src$="[[registrationSrc]]"
              title="Evenea registration"
              scrolling="auto"
              loading="lazy"
              referrerpolicy="strict-origin-when-cross-origin"
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

  @property({ type: String })
  selectedTicketName = '';

  @property({ type: String })
  selectedTicketId = '';

  @computed('selectedTicketId')
  private get registrationSrc() {
    if (!this.selectedTicketId) {
      return eveneaEmbed.iframeSrc;
    }

    const registrationUrl = new URL(eveneaEmbed.iframeSrc);
    registrationUrl.searchParams.set(`ticket[${this.selectedTicketId}]`, '1');
    return registrationUrl.toString();
  }

  override connectedCallback() {
    super.connectedCallback();
    if (this.opened && this.enabled && this.published && eveneaEmbed.resizerScriptSrc) {
      this.loadResizerScript();
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

    resizerWindow.iFrameResize(
      {
        checkOrigin: false,
        heightCalculationMethod: 'bodyOffset',
        scrolling: false,
      },
      frame,
    );
  };
}
