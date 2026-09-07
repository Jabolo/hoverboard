import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { ThemedElement } from '../components/themed-element';
import { scheduleBlock } from '../utils/data';

@customElement('schedule-block')
export class ScheduleBlock extends ThemedElement {
  static override get styles() {
    return [
      ...super.styles,
      css`
        :host {
          display: block;
          border-bottom: 1px solid var(--divider-color);
          background: var(--primary-background-color);
        }

        .container {
          position: relative;
          padding-top: 64px;
          padding-bottom: 48px;
        }

        .kicker {
          position: absolute;
          top: 28px;
          left: 16px;
          color: var(--google-red);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        h2,
        .time,
        .milestone {
          margin: 0;
          font-family: var(--font-mono, monospace);
        }

        h2 {
          color: var(--primary-text-color);
          font-size: clamp(30px, 5vw, 52px);
          letter-spacing: -0.025em;
          line-height: 1.02;
        }

        .intro {
          max-width: 640px;
          margin: 18px 0 0;
          color: var(--secondary-text-color);
          font-size: 17px;
          line-height: 1.7;
        }

        .milestone-row {
          display: grid;
          gap: 14px;
          width: min(100%, 620px);
          margin-top: 28px;
          padding: 14px 0;
          border-top: 1px solid var(--divider-color);
          border-bottom: 1px solid var(--divider-color);
        }

        .time {
          color: var(--terminal-green);
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 0.02em;
          line-height: 1.1;
        }

        .milestone {
          align-self: end;
          color: var(--terminal-copy);
          font-size: 17px;
          font-weight: 700;
          line-height: 1.25;
        }

        .note {
          max-width: 580px;
          margin: 22px 0 0;
          color: var(--terminal-muted);
          font-size: 14px;
          line-height: 1.6;
        }

        @media (min-width: 640px) {
          .milestone-row {
            grid-template-columns: 100px minmax(0, 1fr);
            align-items: end;
            padding: 16px 0;
          }
        }
      `,
    ];
  }

  override render() {
    return html`
      <section id="schedule" class="container" aria-labelledby="schedule-title">
        <span class="kicker">${scheduleBlock.kicker}</span>
        <h2 id="schedule-title">${scheduleBlock.title}</h2>
        <p class="intro">${scheduleBlock.intro}</p>
        <div class="milestone-row" aria-label="Confirmed schedule milestone">
          <p class="time">${scheduleBlock.time}</p>
          <p class="milestone">${scheduleBlock.milestone}</p>
        </div>
        <p class="note">${scheduleBlock.note}</p>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'schedule-block': ScheduleBlock;
  }
}
