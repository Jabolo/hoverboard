import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { ThemedElement } from '../components/themed-element';

// Generated with Core Image's QR encoder from the album URL below. The SVG
// includes a four-module quiet zone and does not depend on a third-party service.
const albumUrl = 'https://photos.app.goo.gl/QbodNU6v6xyAS9zJ7';
const qrPath =
  'M5 5h7v1h-7zM13 5h3v1h-3zM17 5h1v1h-1zM21 5h2v1h-2zM24 5h3v1h-3zM28 5h1v1h-1zM30 5h2v1h-2zM33 5h3v1h-3zM5 6h1v1h-1zM11 6h1v1h-1zM14 6h2v1h-2zM17 6h1v1h-1zM22 6h1v1h-1zM25 6h1v1h-1zM28 6h1v1h-1zM32 6h2v1h-2zM37 6h1v1h-1zM5 7h1v1h-1zM7 7h3v1h-3zM11 7h1v1h-1zM13 7h1v1h-1zM15 7h1v1h-1zM19 7h3v1h-3zM25 7h2v1h-2zM31 7h2v1h-2zM35 7h1v1h-1zM5 8h1v1h-1zM7 8h3v1h-3zM11 8h1v1h-1zM13 8h2v1h-2zM19 8h1v1h-1zM21 8h2v1h-2zM24 8h1v1h-1zM27 8h1v1h-1zM32 8h1v1h-1zM35 8h3v1h-3zM5 9h1v1h-1zM7 9h3v1h-3zM11 9h1v1h-1zM15 9h2v1h-2zM18 9h1v1h-1zM20 9h4v1h-4zM27 9h7v1h-7zM35 9h2v1h-2zM5 10h1v1h-1zM11 10h1v1h-1zM13 10h1v1h-1zM15 10h2v1h-2zM18 10h2v1h-2zM21 10h3v1h-3zM28 10h2v1h-2zM33 10h3v1h-3zM37 10h1v1h-1zM5 11h7v1h-7zM13 11h2v1h-2zM18 11h1v1h-1zM22 11h3v1h-3zM26 11h1v1h-1zM28 11h2v1h-2zM31 11h1v1h-1zM33 11h1v1h-1zM13 12h5v1h-5zM21 12h1v1h-1zM24 12h6v1h-6zM33 12h2v1h-2zM36 12h2v1h-2zM5 13h1v1h-1zM7 13h1v1h-1zM10 13h4v1h-4zM18 13h2v1h-2zM21 13h2v1h-2zM24 13h1v1h-1zM27 13h8v1h-8zM37 13h1v1h-1zM6 14h1v1h-1zM8 14h3v1h-3zM13 14h2v1h-2zM17 14h1v1h-1zM19 14h2v1h-2zM23 14h1v1h-1zM25 14h1v1h-1zM28 14h1v1h-1zM30 14h1v1h-1zM34 14h1v1h-1zM37 14h1v1h-1zM7 15h1v1h-1zM11 15h1v1h-1zM16 15h1v1h-1zM20 15h1v1h-1zM23 15h3v1h-3zM28 15h1v1h-1zM31 15h2v1h-2zM34 15h4v1h-4zM5 16h1v1h-1zM13 16h1v1h-1zM15 16h2v1h-2zM19 16h3v1h-3zM25 16h7v1h-7zM34 16h2v1h-2zM37 16h1v1h-1zM6 17h2v1h-2zM9 17h1v1h-1zM11 17h3v1h-3zM15 17h2v1h-2zM21 17h1v1h-1zM27 17h3v1h-3zM33 17h3v1h-3zM6 18h1v1h-1zM8 18h2v1h-2zM15 18h1v1h-1zM17 18h2v1h-2zM22 18h3v1h-3zM27 18h1v1h-1zM29 18h3v1h-3zM33 18h1v1h-1zM36 18h2v1h-2zM9 19h5v1h-5zM20 19h2v1h-2zM23 19h1v1h-1zM26 19h1v1h-1zM31 19h3v1h-3zM35 19h1v1h-1zM5 20h6v1h-6zM13 20h1v1h-1zM15 20h2v1h-2zM20 20h1v1h-1zM25 20h1v1h-1zM27 20h3v1h-3zM31 20h1v1h-1zM33 20h2v1h-2zM37 20h1v1h-1zM5 21h7v1h-7zM16 21h1v1h-1zM18 21h1v1h-1zM23 21h1v1h-1zM25 21h7v1h-7zM33 21h1v1h-1zM35 21h1v1h-1zM5 22h1v1h-1zM8 22h3v1h-3zM14 22h1v1h-1zM17 22h2v1h-2zM20 22h1v1h-1zM23 22h1v1h-1zM26 22h1v1h-1zM28 22h1v1h-1zM30 22h3v1h-3zM35 22h1v1h-1zM7 23h2v1h-2zM10 23h4v1h-4zM15 23h1v1h-1zM17 23h3v1h-3zM22 23h5v1h-5zM29 23h1v1h-1zM31 23h3v1h-3zM35 23h1v1h-1zM6 24h2v1h-2zM9 24h2v1h-2zM12 24h2v1h-2zM17 24h1v1h-1zM19 24h1v1h-1zM25 24h2v1h-2zM28 24h1v1h-1zM30 24h1v1h-1zM32 24h1v1h-1zM36 24h1v1h-1zM5 25h1v1h-1zM7 25h2v1h-2zM10 25h3v1h-3zM14 25h2v1h-2zM19 25h3v1h-3zM25 25h3v1h-3zM29 25h1v1h-1zM34 25h1v1h-1zM36 25h1v1h-1zM13 26h2v1h-2zM16 26h1v1h-1zM20 26h3v1h-3zM25 26h3v1h-3zM29 26h1v1h-1zM31 26h2v1h-2zM34 26h1v1h-1zM36 26h2v1h-2zM6 27h1v1h-1zM9 27h1v1h-1zM11 27h1v1h-1zM13 27h3v1h-3zM18 27h1v1h-1zM23 27h1v1h-1zM26 27h3v1h-3zM31 27h4v1h-4zM36 27h2v1h-2zM7 28h3v1h-3zM13 28h2v1h-2zM16 28h1v1h-1zM18 28h1v1h-1zM21 28h5v1h-5zM28 28h1v1h-1zM31 28h2v1h-2zM34 28h4v1h-4zM5 29h1v1h-1zM7 29h2v1h-2zM10 29h3v1h-3zM15 29h8v1h-8zM26 29h3v1h-3zM31 29h1v1h-1zM34 29h1v1h-1zM36 29h2v1h-2zM13 30h2v1h-2zM16 30h1v1h-1zM19 30h6v1h-6zM27 30h1v1h-1zM29 30h1v1h-1zM5 31h7v1h-7zM13 31h1v1h-1zM15 31h1v1h-1zM17 31h1v1h-1zM19 31h1v1h-1zM21 31h1v1h-1zM23 31h1v1h-1zM25 31h1v1h-1zM27 31h1v1h-1zM29 31h1v1h-1zM31 31h7v1h-7zM5 32h1v1h-1zM11 32h1v1h-1zM17 32h7v1h-7zM26 32h3v1h-3zM31 32h1v1h-1zM37 32h1v1h-1zM5 33h1v1h-1zM7 33h3v1h-3zM11 33h1v1h-1zM14 33h2v1h-2zM17 33h1v1h-1zM21 33h1v1h-1zM23 33h1v1h-1zM27 33h3v1h-3zM31 33h1v1h-1zM33 33h3v1h-3zM37 33h1v1h-1zM5 34h1v1h-1zM7 34h3v1h-3zM11 34h1v1h-1zM13 34h4v1h-4zM23 34h2v1h-2zM26 34h1v1h-1zM28 34h2v1h-2zM31 34h1v1h-1zM33 34h3v1h-3zM37 34h1v1h-1zM5 35h1v1h-1zM7 35h3v1h-3zM11 35h1v1h-1zM14 35h1v1h-1zM16 35h1v1h-1zM18 35h3v1h-3zM23 35h1v1h-1zM25 35h1v1h-1zM28 35h2v1h-2zM31 35h1v1h-1zM33 35h3v1h-3zM37 35h1v1h-1zM5 36h1v1h-1zM11 36h1v1h-1zM13 36h1v1h-1zM15 36h1v1h-1zM19 36h1v1h-1zM21 36h2v1h-2zM28 36h2v1h-2zM31 36h1v1h-1zM37 36h1v1h-1zM5 37h7v1h-7zM13 37h3v1h-3zM21 37h1v1h-1zM23 37h6v1h-6zM31 37h7v1h-7z';

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
          width: 129px;
          height: 129px;
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
            width: 172px;
            height: 172px;
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
            <svg viewBox="0 0 43 43" aria-hidden="true" focusable="false">
              <rect width="43" height="43" fill="#fff"></rect>
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
