import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { ThemedElement } from '../components/themed-element';

// Generated with Core Image's QR encoder from the album URL below. The SVG
// includes a four-module quiet zone and does not depend on a third-party service.
const albumUrl = 'https://photos.app.goo.gl/QbodNU6v6xyAS9J7';
const qrPath =
  'M5 5h7v1h-7zM13 5h2v1h-2zM16 5h2v1h-2zM19 5h1v1h-1zM23 5h4v1h-4zM28 5h1v1h-1zM30 5h1v1h-1zM32 5h1v1h-1zM5 6h1v1h-1zM11 6h1v1h-1zM15 6h1v1h-1zM18 6h1v1h-1zM20 6h2v1h-2zM24 6h3v1h-3zM29 6h2v1h-2zM32 6h1v1h-1zM5 7h1v1h-1zM7 7h3v1h-3zM11 7h1v1h-1zM13 7h4v1h-4zM18 7h1v1h-1zM21 7h4v1h-4zM28 7h1v1h-1zM31 7h1v1h-1zM33 7h1v1h-1zM5 8h1v1h-1zM7 8h3v1h-3zM11 8h1v1h-1zM13 8h1v1h-1zM15 8h1v1h-1zM17 8h3v1h-3zM21 8h1v1h-1zM25 8h2v1h-2zM28 8h3v1h-3zM33 8h1v1h-1zM5 9h1v1h-1zM7 9h3v1h-3zM11 9h1v1h-1zM15 9h1v1h-1zM17 9h1v1h-1zM22 9h1v1h-1zM25 9h5v1h-5zM31 9h3v1h-3zM5 10h1v1h-1zM11 10h1v1h-1zM13 10h1v1h-1zM15 10h2v1h-2zM18 10h3v1h-3zM25 10h1v1h-1zM29 10h2v1h-2zM5 11h7v1h-7zM13 11h1v1h-1zM15 11h1v1h-1zM17 11h2v1h-2zM24 11h2v1h-2zM27 11h1v1h-1zM29 11h2v1h-2zM32 11h1v1h-1zM13 12h2v1h-2zM16 12h2v1h-2zM19 12h3v1h-3zM23 12h3v1h-3zM29 12h5v1h-5zM6 13h1v1h-1zM8 13h8v1h-8zM22 13h10v1h-10zM8 14h3v1h-3zM15 14h1v1h-1zM17 14h1v1h-1zM19 14h1v1h-1zM21 14h3v1h-3zM25 14h1v1h-1zM27 14h3v1h-3zM31 14h1v1h-1zM5 15h1v1h-1zM7 15h1v1h-1zM9 15h3v1h-3zM13 15h1v1h-1zM16 15h3v1h-3zM20 15h2v1h-2zM23 15h1v1h-1zM27 15h1v1h-1zM29 15h1v1h-1zM31 15h1v1h-1zM7 16h2v1h-2zM10 16h1v1h-1zM16 16h1v1h-1zM20 16h2v1h-2zM23 16h1v1h-1zM28 16h1v1h-1zM30 16h3v1h-3zM6 17h1v1h-1zM10 17h4v1h-4zM16 17h1v1h-1zM21 17h5v1h-5zM28 17h3v1h-3zM32 17h1v1h-1zM6 18h3v1h-3zM14 18h1v1h-1zM16 18h2v1h-2zM19 18h1v1h-1zM21 18h1v1h-1zM24 18h2v1h-2zM27 18h2v1h-2zM32 18h1v1h-1zM6 19h1v1h-1zM8 19h1v1h-1zM10 19h4v1h-4zM15 19h1v1h-1zM17 19h2v1h-2zM21 19h4v1h-4zM27 19h3v1h-3zM31 19h3v1h-3zM6 20h2v1h-2zM10 20h1v1h-1zM12 20h1v1h-1zM16 20h3v1h-3zM20 20h2v1h-2zM24 20h1v1h-1zM26 20h2v1h-2zM31 20h3v1h-3zM11 21h2v1h-2zM16 21h3v1h-3zM20 21h4v1h-4zM28 21h1v1h-1zM30 21h2v1h-2zM5 22h2v1h-2zM12 22h1v1h-1zM14 22h2v1h-2zM18 22h3v1h-3zM25 22h2v1h-2zM28 22h1v1h-1zM33 22h1v1h-1zM10 23h2v1h-2zM13 23h1v1h-1zM17 23h3v1h-3zM22 23h2v1h-2zM26 23h3v1h-3zM31 23h2v1h-2zM7 24h1v1h-1zM10 24h1v1h-1zM13 24h1v1h-1zM15 24h1v1h-1zM19 24h1v1h-1zM22 24h8v1h-8zM33 24h1v1h-1zM5 25h1v1h-1zM7 25h2v1h-2zM10 25h3v1h-3zM15 25h1v1h-1zM18 25h2v1h-2zM22 25h2v1h-2zM27 25h1v1h-1zM30 25h1v1h-1zM32 25h2v1h-2zM13 26h4v1h-4zM20 26h5v1h-5zM5 27h7v1h-7zM13 27h1v1h-1zM15 27h1v1h-1zM17 27h1v1h-1zM19 27h1v1h-1zM21 27h1v1h-1zM23 27h1v1h-1zM25 27h1v1h-1zM27 27h7v1h-7zM5 28h1v1h-1zM11 28h1v1h-1zM14 28h1v1h-1zM16 28h1v1h-1zM18 28h1v1h-1zM21 28h5v1h-5zM27 28h1v1h-1zM33 28h1v1h-1zM5 29h1v1h-1zM7 29h3v1h-3zM11 29h1v1h-1zM14 29h1v1h-1zM16 29h2v1h-2zM19 29h4v1h-4zM24 29h1v1h-1zM27 29h1v1h-1zM29 29h3v1h-3zM33 29h1v1h-1zM5 30h1v1h-1zM7 30h3v1h-3zM11 30h1v1h-1zM13 30h2v1h-2zM16 30h2v1h-2zM19 30h1v1h-1zM21 30h2v1h-2zM24 30h1v1h-1zM27 30h1v1h-1zM29 30h3v1h-3zM33 30h1v1h-1zM5 31h1v1h-1zM7 31h3v1h-3zM11 31h1v1h-1zM15 31h2v1h-2zM18 31h2v1h-2zM21 31h1v1h-1zM25 31h1v1h-1zM27 31h1v1h-1zM29 31h3v1h-3zM33 31h1v1h-1zM5 32h1v1h-1zM11 32h1v1h-1zM13 32h1v1h-1zM15 32h1v1h-1zM17 32h1v1h-1zM19 32h1v1h-1zM23 32h1v1h-1zM27 32h1v1h-1zM33 32h1v1h-1zM5 33h7v1h-7zM13 33h1v1h-1zM15 33h5v1h-5zM21 33h4v1h-4zM27 33h7v1h-7z';

@customElement('attendee-photos-block')
export class AttendeePhotosBlock extends ThemedElement {
  static override get styles() {
    return [
      ...super.styles,
      css`
        :host {
          display: block;
          border-bottom: 1px solid var(--divider-color);
          background: var(--primary-background-color);
          color: var(--terminal-copy);
          scroll-margin-top: 80px;
        }
        .container {
          padding-top: 40px;
          padding-bottom: 40px;
        }
        .panel {
          display: grid;
          gap: 28px;
          padding: 24px;
          border: 1px solid var(--terminal-line);
          border-radius: 4px;
          background: var(--terminal-panel);
        }
        .content {
          align-self: center;
        }
        h2 {
          max-width: 24ch;
          margin: 0;
          color: var(--primary-text-color);
          font-family: var(--font-mono, monospace);
          font-size: clamp(28px, 4vw, 40px);
          letter-spacing: -0.025em;
          line-height: 1.1;
        }
        p {
          max-width: 48ch;
          margin: 16px 0 0;
          color: var(--terminal-muted);
          font-size: 16px;
          line-height: 1.6;
        }
        .album-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
          margin-top: 24px;
          padding: 0 18px;
          border: 1px solid var(--google-blue);
          border-radius: 4px;
          color: var(--primary-text-color);
          font-weight: 700;
          text-decoration: none;
        }
        .album-link:hover {
          background: var(--secondary-background-color);
        }
        .album-link:focus-visible {
          outline: 2px solid var(--google-blue);
          outline-offset: 4px;
        }
        .scan {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .scan svg {
          display: block;
          flex: none;
          width: 117px;
          height: 117px;
          background: #fff;
          shape-rendering: crispEdges;
        }
        .scan p {
          max-width: 15ch;
          margin: 0;
          color: var(--terminal-green);
          font-family: var(--font-mono, monospace);
          font-size: 13px;
          line-height: 1.5;
        }
        @media (min-width: 760px) {
          .panel {
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
            gap: 48px;
            padding: 32px;
          }
          .scan {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
          .scan svg {
            width: 156px;
            height: 156px;
          }
        }
      `,
    ];
  }

  override render() {
    return html`
      <section class="container" aria-labelledby="attendee-photos-title">
        <div class="panel">
          <div class="content">
            <h2 id="attendee-photos-title">See DevFest through everyone’s lens.</h2>
            <p>Explore the shared Google Photos album from DevFest Warsaw.</p>
            <a
              class="album-link"
              href=${albumUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open the DevFest shared Google Photos album (opens in a new tab)"
              >Open shared album</a
            >
          </div>
          <div class="scan">
            <svg viewBox="0 0 39 39" aria-hidden="true" focusable="false">
              <rect width="39" height="39" fill="#fff"></rect>
              <path d=${qrPath} fill="#000"></path>
            </svg>
            <p>Scan to open the album on your phone.</p>
          </div>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'attendee-photos-block': AttendeePhotosBlock;
  }
}
