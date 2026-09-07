import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { ThemedElement } from '../components/themed-element';
import { location, visitBlock } from '../utils/data';

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
          padding-top: 76px;
          padding-bottom: 72px;
        }

        .kicker {
          position: absolute;
          top: 28px;
          left: 16px;
          color: var(--google-blue);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        h2,
        h2 {
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

        .details {
          display: grid;
          gap: 0;
          margin-top: 40px;
          border-top: 1px solid var(--divider-color);
        }

        .column {
          padding: 28px 0;
        }

        .column + .column {
          border-top: 1px solid var(--divider-color);
        }

        h2 {
          color: var(--terminal-green);
          font-size: 15px;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        ul {
          display: grid;
          gap: 16px;
          margin: 22px 0 0;
          padding: 0;
          list-style: none;
        }

        li {
          display: grid;
          grid-template-columns: 12px minmax(0, 1fr);
          gap: 10px;
          color: var(--terminal-copy);
          font-size: 15px;
          line-height: 1.55;
        }

        li::before {
          color: var(--google-blue);
          content: '›';
          font-family: var(--font-mono, monospace);
          font-weight: 800;
        }

        .directions,
        .help {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          margin-top: 22px;
          color: var(--google-blue);
          font-family: var(--font-mono, monospace);
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.03em;
          text-decoration: none;
          text-transform: uppercase;
        }

        .directions::after {
          margin-left: 9px;
          content: '↗';
          font-size: 18px;
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
        }
      `,
    ];
  }

  override render() {
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location.address)}`;

    return html`
      <section class="container" aria-labelledby="visit-title">
        <span class="kicker">${visitBlock.kicker}</span>
        <h2 id="visit-title">${visitBlock.title}</h2>
        <p class="intro">${visitBlock.intro}</p>

        <div class="details">
          <section class="column" aria-labelledby="travel-title">
            <h2 id="travel-title">${visitBlock.travelTitle}</h2>
            <ul>
              <li>${visitBlock.metro}</li>
              <li>${visitBlock.surface}</li>
              <li>${visitBlock.parking}</li>
            </ul>
            <a class="directions" href="${directionsUrl}" target="_blank" rel="noopener noreferrer">
              ${visitBlock.directions}
            </a>
          </section>

          <section class="column" aria-labelledby="on-site-title">
            <h2 id="on-site-title">${visitBlock.onSiteTitle}</h2>
            <ul>
              <li>${visitBlock.accessibility}</li>
              <li>${visitBlock.wifi}</li>
              <li>${visitBlock.cloakroom}</li>
            </ul>
            <a class="help" href="mailto:contact@gdgwarsaw.pl">${visitBlock.accessibilityHelp}</a>
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
