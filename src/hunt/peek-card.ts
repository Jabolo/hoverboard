import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

@customElement('hunt-peek-card')
export class HuntPeekCard extends LitElement {
  @state() private open = false;
  @state() private drag = 0;
  private start: { x: number; y: number; id: number; open: boolean } | undefined;
  private dragged = false;
  private suppressClick = false;

  static override styles = css`
    :host {
      position: relative;
      margin: 8px 0 8px auto;
      z-index: 1;
      display: block;
      width: min(300px, calc(100vw - 12px));
      overflow: hidden;
      pointer-events: none;
      padding: 6px 0 12px 6px;
      box-sizing: border-box;
    }
    .card {
      display: flex;
      align-items: stretch;
      max-height: 56px;
      overflow: hidden;
      background: linear-gradient(125deg, #ffefd3, #dcc9e7 53%, #b8e9d8);
      color: #211830;
      border: 1px solid #fff8ec;
      border-radius: 14px 0 0 14px;
      box-shadow: 0 2px 0 #291a3e;
      pointer-events: auto;
      transition: transform 200ms ease-out;
    }
    .card:not(.open) button {
      height: 56px;
      align-self: flex-start;
    }
    .card.open {
      max-height: 320px;
    }
    .dragging {
      transition: none;
    }
    button {
      cursor: grab;
      touch-action: pan-y;
      flex: 0 0 44px;
      border: 0;
      border-radius: 14px 0 0 14px;
      color: #211830;
      background: transparent;
      padding: 8px 4px;
      font:
        700 12px 'Trebuchet MS',
        sans-serif;
      width: 44px;
      min-width: 44px;
      min-height: 56px;
    }
    .divider {
      flex: 0 0 1px;
      width: 1px;
      background: #8a7697;
      align-self: stretch;
    }
    button:active {
      cursor: grabbing;
    }
    .eyes {
      display: block;
      font-size: 16px;
      margin-bottom: 2px;
    }
    .copy {
      flex: 1;
      min-width: 0;
      padding: 18px 16px;
      font:
        14px/1.45 'Trebuchet MS',
        sans-serif;
    }
    strong {
      display: block;
      font-size: 19px;
    }
    p {
      margin: 9px 0;
    }
    a {
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px 10px;
      box-sizing: border-box;
      border-radius: 6px;
      background: #291a3e;
      color: #fff8ec;
      text-decoration: none;
      font-weight: 700;
    }
    :is(button, a):focus-visible {
      outline: 3px solid #5b2d88;
      outline-offset: -4px;
    }
    @media (prefers-reduced-motion: reduce) {
      .card {
        transition: none;
      }
    }
  `;

  private toggle = () => {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    this.open = !this.open;
    this.drag = 0;
  };
  private down = (event: PointerEvent) => {
    if (event.button !== 0) return;
    this.start = { x: event.clientX, y: event.clientY, id: event.pointerId, open: this.open };
    this.dragged = false;
    this.suppressClick = false;
  };
  private move = (event: PointerEvent) => {
    if (!this.start || event.pointerId !== this.start.id) return;
    const dx = event.clientX - this.start.x;
    const dy = event.clientY - this.start.y;
    if (!this.dragged && Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
      this.start = undefined;
      return;
    }
    if (!this.dragged && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      this.dragged = true;
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }
    if (this.dragged) this.drag = Math.max(-210, Math.min(210, dx));
  };
  private up = () => {
    if (this.start && this.dragged) {
      this.open = this.start.open ? this.drag < 45 : this.drag < -45;
      this.suppressClick = true;
    }
    this.start = undefined;
    this.dragged = false;
    this.drag = 0;
  };
  private cancel = () => {
    this.start = undefined;
    this.dragged = false;
    this.drag = 0;
  };
  private key = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.open = false;
      this.drag = 0;
      this.renderRoot.querySelector<HTMLButtonElement>('button')?.focus();
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.open = true;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.open = false;
    }
  };
  override render() {
    const offset = this.open
      ? `clamp(0px, ${this.drag}px, calc(100% - 44px))`
      : `clamp(0px, calc(100% - 44px + ${this.drag}px), calc(100% - 44px))`;
    return html`<aside
      class="card ${this.open ? 'open' : ''} ${this.dragged ? 'dragging' : ''}"
      style=${`transform:translateX(${offset})`}
      @keydown=${this.key}
      aria-label="Peeking holographic card"
    >
      <button
        aria-expanded=${this.open}
        aria-controls="peek-details"
        aria-label=${this.open ? 'Hide the peeking card' : 'Pull out the peeking card'}
        @click=${this.toggle}
        @pointerdown=${this.down}
        @pointermove=${this.move}
        @pointerup=${this.up}
        @pointercancel=${this.cancel}
      >
        <span class="eyes" aria-hidden="true">👀</span>${this.open ? '→' : '↖'}
      </button>
      <span class="divider" aria-hidden="true"></span>
      <div id="peek-details" class="copy" ?inert=${!this.open}>
        <strong>Psst. I’m not a popup.</strong>
        <p>I’m just a very shy browser tab. You found my hiding spot.</p>
        <a href="/hunt/c/p3ek7up/" tabindex=${this.open ? 0 : -1}>Scratch the shy tab ↗</a>
      </div>
    </aside>`;
  }
}
