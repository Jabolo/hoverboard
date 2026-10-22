import { css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ThemedElement } from './themed-element';

/** The control stays outside portrait links; motion preference changes apply immediately. */
@customElement('portrait-animation-control')
export class PortraitAnimationControl extends ThemedElement {
  @property({ type: Boolean }) paused = false;
  @state() private reducedMotion = false;
  private preference?: MediaQueryList;
  private onPreferenceChange = () => {
    this.reducedMotion = !!this.preference?.matches;
    if (this.reducedMotion) this.paused = true;
    this.announce();
  };

  static override get styles() {
    return [
      ...super.styles,
      css`
        :host {
          display: block;
          margin-top: 8px;
        }
        button {
          min-height: 44px;
          padding: 8px 12px;
          border: 1px solid var(--terminal-line);
          border-radius: 4px;
          background: transparent;
          color: var(--terminal-muted);
          font: inherit;
          font-size: 12px;
          cursor: pointer;
        }
        button:hover {
          color: var(--terminal-copy);
          border-color: var(--google-blue);
        }
        button:focus-visible {
          outline: 2px solid var(--google-blue);
          outline-offset: 3px;
        }
      `,
    ];
  }

  override connectedCallback() {
    super.connectedCallback();
    this.preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.preference?.addEventListener('change', this.onPreferenceChange);
    this.onPreferenceChange();
  }

  override disconnectedCallback() {
    this.preference?.removeEventListener('change', this.onPreferenceChange);
    super.disconnectedCallback();
  }

  private announce() {
    this.dispatchEvent(
      new CustomEvent('portrait-motion-change', {
        detail: { paused: this.paused },
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render() {
    if (this.reducedMotion) return nothing;
    return html`<button
      type="button"
      @click=${() => {
        this.paused = !this.paused;
        this.announce();
      }}
      aria-label=${this.paused ? 'Play portrait animation' : 'Pause portrait animation'}
    >
      ${this.paused ? 'Play portrait' : 'Pause portrait'}
    </button>`;
  }
}
