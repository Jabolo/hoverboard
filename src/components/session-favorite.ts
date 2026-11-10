import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  isSessionFavorite,
  setSessionFavorite,
  subscribeSessionFavorites,
} from '../utils/session-favorites';

/** A session-scoped heart shared across the site, without requiring an account. */
@customElement('session-favorite')
export class SessionFavorite extends LitElement {
  @property({ type: String, attribute: 'session-id' }) sessionId = '';
  @property({ type: String, attribute: 'session-title' }) sessionTitle = '';
  @state() private storageFailed = false;
  private unsubscribe: (() => void) | undefined;

  static override styles = css`
    :host {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      flex: 0 0 auto;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      padding: 0;
      border: 1px solid transparent;
      border-radius: 10px;
      background: transparent;
      color: var(--terminal-muted, #9bb0d0);
      cursor: pointer;
    }
    button:hover {
      color: #f6a6bb;
      background: var(--terminal-panel-raised, #112039);
    }
    button[aria-pressed='true'] {
      color: #f294af;
    }
    button:focus-visible {
      outline: 3px solid var(--terminal-blue, #8bb9ff);
      outline-offset: 2px;
    }
    button:disabled {
      cursor: default;
      opacity: 0.5;
    }
    svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    button[aria-pressed='true'] svg {
      fill: currentColor;
    }
    .notice {
      max-width: 180px;
      color: #ffe1a0;
      font: 12px/1.4 var(--default-font-family, sans-serif);
      text-align: center;
    }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    this.unsubscribe = subscribeSessionFavorites(() => this.requestUpdate());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  private readonly toggleFavorite = (): void => {
    this.storageFailed = !setSessionFavorite(this.sessionId, !isSessionFavorite(this.sessionId));
  };

  override render() {
    const selected = isSessionFavorite(this.sessionId);
    const title = this.sessionTitle || 'session';
    const label = selected ? `Remove ${title} from saved sessions` : `Save ${title} to my sessions`;
    return html`
      <button
        type="button"
        aria-label=${label}
        aria-pressed=${selected ? 'true' : 'false'}
        ?disabled=${!this.sessionId}
        @click=${this.toggleFavorite}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M20.8 4.9a5.5 5.5 0 0 0-7.8 0L12 6l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.3a5.5 5.5 0 0 0 0-7.8Z"
          ></path>
        </svg>
      </button>
      ${
        this.storageFailed
          ? html`<span class="notice" role="status"
              >Could not save on this device. Your change lasts for this visit only.</span
            >`
          : nothing
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-favorite': SessionFavorite;
  }
}
