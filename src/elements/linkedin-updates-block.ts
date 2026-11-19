import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ThemedElement } from '../components/themed-element';

const COMMUNITY_STORIES = [
  {
    name: 'Yonatan Levin',
    image: '/images/community/yonatan-courage.webp',
    height: 1000,
    alt: 'Courage: Yonatan Levin on a blue background, reflecting on leaving familiar expertise behind to keep growing.',
    href: 'https://www.linkedin.com/feed/update/urn:li:activity:7528145881301393408',
    summary:
      'On moving from Android to backend and AI, and finding the courage to become a beginner again.',
  },
  {
    name: 'Çalgan Aygün',
    image: '/images/community/calgan-mindfulness.webp',
    height: 996,
    alt: 'Mindfulness: Çalgan Aygün on a red background. I’m learning that I don’t need to know everything to stay relevant.',
    href: 'https://www.linkedin.com/feed/update/urn:li:activity:7527449130076626944',
    summary: 'On FOMO, staying relevant and finding balance in a fast-moving industry.',
  },
  {
    name: 'Michał Tajchert',
    image: '/images/community/michal-perspectives.webp',
    height: 1001,
    alt: 'Understanding: Michał Tajchert on a yellow background. We can solve much harder problems when we look at them together from different perspectives.',
    href: 'https://www.linkedin.com/feed/update/urn:li:activity:7526740721119158272',
    summary: 'On working together and seeing the same challenge from different perspectives.',
  },
  {
    name: 'Dominika Zając',
    image: '/images/community/dominika-resetting.webp',
    height: 1004,
    alt: 'Resetting: Dominika Zając on a green background. Sometimes, all I need is to disconnect from everything to reconnect with myself.',
    href: 'https://www.linkedin.com/feed/update/urn:li:activity:7527829910585880576',
    summary: 'On forest walks, karaoke and finding clarity under pressure.',
  },
];

// Shuffle once when this module loads, before any cards render. Re-renders and
// carousel navigation retain the order for the whole page visit.
export function shuffleStories<T>(stories: readonly T[], random = Math.random): T[] {
  const shuffled = [...stories];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  return shuffled;
}

const PAGE_STORIES = shuffleStories(COMMUNITY_STORIES);

@customElement('linkedin-updates-block')
export class LinkedInUpdatesBlock extends ThemedElement {
  @state() private activeCard = 0;

  private get cards() {
    return Array.from(this.renderRoot.querySelectorAll<HTMLElement>('article'));
  }

  private showCard(index: number) {
    const cards = this.cards;
    const next = Math.max(0, Math.min(index, cards.length - 1));
    const track = this.renderRoot.querySelector<HTMLElement>('.posts');
    const first = cards[0];
    const card = cards[next];
    if (!track || !first || !card) return;
    track.scrollTo({
      left: card.offsetLeft - first.offsetLeft,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    this.activeCard = next;
  }

  private updateActiveCard() {
    const track = this.renderRoot.querySelector<HTMLElement>('.posts');
    const cards = this.cards;
    const first = cards[0];
    if (!track || !first) return;
    let nearest = 0;
    let nearestDistance = Infinity;
    cards.forEach((card, index) => {
      const distance = Math.abs(card.offsetLeft - first.offsetLeft - track.scrollLeft);
      if (distance < nearestDistance) {
        nearest = index;
        nearestDistance = distance;
      }
    });
    this.activeCard = nearest;
  }

  private onTrackKeydown(event: KeyboardEvent) {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.showCard(this.activeCard + (event.key === 'ArrowRight' ? 1 : -1));
    }
  }

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
          position: relative;
          grid-auto-flow: column;
          grid-auto-columns: min(82%, 320px);
          gap: 16px;
          margin-top: 24px;
          padding: 4px 4px 12px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          overscroll-behavior-x: contain;
          scrollbar-width: none;
        }
        .posts::-webkit-scrollbar {
          display: none;
        }
        .carousel-controls {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 24px 0 0;
        }
        .carousel-controls span {
          flex: 1;
          color: var(--terminal-muted, #a8b9d1);
          font-size: 14px;
        }
        button {
          width: 48px;
          height: 48px;
          border: 1px solid var(--divider-color, #263b56);
          border-radius: 4px;
          color: inherit;
          background: transparent;
          font-size: 24px;
          cursor: pointer;
        }
        button:disabled {
          opacity: 0.4;
          cursor: default;
        }
        article {
          scroll-snap-align: start;
          min-width: 0;
        }
        .story-link {
          display: block;
          min-height: 100%;
          padding: 0;
          border: 0;
          border-radius: 0;
          font-weight: 400;
        }
        .story-link:focus-visible {
          outline-offset: -3px;
        }
        .story-copy {
          padding: 16px 2px 4px;
        }

        .visually-hidden {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip-path: inset(50%);
          white-space: nowrap;
          border: 0;
        }
        img {
          display: block;
          width: 100%;
          height: auto;
          object-fit: contain;
          border-radius: 12px;
        }
        .read-post {
          display: inline-block;
          margin-top: 16px;
          color: var(--google-blue, #4285f4);
          font-size: 14px;
          font-weight: 700;
        }
        .category {
          color: var(--terminal-green, #7ef2a5);
          font-size: 13px;
          font-weight: 700;
        }
        h3 {
          margin: 0 0 4px;
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
        .company-link {
          margin-top: 28px;
        }
        a:hover {
          background: var(--secondary-background-color, #14243a);
        }
        .story-link:hover {
          background: transparent;
        }
        .story-link:hover .read-post {
          text-decoration: underline;
        }
        a:focus-visible,
        button:focus-visible,
        .posts:focus-visible {
          outline: 2px solid var(--google-blue, #4285f4);
          outline-offset: 4px;
        }
        @media (max-width: 420px) {
          section {
            padding: 48px 16px;
          }
        }
        @media (min-width: 760px) {
          .posts {
            grid-auto-flow: row;
            grid-auto-columns: auto;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 24px;
            overflow: visible;
            padding: 0;
          }
          .carousel-controls {
            display: none;
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
        <div class="carousel-controls">
          <span aria-live="polite">Story ${this.activeCard + 1} of ${PAGE_STORIES.length}</span>
          <button
            type="button"
            aria-label="Previous speaker story"
            aria-controls="community-posts"
            ?disabled=${this.activeCard === 0}
            @click=${() => this.showCard(this.activeCard - 1)}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Next speaker story"
            aria-controls="community-posts"
            ?disabled=${this.activeCard === PAGE_STORIES.length - 1}
            @click=${() => this.showCard(this.activeCard + 1)}
          >
            →
          </button>
        </div>
        <div
          id="community-posts"
          class="posts"
          role="region"
          aria-label="Speaker stories. Swipe or use the arrow keys to browse."
          tabindex="0"
          @scroll=${this.updateActiveCard}
          @keydown=${this.onTrackKeydown}
        >
          ${PAGE_STORIES.map(
            (story) => html`
              <article>
                <a class="story-link" href=${story.href} target="_blank" rel="noopener noreferrer">
                  <img
                    src=${story.image}
                    alt=${story.alt}
                    loading="lazy"
                    decoding="async"
                    width="800"
                    height=${story.height}
                  />
                  <div class="story-copy">
                    <h3>${story.name}</h3>
                    <span class="category">Speaker conversation</span>
                    <p>${story.summary}</p>
                    <span class="read-post">Read the story ↗</span>
                    <span class="visually-hidden"> (opens on LinkedIn in a new tab)</span>
                  </div>
                </a>
              </article>
            `,
          )}
        </div>
        <a
          href="https://www.linkedin.com/company/gdg-warszawa/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Visit GDG Warszawa on LinkedIn (opens in a new tab)"
          class="company-link"
          >Visit GDG Warszawa on LinkedIn</a
        >
      </section>
    `;
  }
}
