import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getAnalyticsConsent, setAnalyticsConsent } from '../utils/analytics';

@customElement('cookie-consent')
export class CookieConsent extends LitElement {
  static override styles = css`
    :host {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 1000;
      color: var(--terminal-copy, #f7f7f7);
      font-family: var(--font-mono, monospace);
    }

    .panel {
      width: min(620px, calc(100vw - 32px));
      box-sizing: border-box;
      padding: 20px;
      border: 1px solid var(--google-green, #34a853);
      border-radius: 4px;
      background: var(--terminal-panel, #202124);
      box-shadow: 0 8px 28px rgb(0 0 0 / 35%);
    }

    h2 {
      margin: 0 0 8px;
      color: var(--google-yellow, #fbbc04);
      font-size: 16px;
      line-height: 1.3;
    }

    p {
      margin: 0;
      color: var(--terminal-copy, #f7f7f7);
      font-size: 13px;
      line-height: 1.55;
    }

    a {
      color: var(--google-blue, #8ab4f8);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }

    button {
      min-height: 40px;
      padding: 8px 14px;
      border: 1px solid var(--google-green, #34a853);
      border-radius: 3px;
      background: var(--google-green, #34a853);
      color: #102217;
      cursor: pointer;
      font: inherit;
      font-weight: 700;
    }

    button.secondary {
      border-color: var(--divider-color, #5f6368);
      background: transparent;
      color: var(--terminal-copy, #f7f7f7);
    }

    button:focus-visible,
    a:focus-visible {
      outline: 2px solid var(--google-yellow, #fbbc04);
      outline-offset: 3px;
    }

    .settings {
      padding: 7px 10px;
      border-color: var(--divider-color, #5f6368);
      background: var(--terminal-panel, #202124);
      color: var(--terminal-copy, #f7f7f7);
      box-shadow: 0 4px 16px rgb(0 0 0 / 25%);
      font-size: 12px;
    }

    @media (max-width: 640px) {
      :host {
        right: 8px;
        bottom: 8px;
      }

      .panel {
        width: calc(100vw - 16px);
        padding: 16px;
      }

      .actions {
        flex-direction: column;
      }

      button {
        width: 100%;
      }
    }
  `;

  @state()
  private consent = getAnalyticsConsent();

  @state()
  private settingsOpen = this.consent === null;

  override render() {
    if (!this.settingsOpen) {
      return html`
        <button class="settings" type="button" @click=${this.openSettings}>Cookie settings</button>
      `;
    }

    return html`
      <section
        class="panel"
        role="dialog"
        aria-labelledby="cookie-consent-title"
        aria-live="polite"
      >
        <h2 id="cookie-consent-title">Privacy & analytics</h2>
        <p>
          We use Google Analytics to understand which pages are useful and improve the event
          website. Analytics cookies are loaded only after you allow them. Read more in
          <a href="/privacy">Privacy & data</a>.
        </p>
        <div class="actions">
          <button type="button" @click=${() => this.choose('granted')}>Allow analytics</button>
          <button class="secondary" type="button" @click=${() => this.choose('denied')}>
            Decline analytics
          </button>
        </div>
      </section>
    `;
  }

  private openSettings() {
    this.settingsOpen = true;
  }

  private async choose(consent: 'granted' | 'denied') {
    this.consent = consent;
    this.settingsOpen = false;
    await setAnalyticsConsent(consent);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cookie-consent': CookieConsent;
  }
}
