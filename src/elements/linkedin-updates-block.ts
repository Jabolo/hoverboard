import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { ThemedElement } from '../components/themed-element';

@customElement('linkedin-updates-block')
export class LinkedInUpdatesBlock extends ThemedElement {
  static override get styles() {
    return [
      ...super.styles,
      css`
        :host {
          display: block;
          background: var(--primary-background-color, #080f1a);
          color: var(--terminal-copy, #e6eefc);
          border-bottom: 1px solid var(--divider-color, #263b56);
        }
        section {
          max-width: 1216px;
          margin: auto;
          padding: 64px 24px;
        }
        h2 {
          margin: 0;
          font-size: clamp(30px, 4vw, 46px);
          line-height: 1.1;
          letter-spacing: -0.02em;
        }
        .intro {
          margin: 14px 0 0;
          color: var(--terminal-muted, #a8b9d1);
          line-height: 1.6;
        }
        .posts {
          display: grid;
          gap: 0 32px;
          margin-top: 28px;
        }
        article {
          display: grid;
          grid-template-columns: 76px minmax(0, 1fr);
          align-items: start;
          gap: 18px;
          padding: 24px 0;
          border-top: 1px solid var(--divider-color, #263b56);
        }
        img {
          width: 76px;
          height: 76px;
          object-fit: cover;
          border-radius: 12px;
        }
        .category {
          color: var(--terminal-green, #7ef2a5);
          font-size: 13px;
          font-weight: 700;
        }
        h3 {
          margin: 7px 0 0;
          font-size: 21px;
          line-height: 1.25;
        }
        article p {
          margin: 8px 0 0;
          color: var(--terminal-muted, #a8b9d1);
          line-height: 1.55;
        }
        a {
          display: inline-flex;
          align-items: center;
          min-height: 48px;
          padding: 0 20px;
          border: 1px solid var(--google-blue, #4285f4);
          border-radius: 4px;
          color: var(--terminal-copy, #e6eefc);
          text-decoration: none;
          font-weight: 700;
        }
        a:hover {
          background: var(--secondary-background-color, #14243a);
        }
        a:focus-visible {
          outline: 2px solid var(--google-blue, #4285f4);
          outline-offset: 4px;
        }
        @media (min-width: 760px) {
          .posts {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `,
    ];
  }

  override render() {
    return html`
      <section aria-labelledby="updates-title">
        <h2 id="updates-title">From our community</h2>
        <p class="intro">Speaker stories and event updates from GDG Warszawa on LinkedIn.</p>
        <div class="posts">
          <article>
            <img src="/images/speakers/2026/adrian-romanski.12d67a5e.webp" alt="" loading="lazy" />
            <div>
              <span class="category">Meet the speaker</span>
              <h3>Adrian Romański</h3>
              <p>A local-first AI mind coach with Gemma, Gemini and TypeScript.</p>
            </div>
          </article>
          <article>
            <img src="/images/speakers/2026/michal-tajchert.ac967010.webp" alt="" loading="lazy" />
            <div>
              <span class="category">Speaker conversation</span>
              <h3>Michał Tajchert</h3>
              <p>On working together and seeing the same challenge from different perspectives.</p>
            </div>
          </article>
        </div>
        <a href="https://www.linkedin.com/company/gdg-warszawa/">Visit GDG Warszawa on LinkedIn</a>
      </section>
    `;
  }
}
