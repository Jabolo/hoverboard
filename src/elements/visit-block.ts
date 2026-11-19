import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { ThemedElement } from '../components/themed-element';
import { location, mailto, visitBlock } from '../utils/data';

@customElement('visit-block')
export class VisitBlock extends ThemedElement {
  static override get styles() {
    return [
      ...super.styles,
      css`
        :host {
          display: block;
          border-bottom: 1px solid var(--divider-color);
          background: var(--terminal-panel);
        }

        .container {
          position: relative;
          padding-top: 52px;
          padding-bottom: 52px;
        }

        h2,
        h3 {
          margin: 0;
          font-family: var(--font-mono, monospace);
        }

        h2 {
          max-width: 720px;
          color: var(--primary-text-color);
          font-size: clamp(30px, 5vw, 52px);
          letter-spacing: -0.025em;
          line-height: 1.02;
        }

        .intro {
          max-width: 680px;
          margin: 18px 0 0;
          color: var(--secondary-text-color);
          font-size: 17px;
          line-height: 1.7;
        }

        .intro strong {
          color: var(--terminal-green);
          font-family: var(--font-mono, monospace);
        }

        .details {
          display: grid;
          gap: 0;
          margin-top: 28px;
          border-top: 1px solid var(--divider-color);
        }

        .column {
          padding: 22px 0;
        }

        .column + .column {
          border-top: 1px solid var(--divider-color);
        }

        .explore-copy {
          max-width: 48ch;
          margin: 14px 0 0;
          color: var(--terminal-copy);
          font-size: 16px;
          line-height: 1.65;
        }

        .links {
          display: flex;
          flex-wrap: wrap;
          gap: 0 24px;
        }

        h3 {
          color: var(--terminal-green);
          font-size: 15px;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        ul {
          display: grid;
          gap: 12px;
          margin: 14px 0 0;
          padding-left: 1.25rem;
        }

        li {
          color: var(--terminal-copy);
          font-size: 16px;
          line-height: 1.55;
        }

        li::marker {
          color: var(--google-blue);
        }

        .directions,
        .help {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          margin-top: 16px;
          color: #a9c7ff;
          font-size: 15px;
          font-weight: 700;
          text-decoration: underline;
          text-underline-offset: 4px;
        }

        .directions:hover,
        .help:hover {
          color: var(--primary-text-color);
          text-decoration: underline;
          text-underline-offset: 4px;
        }

        .directions:focus-visible,
        .help:focus-visible {
          outline: 2px solid var(--google-blue);
          outline-offset: 4px;
        }

        @media (min-width: 720px) {
          .container {
            padding-top: 76px;
            padding-bottom: 72px;
          }

          .details {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            column-gap: clamp(40px, 7vw, 96px);
          }

          .column {
            padding: 32px 0 0;
          }

          .column + .column {
            border-top: 0;
          }

          .column.practical {
            grid-column: 1 / -1;
            margin-top: 32px;
            border-top: 1px solid var(--divider-color);
          }
        }
      `,
    ];
  }

  override render() {
    const accessibilityEmail = `mailto:${mailto}?subject=${encodeURIComponent('DevFest Warsaw 2026 - accessibility adjustment')}`;
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location.address)}`;

    return html`
      <section class="container" aria-labelledby="visit-title">
        <h2 id="visit-title">On site at DevFest.</h2>
        <p class="intro"><strong>Doors open at 09:00.</strong> Here’s what to bring and explore.</p>

        <div class="details">
          <section class="column" aria-labelledby="bring-title">
            <h3 id="bring-title">Bring along</h3>
            <ul>
              <li>Please bring a photo ID for security.</li>
              <li>Bring your laptop (BYOD).</li>
              <li>Bring your AI agents, too.</li>
            </ul>
          </section>

          <section class="column" aria-labelledby="explore-title">
            <h3 id="explore-title">Between sessions</h3>
            <p class="explore-copy">Check out Pin Hunt, Scratch Cards, the Vibe Lounge and more.</p>
          </section>

          <section class="column practical" aria-labelledby="practical-title">
            <h3 id="practical-title">At the venue</h3>
            <ul>
              <li>${visitBlock.accessibility}</li>
              <li>${visitBlock.wifi}</li>
              <li>${visitBlock.cloakroom}</li>
            </ul>
            <div class="links">
              <a class="help" href=${accessibilityEmail}>${visitBlock.accessibilityHelp}</a>
              <a
                class="directions"
                href="${directionsUrl}"
                target="_blank"
                rel="noopener noreferrer"
              >
                ${visitBlock.directions}
              </a>
            </div>
          </section>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'visit-block': VisitBlock;
  }
}
