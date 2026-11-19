import { customElement, property } from '@polymer/decorators';
import '@polymer/paper-fab';
import { html, PolymerElement } from '@polymer/polymer';
import '../utils/icons';
import { scrollToTop } from '../utils/scrolling';
import { isAgendaPreviewEnabled } from '../utils/agenda-preview-mode';
import '../components/footer-nav';
import './footer-rel';
import './footer-social';

@customElement('footer-block')
export class FooterBlock extends PolymerElement {
  static get template() {
    return html`
      <style include="shared-styles flex flex-alignment positioning">
        :host {
          margin-top: 40px;
          display: block;
          position: relative;
          border-top: 1px solid var(--divider-color);
          color: var(--footer-text-color);
          background: var(--footer-background-color);
          font-family: var(--font-mono, monospace);
          font-size: 14px;
          line-height: 1.5;
        }

        .container {
          margin: 0 auto;
          padding: 20px 0 calc(20px + var(--footer-countdown-space, 0px));
          position: relative;
        }

        .fab paper-fab {
          background: var(--primary-background-color);
          color: inherit;
          pointer-events: all;
          cursor: pointer;
          min-width: 56px;
          min-height: 56px;
          transition:
            transform var(--animation),
            color var(--animation),
            box-shadow var(--animation);
          box-shadow:
            0 0 8px 0 rgba(0, 0, 0, 0.12),
            0 8px 8px 0 rgba(0, 0, 0, 0.24);
        }

        .fab paper-fab:hover {
          color: var(--google-green);
          transform: translateY(-2px);
          box-shadow:
            0 0 12px 0 rgba(52, 168, 83, 0.35),
            0 8px 12px 0 rgba(0, 0, 0, 0.35);
        }

        .fab paper-fab:focus-visible {
          outline: 2px solid var(--google-blue);
          outline-offset: 3px;
        }

        .footer-token {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          margin: 12px 20px 4px;
          border: 1px solid #998ca7;
          border-radius: 8px;
          color: #302840;
          background: linear-gradient(130deg, #c4cedb, #ddc5d5 48%, #bdd8cc);
          transform: rotate(-5deg);
          text-decoration: none;
        }
        .footer-token:hover {
          transform: rotate(0deg);
        }
        .footer-token:focus-visible {
          outline: 3px solid #eaf87f;
          outline-offset: 4px;
        }

        .fab {
          position: absolute;
          right: 25px;
          top: -25px;
          pointer-events: none;
          z-index: 1;
        }

        .cookie-settings {
          display: none;
          min-height: 44px;
          margin: 12px 16px 0;
          padding: 8px 12px;
          border: 1px solid var(--divider-color);
          border-radius: 3px;
          background: var(--terminal-panel);
          color: var(--terminal-copy);
          font: inherit;
          font-size: 12px;
          cursor: pointer;
        }

        .cookie-settings:focus-visible {
          outline: 2px solid var(--google-blue);
          outline-offset: 3px;
        }

        @media (max-width: 640px) {
          .cookie-settings:not([hidden]) {
            display: inline-flex;
            align-items: center;
          }
        }

        @media (min-width: 640px) {
          .container {
            padding: 15px 36px calc(15px + var(--footer-countdown-space, 0px));
          }
        }
      </style>

      <div class="container">
        <div class="fab">
          <paper-fab
            class="back-to-top"
            icon="hoverboard:up"
            aria-label="Back to top"
            role="button"
            tabindex="0"
            on-click="backToTop"
          ></paper-fab>
        </div>
        <footer-social layout flex flex-auto horizontal wrap></footer-social>
        <a class="footer-token" href="/hunt/c/f00t3rx/" aria-label="Inspect the floppy disk">
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" focusable="false">
            <path d="M6 3h17l6 6v20H3V3z" fill="none" stroke="currentColor" stroke-width="2" />
            <path
              d="M9 3v10h13V3M8 29V18h16v11M17 5v5"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            />
          </svg>
        </a>
        <footer-rel></footer-rel>
        <footer-nav layout horizontal wrap justified center></footer-nav>
        <button
          class="cookie-settings"
          type="button"
          hidden$="[[hideCookieSettings]]"
          on-click="openCookieSettings"
        >
          Cookie settings
        </button>
      </div>
    `;
  }

  @property({ type: Boolean })
  private hideCookieSettings = isAgendaPreviewEnabled(window.location.hostname);

  override connectedCallback() {
    super.connectedCallback();
    window.dispatchEvent(
      new CustomEvent('devfest-cookie-footer', { detail: { footer: this, mounted: true } }),
    );
  }

  override disconnectedCallback() {
    window.dispatchEvent(
      new CustomEvent('devfest-cookie-footer', { detail: { footer: this, mounted: false } }),
    );
    super.disconnectedCallback();
  }

  private openCookieSettings() {
    const trigger = this.shadowRoot?.querySelector<HTMLElement>('.cookie-settings');
    window.dispatchEvent(new CustomEvent('devfest-cookie-settings', { detail: { trigger } }));
  }

  backToTop() {
    scrollToTop();
  }
}
