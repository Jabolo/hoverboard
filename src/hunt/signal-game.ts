import { css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ThemedElement } from '../components/themed-element';
import { hasHuntPerfect, rememberHuntPerfect } from './hunt-store.js';

const signals = ['Noise', 'Clear signal', 'Busy tone', 'Interference'];
const normalGoal = 4;
const duration = 30_000;
const bestKey = 'devfest-signal-hardcore-best:v1';
let sessionBest = 0;

@customElement('hunt-signal-game')
export class HuntSignalGame extends ThemedElement {
  @property({ attribute: false }) cardId = '';
  @state() private running = false;
  @state() private mode: 'normal' | 'hardcore' = 'normal';
  @state() private target = 1;
  @state() private remaining = duration;
  @state() private best = 0;
  @state() private storageUnavailable = false;
  @state() private completed = false;
  private deadline = 0;
  private lastCatch = -Infinity;
  private clockTimer: number | undefined;
  @state() private stepMode = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  @state() private attempts = 0;
  @state() private score = 0;
  @state() private signal = 0;
  @state() private feedback = '';
  private timer: number | undefined;

  static override get styles() {
    return [
      ...super.styles,
      css`
        :host {
          display: block;
          margin-top: 16px;
          color: #f6f2ff;
        }
        section {
          display: grid;
          gap: 12px;
          border: 1px solid #6e5b91;
          border-radius: 15px;
          padding: clamp(16px, 4vw, 28px);
          background: #271a3e;
        }
        h2 {
          font-size: 1.35rem;
        }
        p {
          margin: 0;
          color: #e2d7f5;
          line-height: 1.45;
        }
        .dial {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          min-height: 45px;
          border: 1px solid #82709e;
          border-radius: 8px;
          padding: 8px 12px;
          color: #e2d7f5;
          background: #151023;
        }
        .lamps {
          display: flex;
          gap: 5px;
        }
        .lamp {
          display: block;
          width: 22px;
          height: 22px;
          border: 1px solid #b7a5cc;
          border-radius: 50%;
        }
        .lamp.clear {
          border: 3px solid #e7f778;
        }
        .scoreboard {
          display: flex;
          flex-wrap: wrap;
          gap: 10px 22px;
          font: 700 16px monospace;
        }
        .modes {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .modes button[aria-pressed='true'] {
          border-color: #e7f778;
          color: #151023;
          background: #e7f778;
        }
        button:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .lamp.active {
          background: #e2c9ff;
        }
        .dial strong.clear {
          color: #8df3a9;
        }
        .lamp.active.hit {
          background: #8df3a9;
        }
        .lamp.active.clear {
          background: #e7f778;
        }
        .control {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }
        button {
          min-height: 44px;
          border: 1px solid #e7f778;
          border-radius: 7px;
          padding: 7px 12px;
          background: #e7f778;
          color: #151023;
          font: inherit;
          font-weight: 750;
          cursor: pointer;
        }
        button.secondary {
          border-color: #82709e;
          background: transparent;
          color: #f6f2ff;
        }
        label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          width: fit-content;
          min-height: 44px;
          cursor: pointer;
        }
        input {
          width: 18px;
          height: 18px;
          accent-color: #e7f778;
        }
        :is(button, input):focus-visible {
          outline: 3px solid #d4b4ff;
          outline-offset: 3px;
        }
        .feedback {
          min-height: 1.45em;
        }
        .transmission {
          display: grid;
          gap: 9px;
          position: relative;
          overflow: hidden;
          padding: clamp(14px, 4vw, 22px);
          border: 1px solid #aebb69;
          border-radius: 10px;
          color: #f1f6d5;
          background: radial-gradient(ellipse at 95% 100%, #45425c, transparent 72%), #263025;
        }
        .transmission::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0;
          background: linear-gradient(110deg, transparent 33%, #dbe78d55 50%, transparent 67%);
        }
        .transmission.perfect::after {
          animation: signal-sweep 900ms ease-out;
        }
        @keyframes signal-sweep {
          from {
            transform: translateX(-100%);
            opacity: 0.8;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
        .transmission h3,
        .transmission p {
          margin: 0;
          color: inherit;
        }
        .transmission h3 {
          font-size: 1.16rem;
        }
        @media (prefers-reduced-motion: reduce) {
          .transmission.perfect::after {
            animation: none;
          }
        }
      `,
    ];
  }

  override connectedCallback() {
    super.connectedCallback();
    this.best = sessionBest;
    try {
      const saved = Number(window.localStorage.getItem(bestKey));
      if (Number.isSafeInteger(saved) && saved > this.best && saved <= 1000) this.best = saved;
    } catch {
      this.storageUnavailable = true;
    }
    document.addEventListener('visibilitychange', this.tickClock);
  }

  override disconnectedCallback() {
    if (this.running) this.finish(`Run stopped when you left. ${this.score} signals caught.`);
    this.clearTimers();
    document.removeEventListener('visibilitychange', this.tickClock);
    super.disconnectedCallback();
  }

  private clearTimers() {
    window.clearInterval(this.timer);
    window.clearInterval(this.clockTimer);
    this.timer = undefined;
    this.clockTimer = undefined;
  }

  private get speed() {
    return this.mode === 'hardcore' ? Math.max(280, 720 - this.attempts * 35) : 720;
  }

  private saveBest() {
    if (this.mode !== 'hardcore') return;
    let record = Math.max(this.best, sessionBest);
    try {
      const saved = Number(window.localStorage.getItem(bestKey));
      if (Number.isSafeInteger(saved) && saved >= 0 && saved <= 1000)
        record = Math.max(record, saved);
    } catch {
      this.storageUnavailable = true;
    }
    this.best = Math.max(record, this.score);
    sessionBest = this.best;
    try {
      window.localStorage.setItem(bestKey, String(this.best));
    } catch {
      this.storageUnavailable = true;
    }
  }

  private finish(message: string) {
    this.clearTimers();
    this.running = false;
    this.saveBest();
    this.feedback = message;
  }

  private readonly tickClock = () => {
    if (!this.running || this.mode !== 'hardcore') return;
    this.remaining = Math.max(0, this.deadline - performance.now());
    if (this.remaining === 0)
      this.finish(`Time! ${this.score} signals caught. Go again and beat your best!`);
  };

  private readonly nextSignal = () => {
    this.tickClock();
    if (this.running) this.signal = (this.signal + 1) % signals.length;
  };

  private setSignalTimer() {
    window.clearInterval(this.timer);
    if (this.mode === 'hardcore' || !this.stepMode)
      this.timer = window.setInterval(this.nextSignal, this.speed);
  }

  private start() {
    this.clearTimers();
    this.score = 0;
    this.attempts = 0;
    this.completed = false;
    this.feedback =
      this.mode === 'hardcore'
        ? 'Wait for “Clear signal”, then catch it. How many can you catch?'
        : '';
    this.target = this.mode === 'hardcore' ? Math.floor(Math.random() * 4) : 1;
    this.signal = (this.target + 1 + Math.floor(Math.random() * 3)) % 4;
    this.lastCatch = -Infinity;
    this.remaining = duration;
    this.deadline = performance.now() + duration;
    this.running = true;
    this.setSignalTimer();
    if (this.mode === 'hardcore') this.clockTimer = window.setInterval(this.tickClock, 100);
  }

  private readonly play = () => {
    if (!this.running) {
      this.start();
      return;
    }
    this.tickClock();
    if (!this.running) return;
    const now = performance.now();
    if (this.mode === 'hardcore' && now - this.lastCatch < 250) return;
    this.lastCatch = now;
    const caught = this.signal === this.target;
    this.attempts++;
    if (caught) this.score++;
    if (this.mode === 'normal') {
      if (this.score === normalGoal) {
        this.completed = true;
        if (this.attempts === normalGoal && this.cardId) rememberHuntPerfect(this.cardId);
        this.finish(
          `All four caught in ${this.attempts} tries! ${this.attempts === normalGoal ? 'Perfect signal. Bonus transmission unlocked.' : 'Try a clean four for the bonus transmission.'}`,
        );
        return;
      }
      this.feedback = `${caught ? 'Signal caught' : 'Missed it. Try again'}. ${normalGoal - this.score} more to catch.`;
      this.nextSignal();
    } else {
      this.saveBest();
      if (!caught) this.deadline -= 2000;
      this.tickClock();
      if (!this.running) return;
      this.feedback = caught
        ? `${this.score} caught! Target moved. Keep the streak alive!`
        : 'Missed! −2 seconds. Find the new target.';
      this.target = (this.target + 1 + Math.floor(Math.random() * 3)) % 4;
      this.signal = (this.target + 1 + Math.floor(Math.random() * 3)) % 4;
    }
    this.setSignalTimer();
  };

  private readonly changeMode = (event: Event) => {
    this.stepMode = (event.currentTarget as HTMLInputElement).checked;
  };

  private chooseMode(mode: 'normal' | 'hardcore') {
    if (this.running) return;
    this.mode = mode;
    this.score = 0;
    this.attempts = 0;
    this.completed = false;
    this.feedback = '';
    this.remaining = duration;
  }

  protected override render() {
    const perfect = this.mode === 'normal' && this.completed && this.attempts === normalGoal;
    return html` <section aria-labelledby="signal-title">
      <h2 id="signal-title">Signal Catch</h2>
      <div class="modes" role="group" aria-label="Game mode">
        <button
          class="secondary"
          aria-pressed=${this.mode === 'normal'}
          ?disabled=${this.running}
          @click=${() => this.chooseMode('normal')}
        >
          Normal
        </button>
        <button
          class="secondary"
          aria-pressed=${this.mode === 'hardcore'}
          ?disabled=${this.running}
          @click=${() => this.chooseMode('hardcore')}
        >
          Hardcore
        </button>
      </div>
      <p>
        ${this.mode === 'normal' ? 'Catch four clear signals to finish. Misses are practice. Choose step mode for an untimed game.' : '30 seconds. Catch when the display says “Clear signal”! Its position changes after every try, with no target hint, and the signal gets faster. Misses cost 2 seconds.'}
      </p>
      <div class="scoreboard" aria-label="Game statistics">
        <span>Score: ${this.score}${this.mode === 'normal' ? ' / 4' : ''}</span>
        ${this.mode === 'hardcore' ? html`<span>Time: ${Math.ceil(this.remaining / 1000)}s</span><span>Best: ${this.best}</span>` : nothing}
      </div>
      <div class="dial" aria-live=${this.mode === 'normal' && this.stepMode ? 'polite' : 'off'}>
        <div class="lamps" aria-hidden="true">
          ${signals.map((_, index) => html`<span class="lamp ${this.running && index === this.signal ? 'active' : ''} ${this.mode === 'normal' && index === this.target ? 'clear' : ''} ${this.mode === 'hardcore' && this.running && this.signal === this.target && index === this.signal ? 'hit' : ''}"></span>`)}
        </div>
        <strong
          class=${this.mode === 'hardcore' && this.running && this.signal === this.target ? 'clear' : ''}
          >${this.running ? (this.signal === this.target ? 'Clear signal' : signals.filter((_, index) => index !== 1)[this.signal % 3]) : 'Ready when you are'}</strong
        >
      </div>
      <div class="control">
        <button
          type="button"
          @keydown=${(event: KeyboardEvent) => {
            if (event.repeat) event.preventDefault();
          }}
          @click=${this.play}
        >
          ${this.running ? 'Catch signal' : this.attempts || this.feedback ? 'Play again' : 'Start game'}
        </button>
        ${this.running && this.mode === 'normal' && this.stepMode ? html`<button class="secondary" type="button" @click=${this.nextSignal}>Next signal</button>` : nothing}
        ${this.running ? html`<button class="secondary" @click=${() => this.finish(`Run stopped. ${this.score} signals caught.`)}>Stop game</button>` : nothing}
      </div>
      ${!this.running && this.mode === 'normal' ? html`<label><input type="checkbox" .checked=${this.stepMode} @change=${this.changeMode} /> Step mode (no timer)</label>` : nothing}
      ${this.mode === 'hardcore' ? html`<p>Best is saved ${this.storageUnavailable ? 'for this visit only (browser storage unavailable)' : 'on this browser only'}. No online leaderboard. For untimed play, choose Normal.</p>` : nothing}
      <p class="feedback" role="status">${this.feedback}</p>
      ${
        !this.running && (perfect || (this.cardId && hasHuntPerfect(this.cardId)))
          ? html`<div class="transmission ${perfect ? 'perfect' : ''}">
              <h3>Bonus transmission</h3>
              <p>
                ${this.cardId ? 'Your collection keeps its Signal stamp.' : 'Four clean catches. Perfect reception!'}
              </p>
              <p>
                Bonus build prompt: make a loading screen that gets impatient with the person using
                it.
              </p>
            </div>`
          : nothing
      }
    </section>`;
  }
}
