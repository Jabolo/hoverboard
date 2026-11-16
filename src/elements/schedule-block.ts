import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { ThemedElement } from '../components/themed-element';
import { scheduleBlock } from '../utils/data';
import agenda from '../../public/data/agenda-2026.json';

const firstSession = agenda.items
  .filter(({ kind }) => kind === 'session' || kind === 'workshop')
  .sort((a, b) => a.start.localeCompare(b.start))[0];
const highlights = [
  { item: agenda.items.find(({ id }) => id === 'registration'), label: 'Registration' },
  { item: firstSession, label: 'Sessions begin' },
  { item: agenda.items.find(({ id }) => id === 'networking'), label: 'Networking' },
];

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
          padding-top: 40px;
          padding-bottom: 40px;
        }
        .heading-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }
        h2 {
          margin: 0;
          color: var(--primary-text-color);
          font-family: var(--font-mono, monospace);
          font-size: clamp(28px, 4vw, 40px);
          letter-spacing: -0.025em;
          line-height: 1.1;
        }
        .highlights {
          display: flex;
          flex-wrap: wrap;
          gap: 16px 32px;
          margin: 24px 0 0;
          padding: 0;
          list-style: none;
        }
        li {
          display: flex;
          align-items: baseline;
          gap: 12px;
        }
        time {
          color: var(--terminal-green);
          font-family: var(--font-mono, monospace);
          font-size: 20px;
          font-weight: 700;
        }
        .label {
          color: var(--terminal-copy);
          font-size: 16px;
        }
        .schedule-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
          padding: 0 18px;
          border: 1px solid var(--google-blue);
          border-radius: 4px;
          color: var(--primary-text-color);
          font-weight: 700;
          text-decoration: none;
        }
        .schedule-link:hover {
          background: var(--secondary-background-color);
        }
        .schedule-link:focus-visible {
          outline: 2px solid var(--google-blue);
          outline-offset: 4px;
        }
        @media (max-width: 600px) {
          .highlights {
            flex-direction: column;
            gap: 12px;
          }
        }
      `,
    ];
  }

  override render() {
    return html`
      <section id="schedule" class="container" aria-labelledby="schedule-title">
        <div class="heading-row">
          <h2 id="schedule-title">${scheduleBlock.title}</h2>
          <a class="schedule-link" href="/schedule/">View full schedule →</a>
        </div>
        <ul class="highlights" aria-label="Day highlights, Warsaw time">
          ${highlights.map(({ item, label }) =>
            item
              ? html`<li>
                  <time datetime=${`${agenda.date}T${item.start}`}>${item.start}</time>
                  <span class="label">${label}</span>
                </li>`
              : null,
          )}
        </ul>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'schedule-block': ScheduleBlock;
  }
}
