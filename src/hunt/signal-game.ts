import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ThemedElement } from '../components/themed-element';

const signals = ['Noise', 'Clear signal', 'Busy tone', 'Interference'];
const rounds = 5;

@customElement('hunt-signal-game')
export class HuntSignalGame extends ThemedElement {
  @state() private running = false;
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
          width: 12px;
          height: 12px;
          border: 1px solid #b7a5cc;
          border-radius: 50%;
        }
        .lamp.active {
          background: #e2c9ff;
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
      `,
    ];
  }

  override disconnectedCallback() {
    window.clearInterval(this.timer);
    super.disconnectedCallback();
  }

  private readonly nextSignal = () => {
    this.signal = (this.signal + 1) % signals.length;
  };

  private start() {
    this.score = 0;
    this.attempts = 0;
    this.feedback = '';
    this.signal = Math.floor(Math.random() * signals.length);
    this.running = true;
    if (!this.stepMode) this.timer = window.setInterval(this.nextSignal, 720);
  }

  private readonly play = () => {
    if (!this.running) {
      this.start();
      return;
    }

    const caught = this.signal === 1;
    this.attempts++;
    if (caught) this.score++;

    if (this.attempts === rounds) {
      window.clearInterval(this.timer);
      this.running = false;
      this.feedback = `Game over. You caught ${this.score} of ${rounds} signals.`;
      return;
    }

    this.feedback = `${caught ? 'Signal caught' : 'Missed that signal'}. ${rounds - this.attempts} left.`;
    this.nextSignal();
  };

  private readonly changeMode = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    this.stepMode = input.checked;
  };

  protected override render() {
    return html`
      <section aria-labelledby="signal-title">
        <h2 id="signal-title">Signal Catch</h2>
        <p>Catch the clear signal before it moves. You get ${rounds} tries.</p>
        <div class="dial" aria-live=${this.stepMode ? 'polite' : 'off'}>
          <div class="lamps" aria-hidden="true">
            ${signals.map((_, index) => html`<span class="lamp ${this.running && index === this.signal ? 'active' : ''} ${index === 1 ? 'clear' : ''}"></span>`)}
          </div>
          <strong>${this.running ? signals[this.signal] : 'Ready when you are'}</strong>
        </div>
        <div class="control">
          <button type="button" @click=${this.play}>
            ${this.running ? 'Catch signal' : this.attempts ? 'Play again' : 'Start game'}
          </button>
          ${
            this.running && this.stepMode
              ? html`<button class="secondary" type="button" @click=${this.nextSignal}>
                  Next signal
                </button>`
              : nothing
          }
        </div>
        ${
          !this.running
            ? html`<label
                ><input type="checkbox" .checked=${this.stepMode} @change=${this.changeMode} /> Step
                mode (no timer)</label
              >`
            : nothing
        }
        <p class="feedback" role="status">${this.feedback}</p>
      </section>
    `;
  }
}
