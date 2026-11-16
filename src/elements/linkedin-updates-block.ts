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
          gap: 24px;
          margin-top: 30px;
          align-items: start;
        }
        article {
          min-width: 0;
          overflow: hidden;
          border: 1px solid var(--divider-color, #263b56);
          border-radius: 12px;
          background: var(--terminal-panel-raised, #0e1a2b);
        }
        .content {
          padding: 22px;
        }
        .publisher {
          color: var(--terminal-green, #7ef2a5);
          font-size: 13px;
          font-weight: 700;
        }
        h3 {
          margin: 8px 0 0;
          font-size: 21px;
          line-height: 1.3;
        }
        p,
        li {
          font-size: 15px;
          line-height: 1.65;
        }
        p {
          margin: 12px 0 0;
        }
        p a {
          color: #a9c8ff;
        }
        ul {
          margin: 12px 0 0;
          padding-left: 22px;
        }
        .artwork {
          display: block;
          background: #08101b;
        }
        .artwork img {
          display: block;
          width: 100%;
          height: auto;
          aspect-ratio: 800 / 1002;
          object-fit: contain;
        }
        details {
          margin-top: 16px;
        }
        summary {
          color: var(--terminal-green, #7ef2a5);
          font-weight: 700;
          cursor: pointer;
          line-height: 1.6;
        }
        summary:focus-visible,
        a:focus-visible {
          outline: 2px solid var(--google-blue, #4285f4);
          outline-offset: 4px;
        }
        .post-link,
        .all-posts {
          display: inline-flex;
          align-items: center;
          min-height: 48px;
          color: var(--terminal-copy, #e6eefc);
          font-weight: 700;
          text-decoration: none;
        }
        .post-link {
          margin-top: 12px;
          color: #a9c8ff;
        }
        .post-link:hover {
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .all-posts {
          margin-top: 28px;
          padding: 0 20px;
          border: 1px solid var(--google-blue, #4285f4);
          border-radius: 4px;
        }
        .all-posts:hover {
          background: var(--secondary-background-color, #14243a);
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
    const adrian = 'https://www.linkedin.com/feed/update/urn:li:activity:7526889332847108097/';
    const michal = 'https://www.linkedin.com/feed/update/urn:li:activity:7526740721119158272/';
    return html`
      <section aria-labelledby="updates-title">
        <h2 id="updates-title">From our community</h2>
        <p class="intro">Speaker stories and event updates from GDG Warszawa on LinkedIn.</p>
        <div class="posts">
          <article aria-labelledby="adrian-post-title">
            <div class="content">
              <span class="publisher">GDG Warszawa · LinkedIn</span>
              <h3 id="adrian-post-title">🚀 Meet Adrian Romański at GDG DevFest Warsaw 2026!</h3>
              <p>
                We're excited to welcome Adrian Romański, Full Stack Developer at PushBased and
                Google Developer Expert in Angular, to this year's DevFest Warsaw!
              </p>
              <p>
                🧠 Stop Chatting with Your Docs - Architecting a Local-First AI Mind Coach in
                TypeScript with Gemma &amp; Gemini Argon
              </p>
            </div>
            <a
              class="artwork"
              href=${adrian}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open Adrian Romański's post on LinkedIn (opens in a new tab)"
              ><img
                src="/images/linkedin/adrian-romanski.jpg"
                alt="DevFest speaker artwork for Adrian Romański and his talk on a local-first AI mind coach."
                loading="lazy"
                width="800"
                height="1004"
            /></a>
            <div class="content">
              <details>
                <summary>Read the full post</summary>
                <p>
                  What if AI could do more than simply summarize your notes or answer questions?
                  What if it could actually challenge your thinking and help you learn more
                  effectively?
                </p>
                <p>
                  In this session, Adrian will explore how to build a local-first AI mind coach that
                  encourages deeper understanding through Socratic dialogue, combining:
                </p>
                <ul>
                  <li>Local Gemma for private, offline AI interactions.</li>
                  <li>Gemini Argon as a reasoning judge to challenge your answers.</li>
                  <li>TypeScript and the Google GenAI SDK to bring the architecture together.</li>
                </ul>
                <p>
                  The goal? Building AI tools that strengthen your engineering knowledge instead of
                  doing all the thinking for you.
                </p>
                <p>
                  👏 Join us at DevFest Warsaw 2026!<br />
                  🔗 <a href="https://warsaw.devfest.pl/">https://warsaw.devfest.pl/</a><br />
                  #DevFestWarsaw #GDG #GoogleDeveloperGroups
                </p>
              </details>
              <a class="post-link" href=${adrian} target="_blank" rel="noopener noreferrer"
                >View Adrian's post on LinkedIn (opens in a new tab)</a
              >
            </div>
          </article>
          <article aria-labelledby="michal-post-title">
            <div class="content">
              <span class="publisher">GDG Warszawa · LinkedIn</span>
              <h3 id="michal-post-title">Meet Michał Tajchert! 🚀</h3>
              <p>
                Over the coming days, we'll be sharing conversations with our amazing speakers,
                giving you a chance to get to know the people behind the talks, hear their
                perspectives, and discover a little more about what inspires them.
              </p>
              <p>And what better way to start than with our first interview?</p>
            </div>
            <a
              class="artwork"
              href=${michal}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open Michał Tajchert's interview on LinkedIn (opens in a new tab)"
              ><img
                src="/images/linkedin/michal-tajchert.jpg"
                alt="Michał Tajchert: Understanding — we can solve much harder problems when we look at them together from different perspectives."
                loading="lazy"
                width="800"
                height="1001"
            /></a>
            <div class="content">
              <details>
                <summary>Read the full post</summary>
                <p>
                  💬 What is the most important thing you’ve learned from working with people who
                  see the world totally differently than you?
                </p>
                <p>
                  The obvious lesson is that different people have different views and ideas. What
                  really stuck with me, though, is how differently people can look at and approach
                  the very same challenge. That’s exactly why we have code reviews (do we still have
                  them in the AI era?), and why working with others helps us build better products.
                </p>
                <p>
                  This applies not only to our jobs, projects and big challenges, but also to
                  everyday tasks and how we behave.
                </p>
                <p>
                  A great reminder of this came from a story I read online recently. Most of us,
                  when calling an elevator, press “up” or “down” depending on where we want to go
                  from our current floor. The author was puzzled when the person next to them
                  pressed the button based on where the elevator currently was. If it was below,
                  they pressed “up” to bring it up to their floor.
                </p>
                <p>
                  I’m not sure the story is true, but examples like this are a perfect reminder of
                  two things. First, we can solve much harder problems when we look at them together
                  from different perspectives. Second, in product design, even something as simple
                  as an up/down button can be read in completely different ways, depending on how a
                  person thinks about controls.
                </p>
              </details>
              <a class="post-link" href=${michal} target="_blank" rel="noopener noreferrer"
                >View Michał's post on LinkedIn (opens in a new tab)</a
              >
            </div>
          </article>
        </div>
        <a class="all-posts" href="https://www.linkedin.com/company/gdg-warszawa/"
          >Visit GDG Warszawa on LinkedIn</a
        >
      </section>
    `;
  }
}
