import { css, html, nothing } from 'lit';
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
          padding-top: 48px;
          padding-bottom: 48px;
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
          grid-template-columns: minmax(0, 1fr);
          margin-top: 24px;
          border-top: 1px solid var(--divider-color);
        }

        .archive-card {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 4px 12px;
          min-height: 68px;
          padding: 12px 4px;
          border-bottom: 1px solid var(--divider-color);
          color: var(--primary-text-color);
          text-decoration: none;
        }

        .archive-card:hover .name {
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .archive-card:focus-visible {
          outline: 2px solid var(--google-blue);
          outline-offset: 2px;
        }

        .card-meta {
          display: flex;
          align-items: baseline;
          gap: 12px;
        }

        .year {
          color: var(--google-yellow);
          font-family: var(--font-mono, monospace);
          font-size: 16px;
          font-weight: 800;
          line-height: 1;
        }

        .speakers-badge {
          color: var(--secondary-text-color);
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.02em;
        }

        .name {
          color: var(--terminal-copy, var(--primary-text-color));
          font-size: 14px;
          font-weight: 600;
          line-height: 1.35;
        }

        .link-label {
          color: var(--google-blue);
          font-family: var(--font-mono, monospace);
          grid-column: 2;
          grid-row: 1 / span 2;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        @media (min-width: 768px) {
          .archive-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            column-gap: 32px;
          }
        }
      `,
    ];
  }

  override render() {
    return html`
      <div class="container">
        <div class="intro">
          <h2 class="container-title">${pastDevFestsBlock.title}</h2>
          <p>${pastDevFestsBlock.description}</p>
        </div>

        <div class="archive-grid" aria-label="Past DevFests">
          ${pastDevFestsBlock.events.map(
            (event) => html`
              <a class="archive-card" href="${event.url}" target="_blank" rel="noopener noreferrer">
                <div class="card-meta">
                  <span class="year">${event.year}</span>
                  ${
                    'speakers' in event && event.speakers
                      ? html`<span class="speakers-badge">${event.speakers} speakers</span>`
                      : nothing
                  }
                </div>
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
