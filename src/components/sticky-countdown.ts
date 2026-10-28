import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { startDate, title } from '../utils/data';
import { getCountdownValues } from './event-countdown';

@customElement('sticky-countdown')
export class StickyCountdown extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
    .bar {
      position: fixed;
      z-index: 50;
      inset: auto 0 0;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
      background: #10233f;
      border-top: 2px solid #4285f4;
      color: #fff;
      box-shadow: 0 -4px 18px rgb(0 0 0 / 25%);
      transform: translateY(110%);
      visibility: hidden;
      transition:
        transform 220ms ease-out,
        visibility 220ms;
    }
    .bar.visible {
      transform: translateY(0);
      visibility: visible;
    }
    .content {
      display: flex;
      justify-content: center;
      align-items: baseline;
      gap: 20px;
    }
    .intro {
      font-size: 14px;
      font-weight: 600;
    }
    .timer {
      display: flex;
      align-items: baseline;
      gap: 12px;
      font-variant-numeric: tabular-nums;
    }
    .unit {
      white-space: nowrap;
    }
    .number {
      font-family: var(--font-mono, monospace);
      font-size: 22px;
      font-weight: 700;
    }
    .label {
      margin-left: 3px;
      font-size: 12px;
      color: #d4e3fb;
    }
    @media (max-width: 480px) {
      .bar {
        padding: 10px 8px calc(10px + env(safe-area-inset-bottom));
      }
      .content {
        gap: 8px;
        flex-direction: column;
        align-items: center;
      }
      .intro {
        font-size: 12px;
      }
      .timer {
        gap: 10px;
      }
      .number {
        font-size: 19px;
      }
      .label {
        font-size: 11px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .bar {
        transition: none;
      }
    }
  `;

  private readonly target = Date.parse(startDate);
  private values = getCountdownValues(Date.now(), this.target);
  private visible = false;
  private timer: number | undefined;
  private readonly refreshCountdown = () => {
    this.values = getCountdownValues(Date.now(), this.target);
    const home = document
      .querySelector('hoverboard-app')
      ?.shadowRoot?.querySelector('main home-page');
    const heroTimer = home?.shadowRoot?.querySelector('event-countdown');
    this.visible =
      !this.values.complete &&
      (window.location.pathname !== '/' ||
        (heroTimer ? heroTimer.getBoundingClientRect().bottom <= 0 : window.scrollY > 300));
    this.toggleAttribute('active', this.visible);
    this.requestUpdate();
    if (this.values.complete && this.timer !== undefined) {
      window.clearInterval(this.timer);
      this.timer = undefined;
    }
  };

  override connectedCallback() {
    super.connectedCallback();
    this.refreshCountdown();
    window.addEventListener('scroll', this.refreshCountdown, { passive: true, capture: true });
    window.addEventListener('resize', this.refreshCountdown);
    window.addEventListener('vaadin-router-location-changed', this.refreshCountdown);
    if (!this.values.complete) this.timer = window.setInterval(this.refreshCountdown, 1000);
  }

  override disconnectedCallback() {
    window.removeEventListener('scroll', this.refreshCountdown, true);
    window.removeEventListener('resize', this.refreshCountdown);
    window.removeEventListener('vaadin-router-location-changed', this.refreshCountdown);
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined;
    super.disconnectedCallback();
  }

  override render() {
    if (this.values.complete) return nothing;
    const units = [
      [this.values.days, 'd'],
      [this.values.hours, 'h'],
      [this.values.minutes, 'm'],
      [this.values.seconds, 's'],
    ] as const;
    return html`<aside class="bar ${this.visible ? 'visible' : ''}" aria-hidden=${!this.visible}>
      <div class="content">
        <span class="intro">${title} starts in</span>
        <div
          class="timer"
          role="timer"
          aria-label="${this.values.days} days, ${this.values.hours} hours, ${this.values.minutes} minutes, ${this.values.seconds} seconds until ${title}"
        >
          ${units.map(([value, label]) => html`<span class="unit"><span class="number">${String(value).padStart(2, '0')}</span><span class="label">${label}</span></span>`)}
        </div>
      </div>
    </aside>`;
  }
}
