import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ThemedElement } from '../components/themed-element';
import { updateMetadata } from '../utils/metadata';
import '../hunt/signal-game.js';
import '../hunt/experiments.js';
import '../elements/footer-block';

const prompts = [
  'A virtual pet that lives inside a dial-up modem. Keep it happy while the connection drops.',
  'Snake, but every snack gives the snake a deeply unnecessary superpower.',
  'A desktop full of runaway windows. Catch the right one before your boss walks in.',
  'A tiny pixel maze where the treasure is the last working Wi-Fi router.',
  'Pong with a personality: the ball gives increasingly dramatic commentary.',
  'A browser loading screen that becomes the game at 99%.',
];
const symbols = ['💿', '💾', '🕹️', '📡'];

@customElement('y2k-page')
export class Y2kPage extends ThemedElement {
  @state() private promptIndex = 0;
  @state() private deck = this.shuffle();
  @state() private flipped: number[] = [];
  @state() private matched: number[] = [];
  @state() private turns = 0;
  private timer: number | undefined;

  private shuffle() {
    const cards = [...symbols, ...symbols];
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j]!, cards[i]!];
    }
    return cards;
  }

  override connectedCallback() {
    super.connectedCallback();
    updateMetadata(
      'Y2K Arcade & Card Hunt',
      'Play tiny games, collect holographic cards and build your own browser game at DevFest Warsaw.',
    );
  }

  override disconnectedCallback() {
    window.clearTimeout(this.timer);
    super.disconnectedCallback();
  }

  private reset = () => {
    window.clearTimeout(this.timer);
    this.deck = this.shuffle();
    this.flipped = [];
    this.matched = [];
    this.turns = 0;
  };

  private flip(index: number) {
    if (this.flipped.length === 2 || this.flipped.includes(index) || this.matched.includes(index))
      return;
    this.flipped = [...this.flipped, index];
    if (this.flipped.length !== 2) return;
    this.turns++;
    if (this.deck[this.flipped[0]!] === this.deck[index]) {
      this.matched = [...this.matched, ...this.flipped];
      this.flipped = [];
    } else {
      this.timer = window.setTimeout(() => {
        this.flipped = [];
      }, 1100);
    }
  }

  private jump(id: string) {
    const target = this.renderRoot.querySelector<HTMLElement>(`#${id}`);
    target?.scrollIntoView({ behavior: 'auto', block: 'start' });
    target?.focus({ preventScroll: true });
  }

  static override get styles() {
    return [
      ...super.styles,
      css`
        :host {
          display: block;
          background: #140b29;
          color: #fff8ec;
          font-family: 'Trebuchet MS', 'Segoe UI', sans-serif;
        }
        * {
          box-sizing: border-box;
        }
        .world {
          background:
            linear-gradient(#a18cb809 1px, transparent 1px),
            linear-gradient(90deg, #a18cb809 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .wrap {
          max-width: 1160px;
          margin: auto;
          padding: 0 28px;
        }
        a {
          color: inherit;
          text-underline-offset: 4px;
        }
        button,
        .button {
          min-height: 48px;
          padding: 13px 20px;
          border: 1px solid #9f8bb7;
          border-radius: 6px;
          font:
            700 15px 'Trebuchet MS',
            sans-serif;
          color: #fff8ec;
          background: #2c2141;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
        }
        button:hover,
        .button:hover {
          background: #44335d;
        }
        .primary {
          background: #eaf87f;
          border-color: #eaf87f;
          color: #21193a;
        }
        .primary:hover {
          background: #f5ffa9;
        }
        :is(button, a):focus-visible {
          outline: 3px solid #eaf87f;
          outline-offset: 5px;
        }
        [tabindex='-1']:focus {
          outline: none;
        }
        .status {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          padding: 22px 0;
          border-bottom: 1px solid #77628e;
          font: 12px monospace;
          letter-spacing: 0.06em;
          color: #d4c6e6;
        }
        .status span:first-child {
          color: #eaf87f;
        }
        .hero {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          align-items: center;
          gap: 64px;
          padding: 72px 0 84px;
        }
        .eyebrow {
          font: 12px monospace;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #eaf87f;
        }
        h1 {
          font-size: clamp(58px, 8vw, 98px);
          line-height: 0.94;
          letter-spacing: -0.07em;
          margin: 22px 0;
        }
        h1 em {
          display: block;
          font-style: normal;
          color: #eaf87f;
        }
        .intro {
          font-size: 19px;
          line-height: 1.55;
          max-width: 44ch;
          color: #ddcfe9;
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 25px;
        }
        .cassette {
          transform: rotate(5deg);
          position: relative;
          border: 1px solid #f3ebff;
          border-radius: 22px;
          padding: 26px;
          color: #221a35;
          background: linear-gradient(
            125deg,
            #dce3ff,
            #f4cadf 27%,
            #c4fff0 50%,
            #dfd0fa 73%,
            #f4e6b1
          );
          box-shadow: 15px 24px 0 #30203f;
          overflow: hidden;
        }
        .cassette::after {
          content: '';
          position: absolute;
          inset: -100%;
          pointer-events: none;
          background: linear-gradient(110deg, transparent 43%, #ffffff99 50%, transparent 57%);
          animation: sheen 9s ease-in-out infinite;
        }
        @keyframes sheen {
          0%,
          100% {
            transform: translateX(-25%);
          }
          50% {
            transform: translateX(25%);
          }
        }
        .disc {
          width: 190px;
          height: 190px;
          margin: 28px auto;
          border-radius: 50%;
          border: 1px solid #796c95;
          background: conic-gradient(#ebfafa, #b7c9ff, #fff5b6, #ffc7dc, #d9ffe2, #cfc5ff, #ebfafa);
          display: grid;
          place-items: center;
          box-shadow: 0 0 0 12px #ffffff33;
        }
        .disc::after {
          content: '';
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: #291b41;
          border: 10px solid #e1d9f6;
        }
        .cassette .label {
          display: flex;
          justify-content: space-between;
          font: 12px monospace;
        }
        .cassette strong {
          display: block;
          font-size: 32px;
          letter-spacing: -0.04em;
        }
        .cassette p {
          margin: 8px 0;
          font-size: 14px;
        }
        .modes {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: #6e5b91;
          border: 1px solid #6e5b91;
          border-radius: 10px;
          overflow: hidden;
        }
        .mode {
          display: block;
          text-align: left;
          border: 0;
          border-radius: 0;
          font-weight: normal;
          background: #211532;
          padding: 26px;
          text-decoration: none;
        }
        .mode:hover {
          background: #352447;
        }
        .mode span {
          font: 12px monospace;
          color: #eaf87f;
        }
        .mode strong {
          display: block;
          font-size: 25px;
          margin: 12px 0;
        }
        .mode p {
          font-size: 15px;
          line-height: 1.5;
          color: #d4c6e6;
          margin: 0;
        }
        section {
          padding: 72px 0;
          border-bottom: 1px solid #59446f;
          scroll-margin-top: 95px;
        }
        h2 {
          font-size: clamp(32px, 4vw, 50px);
          letter-spacing: -0.045em;
          margin: 12px 0 20px;
          line-height: 1.05;
        }
        h3 {
          font-size: 23px;
          margin: 0 0 12px;
        }
        p,
        li {
          line-height: 1.6;
        }
        .lede {
          max-width: 65ch;
          color: #ddcfe9;
        }
        .split {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-top: 30px;
        }
        .panel {
          padding: 28px;
          background: #261938;
          border: 1px solid #6e5b91;
          border-radius: 12px;
        }
        .panel p {
          color: #ddcfe9;
        }
        .game-title {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .memory {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin: 22px 0;
        }
        .memory button {
          aspect-ratio: 1;
          min-width: 0;
          font-size: 30px;
          padding: 8px;
          background: #392850;
        }
        .memory button.revealed {
          background: #e1d5f5;
          color: #21193a;
        }
        .memory button.matched {
          background: #eaf87f;
          color: #21193a;
          border-color: #eaf87f;
        }
        .memory button:disabled {
          cursor: default;
          opacity: 1;
        }
        .small {
          font-size: 13px;
          color: #c8b8dc;
        }
        .score {
          min-height: 26px;
        }
        .prompt {
          font-size: 24px;
          line-height: 1.45;
          min-height: 138px;
          color: #fff8ec !important;
        }
        .steps {
          counter-reset: step;
          padding: 0;
          list-style: none;
        }
        .steps li {
          margin: 18px 0;
          padding-left: 38px;
          position: relative;
        }
        .steps li::before {
          counter-increment: step;
          content: '0' counter(step);
          position: absolute;
          left: 0;
          color: #eaf87f;
          font: 14px monospace;
          top: 5px;
        }
        .note {
          padding: 16px 20px;
          border-left: 3px solid #eaf87f;
          background: #332444;
          font-size: 14px;
        }
        .credit {
          padding: 28px 0 48px;
          font-size: 13px;
          color: #ccbbdf;
        }
        @media (max-width: 760px) {
          .wrap {
            padding: 0 20px;
          }
          .hero {
            grid-template-columns: 1fr;
            padding: 42px 0 56px;
            gap: 36px;
          }
          .cassette {
            max-width: 340px;
            width: 90%;
            justify-self: center;
            transform: rotate(3deg);
          }
          .disc {
            width: 145px;
            height: 145px;
          }
          .modes,
          .split {
            grid-template-columns: 1fr;
          }
          section {
            padding: 48px 0;
          }
          .panel {
            padding: 22px;
          }
          .prompt {
            min-height: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .cassette::after {
            animation: none;
          }
        }
      `,
    ];
  }

  override render() {
    return html` <div class="world">
        <div class="wrap">
          <div class="status">
            <span>● DEVFEST WARSAW / SIDE QUESTS</span
            ><span>21 NOV 2026 · NO DOWNLOAD REQUIRED</span>
          </div>
          <div class="hero">
            <div>
              <div class="eyebrow">Welcome back to the internet playground</div>
              <h1>Y2K<em>Arcade.</em></h1>
              <p class="intro">
                One more round. One more discovery. Play something tiny, scratch something shiny,
                then build something wonderfully weird.
              </p>
              <div class="actions">
                <button class="primary" @click=${() => this.jump('play')}>Press START ↗</button
                ><a class="button" href="/hunt/">My Collection</a>
              </div>
            </div>
            <a class="cassette" href="/hunt/c/y6597cd/" aria-label="Scratch the Welcome Disc"
              ><div class="label">
                <span>DEVFEST / VOL. 26</span><span>HOLOGRAPHIC EDITION</span>
              </div>
              <div class="disc" aria-hidden="true"></div>
              <strong>YOUR FIRST FIND.</strong>
              <p>Open the Welcome Disc. Scratch. Keep.</p>
              <div class="label"><span>INSERT CURIOSITY</span><span>↗</span></div></a
            >
          </div>
          <nav class="modes" aria-label="Y2K activities">
            <button class="mode" @click=${() => this.jump('play')}>
              <span>01 / PLAY</span><strong>The Arcade ↘</strong>
              <p>Small games. Big “one more go” energy.</p>
            </button>
            <a class="mode" href="/hunt/"
              ><span>02 / DISCOVER</span><strong>Card Hunt ↗</strong>
              <p>Find holographic cards. Fill your own foil binder.</p></a
            >
            <button class="mode" @click=${() => this.jump('build')}>
              <span>03 / MAKE</span><strong>Vibe Coding Challenge ↘</strong>
              <p>Your idea. Your tools. A browser game we can all play.</p>
            </button>
          </nav>
          <section id="play" tabindex="-1">
            <div class="eyebrow">01 / A little warm-up</div>
            <h2>Insert coin? Nah. Just play.</h2>
            <p class="lede">
              Five tiny games to get you in the mood. These are playground demos, not competition
              entries. Scores stay here and do not enter you into a prize draw.
            </p>
            <div class="split">
              <div><hunt-signal-game></hunt-signal-game></div>
              <div class="panel">
                <div class="game-title">
                  <h3>Cache Memory</h3>
                  <span class="eyebrow">4 PAIRS</span>
                </div>
                <p>
                  Flip two tiles. Match all four pairs in as few turns as you can. Use touch, mouse,
                  or Tab and Enter.
                </p>
                <div class="memory">
                  ${this.deck.map((symbol, index) => {
                    const matched = this.matched.includes(index);
                    const visible = matched || this.flipped.includes(index);
                    return html`<button
                      class=${matched ? 'matched' : visible ? 'revealed' : ''}
                      aria-disabled=${matched}
                      aria-label=${visible ? `Tile ${index + 1}: ${symbol}${matched ? ', matched' : ''}` : `Reveal tile ${index + 1}`}
                      @click=${() => this.flip(index)}
                    >
                      ${visible ? symbol : '?'}
                    </button>`;
                  })}
                </div>
                <p class="score" role="status">
                  ${this.matched.length === 8 ? `Cache restored! All 4 pairs in ${this.turns} turns.` : `${this.matched.length / 2} / 4 pairs · ${this.turns} turns`}
                </p>
                <button @click=${this.reset}>New game</button>
                <p class="small">A new game resets this board. No account or leaderboard.</p>
              </div>
            </div>
            <y2k-experiments></y2k-experiments>
          </section>
          <section id="discover" tabindex="-1">
            <div class="eyebrow">02 / Keep your eyes open</div>
            <h2>Find a card. Scratch it. Keep it.</h2>
            <div class="split">
              <div>
                <p class="lede">
                  Some cards hide in the DevFest website. Others wait around the venue, behind a QR
                  code or a marked NFC sticker. Follow the clues and see what turns up.
                </p>
                <ol class="steps">
                  <li>
                    Open a card. Scratch the foil with your finger or mouse, or choose Reveal.
                  </li>
                  <li>
                    Find your revealed cards in My Collection. Stay in the same browser to keep your
                    finds together.
                  </li>
                  <li>
                    Try a tiny game, borrow a creative prompt, or follow the next clue. Some finds
                    only appear for a little while.
                  </li>
                </ol>
                <p class="small">
                  Optional motion effects. No account needed. Clearing site data can remove your
                  collection. Card Hunt is separate from the DevFest Quest and challenge
                  submissions.
                </p>
              </div>
              <div class="panel">
                <h3>Your starter pack</h3>
                <p>Three doors into the playground. The rest? That’s for you to discover.</p>
                <div class="actions">
                  <a class="button primary" href="/hunt/c/y6597cd/">Scratch the Welcome Disc</a
                  ><a class="button" href="/hunt/c/pvbusdb/">Open the Vibe Lab prompt</a
                  ><a class="button" href="/hunt/c/rmz75w8/">Find the Arcade card</a
                  ><a class="button" href="/hunt/">Open My Collection ↗</a>
                </div>
              </div>
            </div>
          </section>
          <section id="build" tabindex="-1">
            <div class="eyebrow">03 / Make the internet weird again</div>
            <h2>The Vibe Coding Game Challenge</h2>
            <p class="lede">
              Bring back the golden age of browser games. Build a fun, playable game inspired by the
              2000s, or give an old favourite a very modern twist. AI coding assistants, frameworks
              and templates are welcome.
            </p>
            <div class="split">
              <div>
                <ol class="steps">
                  <li>
                    <strong>Make it fun and playable.</strong> A tiny game with a good idea beats an
                    unfinished giant.
                  </li>
                  <li>
                    <strong>Put it on the web.</strong> Share a public link that opens in a browser.
                    No downloads or complicated setup.
                  </li>
                  <li>
                    <strong>Explain the controls.</strong> Include the objective and how to play on
                    your game’s page.
                  </li>
                </ol>
                <p>
                  Prefer playful interfaces to games? The <strong>Y2K Vibe Lab</strong> is for
                  strange components, interactive experiments and nostalgic mini-sites.
                </p>
                <p class="note">
                  The GDG Warsaw LinkedIn community will choose the winners, with results at the
                  closing presentation and DevFest swag for winners. The submission link and
                  detailed voting instructions will appear here once confirmed. For now, start
                  building and keep your playable link handy.
                </p>
              </div>
              <div class="panel">
                <div class="eyebrow">
                  Idea cartridge / ${String(this.promptIndex + 1).padStart(2, '0')}
                </div>
                <h3>Need a starting point?</h3>
                <p class="prompt" aria-live="polite">${prompts[this.promptIndex]}</p>
                <button
                  @click=${() => {
                    this.promptIndex = (this.promptIndex + 1) % prompts.length;
                  }}
                >
                  Load another idea ↻
                </button>
                <p class="small">
                  These are inspiration, not assigned tasks. Bring your own weird idea.
                </p>
              </div>
            </div>
          </section>
          <div class="credit">
            Card Hunt prepared by
            <a href="https://www.linkedin.com/in/m-jab/" target="_blank" rel="noopener noreferrer"
              >Michał Jabłoński ↗</a
            >, inspired by
            <a
              href="https://github.com/PiotrPrus/holographic-lottery-coupon-agsl"
              target="_blank"
              rel="noopener noreferrer"
              >Piotr Prus’s holographic scratch card ↗</a
            >. Y2K Vibe Zone and DevFest Quest developed by <strong>Vika</strong>, with visual
            inspiration from <strong>Angel</strong>’s mood board.
          </div>
        </div>
      </div>
      <footer-block></footer-block>`;
  }
}
