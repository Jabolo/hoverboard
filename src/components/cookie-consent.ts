import { LitElement, css, html, type PropertyValues } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getAnalyticsConsent, setAnalyticsConsent } from '../utils/analytics';
import { isAgendaPreviewEnabled } from '../utils/agenda-preview-mode';

@customElement('cookie-consent')
export class CookieConsent extends LitElement {
  static override styles = css`
    :host {
      position: fixed;
      right: 16px;
      bottom: calc(16px + var(--countdown-offset, 0px));
      z-index: 1000;
      color: var(--terminal-copy, #f7f7f7);
      font-family: var(--font-mono, monospace);
    }

    :host(:not([dialog-open])) {
      right: auto;
      left: 16px;
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
        bottom: calc(8px + var(--countdown-offset, 0px));
      }

      :host(:not([dialog-open])) {
        right: auto;
        left: 8px;
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

      /* The mounted page footer provides the same control without covering content. */
      :host([data-cookie-footer]) .settings {
        display: none;
      }
    }
  `;

  @state()
  private consent = getAnalyticsConsent();

  @state()
  private settingsOpen = this.consent === null;

  private readonly mountedFooters = new Set<HTMLElement>();
  private returnFocusTo: HTMLElement | null = null;
  private restoreFocusOnClose = false;

  private readonly onFooterAvailability = (event: Event) => {
    if (isAgendaPreviewEnabled(window.location.hostname)) return;
    const detail = (event as CustomEvent<{ footer: HTMLElement; mounted: boolean }>).detail;
    if (!detail?.footer) return;
    if (detail.mounted) this.mountedFooters.add(detail.footer);
    else this.mountedFooters.delete(detail.footer);
    this.toggleAttribute('data-cookie-footer', this.mountedFooters.size > 0);
  };

  private readonly onFooterSettings = (event: Event) => {
    if (this.hidden) return;
    const trigger = (event as CustomEvent<{ trigger?: HTMLElement }>).detail?.trigger;
    void this.openSettings(trigger);
  };

  private readonly onSettingsClick = () => {
    void this.openSettings(this.shadowRoot?.querySelector<HTMLButtonElement>('button.settings'));
  };

  override connectedCallback() {
    super.connectedCallback();
    this.toggleAttribute('dialog-open', this.settingsOpen);
    window.addEventListener('devfest-cookie-footer', this.onFooterAvailability);
    window.addEventListener('devfest-cookie-settings', this.onFooterSettings);
    // The page may already have mounted before this component connected.
    const root = this.getRootNode();
    if (root instanceof ShadowRoot && !isAgendaPreviewEnabled(window.location.hostname)) {
      const page = root.querySelector('main')?.firstElementChild;
      const footer = page?.shadowRoot?.querySelector<HTMLElement>('footer-block');
      if (footer?.isConnected) {
        this.mountedFooters.add(footer);
        this.toggleAttribute('data-cookie-footer', true);
      }
    }
  }

  override disconnectedCallback() {
    window.removeEventListener('devfest-cookie-footer', this.onFooterAvailability);
    window.removeEventListener('devfest-cookie-settings', this.onFooterSettings);
    this.mountedFooters.clear();
    this.removeAttribute('data-cookie-footer');
    this.removeAttribute('dialog-open');
    super.disconnectedCallback();
  }

  override updated(changedProperties: PropertyValues<this>) {
    super.updated(changedProperties);
    if ((changedProperties as Map<string, unknown>).has('settingsOpen')) {
      this.toggleAttribute('dialog-open', this.settingsOpen);
    }
  }

  override render() {
    if (!this.settingsOpen) {
      return html`
        <button class="settings" type="button" @click=${this.onSettingsClick}>
          Cookie settings
        </button>
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

  private async openSettings(trigger?: HTMLElement | null) {
    this.returnFocusTo = trigger ?? null;
    this.restoreFocusOnClose = true;
    this.settingsOpen = true;
    await this.updateComplete;
    this.shadowRoot?.querySelector<HTMLButtonElement>('.actions button')?.focus();
  }

  private async choose(consent: 'granted' | 'denied') {
    this.consent = consent;
    this.settingsOpen = false;
    await this.updateComplete;
    const target = this.returnFocusTo;
    const restoreFocus = this.restoreFocusOnClose;
    this.returnFocusTo = null;
    this.restoreFocusOnClose = false;
    if (restoreFocus) {
      const footer = [...this.mountedFooters].find((item) => item.isConnected);
      const footerButton = footer?.shadowRoot?.querySelector<HTMLButtonElement>('.cookie-settings');
      if (target?.isConnected && getComputedStyle(target).display !== 'none') target.focus();
      else if (footerButton && getComputedStyle(footerButton).display !== 'none')
        footerButton.focus();
      else this.shadowRoot?.querySelector<HTMLButtonElement>('button.settings')?.focus();
    }
    await setAnalyticsConsent(consent);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cookie-consent': CookieConsent;
  }
}
