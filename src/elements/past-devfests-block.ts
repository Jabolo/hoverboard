import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { pastDevFestsBlock } from '../utils/data';
import { ThemedElement } from '../components/themed-element';

@customElement('past-devfests-block')
export class PastDevFestsBlock extends ThemedElement {
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
          padding-top: 76px;
          padding-bottom: 56px;
        }

        .kicker {
          position: absolute;
          top: 28px;
          left: 16px;
          color: var(--terminal-green);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .intro {
          max-width: 720px;
        }

        p {
          color: var(--secondary-text-color);
          line-height: 1.7;
        }

        .archive-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 32px;
        }

        .archive-card {
          display: grid;
          align-content: space-between;
          gap: 18px;
          min-height: 136px;
          padding: 16px;
          border: 1px solid var(--divider-color);
          border-radius: var(--border-radius);
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
          text-decoration: none;
          transition:
            border-color var(--animation),
            box-shadow var(--animation),
            transform var(--animation);
        }

        .archive-card:hover {
          border-color: var(--google-blue);
          box-shadow: var(--box-shadow-primary-color);
          transform: translateY(-2px);
        }

        .year {
          color: var(--google-yellow);
          font-family: var(--font-mono, monospace);
          font-size: 28px;
          font-weight: 800;
          line-height: 1;
        }

        .name {
          color: var(--terminal-copy, var(--primary-text-color));
          font-family: var(--font-mono, monospace);
          font-size: 14px;
          font-weight: 700;
          line-height: 1.35;
        }

        .link-label {
          color: var(--google-blue);
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        @media (min-width: 768px) {
          .archive-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 420px) {
          .archive-grid {
            grid-template-columns: 1fr;
          }
        }
      `,
    ];
  }

  override render() {
    return html`
      <div class="container">
        <span class="kicker">${pastDevFestsBlock.kicker}</span>
        <div class="intro">
          <h2 class="container-title">${pastDevFestsBlock.title}</h2>
          <p>${pastDevFestsBlock.description}</p>
        </div>

        <div class="archive-grid" aria-label="Past DevFests">
          ${pastDevFestsBlock.events.map(
            (event) => html`
              <a class="archive-card" href="${event.url}" target="_blank" rel="noopener noreferrer">
                <span class="year">${event.year}</span>
                <span class="name">${event.name}</span>
                <span class="link-label">Open event ↗</span>
              </a>
            `,
          )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'past-devfests-block': PastDevFestsBlock;
  }
}
