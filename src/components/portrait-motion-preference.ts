import { css, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';

/** Honour live system motion preferences without adding a visible portrait control. */
@customElement('portrait-motion-preference')
export class PortraitMotionPreference extends LitElement {
  private preference?: MediaQueryList;
  private onPreferenceChange = () => {
    this.dispatchEvent(
      new CustomEvent('portrait-motion-change', {
        detail: { paused: !!this.preference?.matches },
        bubbles: true,
        composed: true,
      }),
    );
  };

  static override styles = css`
    :host {
      display: none;
    }
  `;

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

  override render() {
    return nothing;
  }
}
