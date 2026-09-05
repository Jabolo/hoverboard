import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { startDate, title } from '../utils/data';

const SECOND = 1000;
const MINUTE = SECOND * 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;

export interface CountdownValues {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  complete: boolean;
}

export const getCountdownValues = (now: number, target: number): CountdownValues => {
  const remaining = Math.max(0, target - now);

  return {
    days: Math.floor(remaining / DAY),
    hours: Math.floor((remaining % DAY) / HOUR),
    minutes: Math.floor((remaining % HOUR) / MINUTE),
    seconds: Math.floor((remaining % MINUTE) / SECOND),
    complete: remaining === 0,
  };
};

const pad = (value: number) => value.toString().padStart(2, '0');

@customElement('event-countdown')
export class EventCountdown extends LitElement {
  static override styles = css`
    :host {
      color: inherit;
      display: block;
      width: min(100%, 560px);
      margin: 28px auto 0;
      padding: 14px;
      border: 1px solid var(--terminal-line, #263d5e);
      border-radius: 8px;
      background: rgb(7 12 20 / 64%);
    }

    .countdown-kicker {
      margin: 0 0 10px;
      color: inherit;
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.08em;
      line-height: 1.4;
      opacity: 0.86;
      text-transform: uppercase;
    }

    .timer {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }

    .unit {
      min-width: 0;
      padding: 10px 8px 0;
      border-top: 2px solid var(--google-blue, #4285f4);
    }

    .unit[data-tone='green'] {
      border-top-color: var(--google-green, #34a853);
    }

    .unit[data-tone='yellow'] {
      border-top-color: var(--google-yellow, #f9ab00);
    }

    .unit[data-tone='red'] {
      border-top-color: var(--google-red, #ea4335);
    }

    .value {
      display: block;
      color: inherit;
      font-family: var(--font-mono, monospace);
      font-size: clamp(24px, 5vw, 40px);
      font-variant-numeric: tabular-nums;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1;
    }

    .label {
      display: block;
      margin-top: 7px;
      color: inherit;
      font-size: 11px;
      line-height: 1.2;
      opacity: 0.86;
    }

    .complete {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    @media (max-width: 480px) {
      :host {
        margin-top: 20px;
      }

      .timer {
        gap: 5px;
      }

      .unit {
        padding: 8px 4px 0;
      }

      .value {
        font-size: clamp(22px, 8vw, 32px);
      }

      .label {
        font-size: 10px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .value {
        transition: none;
      }
    }
  `;

  private readonly target = Date.parse(startDate);
  private values = getCountdownValues(Date.now(), this.target);
  private timer: number | undefined;

  override connectedCallback() {
    super.connectedCallback();
    this.updateValues();
    if (!this.values.complete) {
      this.timer = window.setInterval(() => this.updateValues(), SECOND);
    }
  }

  override disconnectedCallback() {
    if (this.timer !== undefined) {
      window.clearInterval(this.timer);
      this.timer = undefined;
    }
    super.disconnectedCallback();
  }

  override render() {
    if (this.values.complete) {
      return html` <p class="complete" role="status">${title} is happening today.</p> `;
    }

    const accessibleLabel = `${this.values.days} days, ${this.values.hours} hours, ${this.values.minutes} minutes, and ${this.values.seconds} seconds until ${title}`;

    return html`
      <p class="countdown-kicker" id="countdown-title">Countdown to ${title}</p>
      <div
        class="timer"
        role="timer"
        aria-labelledby="countdown-title"
        aria-label=${accessibleLabel}
      >
        ${this.renderUnit(this.values.days, 'Days', 'blue')}
        ${this.renderUnit(this.values.hours, 'Hours', 'green')}
        ${this.renderUnit(this.values.minutes, 'Minutes', 'yellow')}
        ${this.renderUnit(this.values.seconds, 'Seconds', 'red')}
      </div>
    `;
  }

  private renderUnit(value: number, label: string, tone: string) {
    return html`
      <div class="unit" data-tone=${tone}>
        <span class="value">${pad(value)}</span>
        <span class="label">${label}</span>
      </div>
    `;
  }

  private updateValues() {
    this.values = getCountdownValues(Date.now(), this.target);
    this.requestUpdate();

    if (this.values.complete && this.timer !== undefined) {
      window.clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
