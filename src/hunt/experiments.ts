import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { concepts } from './arcade-experiments.js';
import { experimentStyles } from './arcade-experiment-styles.js';
import { scratch } from './scratch.js';

const rewards = ['b055win', 'bug5afe', 'cd2002x'];

@customElement('y2k-experiments')
export class Y2kExperiments extends LitElement {
  @state() private selected = 0;
  static override styles = [
    experimentStyles,
    css`
      :host {
        display: block;
        margin-top: 40px;
        color: #fff8ec;
        font-family: 'Trebuchet MS', sans-serif;
      }
      * {
        box-sizing: border-box;
      }
      .picker {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin: 20px 0;
      }
      button,
      .reward a {
        min-height: 48px;
        padding: 12px 16px;
        border: 1px solid #9f8bb7;
        border-radius: 6px;
        font:
          700 15px 'Trebuchet MS',
          sans-serif;
        color: #fff8ec;
        background: #2c2141;
        cursor: pointer;
      }
      button:hover {
        background: #44335d;
      }
      button[aria-pressed='true'],
      .reward a {
        background: #eaf87f;
        color: #21193a;
      }
      .picker button {
        text-align: left;
      }
      .picker small {
        display: block;
        margin-top: 7px;
        font-weight: 400;
      }
      :is(a, button):focus-visible {
        outline: 3px solid #eaf87f;
        outline-offset: 4px;
      }
      [hidden] {
        display: none !important;
      }
      .stage {
        border: 1px solid #6e5b91;
        border-radius: 14px;
        padding: clamp(18px, 4vw, 30px);
        background: #211532;
      }
      .stage:focus {
        outline: none;
      }
      h2 {
        font-size: 30px;
        margin: 0 0 12px;
      }
      p {
        line-height: 1.5;
      }
      .reward:not(:empty) {
        margin-top: 24px;
        padding: 20px;
        border: 1px solid #eaf87f;
        border-radius: 12px;
        background: #303222;
      }
      .reward a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
      }
      .note {
        font-size: 13px;
        color: #d4c6e6;
      }
      .motion-status {
        color: #ddd1ef;
      }
      .scratch-controls button {
        min-height: 44px;
      }
      .scratch-controls .motion-button {
        color: #21193a;
      }
      .sr-only {
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
      @media (max-width: 650px) {
        .picker {
          grid-template-columns: 1fr;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .scratch-canvas {
          transition: none;
        }
      }
    `,
  ];

  override firstUpdated() {
    this.mountGame();
  }

  private choose = async (index: number) => {
    this.selected = index;
    await this.updateComplete;
    this.mountGame();
    this.renderRoot.querySelector<HTMLElement>('.stage')?.focus({ preventScroll: true });
  };

  private mountGame() {
    const stage = this.renderRoot.querySelector<HTMLElement>('.stage');
    const reward = this.renderRoot.querySelector<HTMLElement>('.reward');
    const game = concepts[this.selected];
    if (!stage || !reward || !game) return;
    stage.replaceChildren();
    reward.replaceChildren();
    const button = (label: string, fn: () => void) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'button button-secondary';
      el.textContent = label;
      el.addEventListener('click', fn);
      return el;
    };
    const complete = () => {
      if (reward.children.length) return;
      const heading = document.createElement('h3');
      heading.textContent = 'Souvenir card unlocked!';
      const copy = document.createElement('p');
      copy.textContent =
        'Open your reward, then scratch or choose Reveal to save it in My Collection.';
      const link = document.createElement('a');
      link.href = `/hunt/c/${rewards[this.selected]}/`;
      link.textContent = 'Scratch my souvenir card ↗';
      reward.append(heading, copy, link);
    };
    game.render(stage, { scratch, button, complete, resetReward: () => reward.replaceChildren() });
  }

  override render() {
    return html`<h2>Recovered from the Scratch Lab</h2>
      <p>
        Defeat a suspicious pop-up, contain a rogue paperclip, or rescue a website stuck at 99%
        since 2002. Finish a game to unlock a collectible souvenir card.
      </p>
      <div class="picker" role="group" aria-label="Choose a Scratch Lab game">
        ${concepts.map((game, index) => html`<button aria-pressed=${this.selected === index} @click=${() => this.choose(index)}>${game.title}<small>${game.tagline}</small></button>`)}
      </div>
      <div class="stage" tabindex="-1" aria-label="Scratch Lab game"></div>
      <div class="reward" role="status"></div>
      <p class="note">
        No timer. Scratch or use Reveal. These are playful browser souvenirs, not prizes, votes or
        competition entries. Unlocked links can be shared. Already collected cards remain in your
        binder when you replay.
      </p>`;
  }
}
