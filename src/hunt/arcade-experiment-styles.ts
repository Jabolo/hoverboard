import { css } from 'lit';
export const experimentStyles = css`
  .games-stage {
    display: grid;
    gap: 1.5rem;
  }
  .games-intro {
    max-width: 62ch;
  }
  .games-intro h2 {
    margin: 0 0 0.5rem;
    font-size: clamp(1.5rem, 4vw, 2.5rem);
    line-height: 1.08;
  }
  .games-intro p {
    line-height: 1.55;
    margin: 0;
  }
  .games-boss-arena {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1fr);
    gap: 1rem;
    align-items: stretch;
  }
  .games-boss-screen,
  .games-console,
  .games-window {
    background: #101339;
    color: #f7f7ff;
    border: 2px solid #9699fb;
    border-radius: 12px;
    overflow: hidden;
  }
  .games-boss-screen {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    min-height: 16rem;
  }
  .games-window-title {
    display: block;
    align-self: stretch;
    background: #c3c6ff;
    color: #11143c;
    padding: 0.55rem 0.8rem;
    font-weight: 800;
    letter-spacing: 0.02em;
  }
  .games-boss-face {
    font-family: monospace;
    font-size: clamp(4rem, 10vw, 6.5rem);
    font-weight: 900;
    color: #f6e558;
    line-height: 1;
    padding: 1.5rem 0 0.7rem;
  }
  .games-boss-taunt {
    font-weight: 700;
    line-height: 1.4;
    flex: 1;
    max-width: 26ch;
  }
  .games-readout {
    font-family: monospace;
    font-weight: 800;
    letter-spacing: 0.02em;
    line-height: 1.5;
    color: #eaf26d;
  }
  .games-action-area {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    justify-content: center;
    min-width: 0;
  }
  .games-panel {
    min-width: 0;
  }
  .games-win {
    padding: 1rem;
    background: #eaf26d;
    color: #151538;
    border-radius: 12px;
    font-weight: 800;
  }
  .games-console,
  .games-window {
    padding: 1.25rem;
  }
  .games-console-copy {
    line-height: 1.5;
  }
  .games-clue-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.8rem;
    align-items: stretch;
  }
  .games-clue-grid > * {
    min-width: 0;
  }
  .games-choices {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin: 1rem 0;
  }
  .games-result {
    min-height: 1.5em;
    font-weight: 700;
    line-height: 1.45;
  }
  .games-cd-result {
    color: #fff;
    line-height: 1.55;
  }
  .games-cd-result h3 {
    color: #eaf26d;
  }
  .games-stage button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  @media (max-width: 700px) {
    .games-boss-arena {
      grid-template-columns: 1fr;
    }
    .games-clue-grid {
      grid-template-columns: 1fr;
    }
    .games-boss-screen {
      min-height: 13rem;
    }
  }

  .scratch-widget {
    min-width: 0;
    width: 100%;
  }
  .scratch-surface {
    position: relative;
    isolation: isolate;
    min-height: 150px;
    border-radius: 10px;
    overflow: hidden;
    background: #f6f2db;
    color: #1f1533;
  }
  .scratch-answer {
    min-height: 150px;
    padding: 1.5rem;
    display: grid;
    place-items: center;
    text-align: center;
    font-size: clamp(1.05rem, 2vw, 1.4rem);
    font-weight: 900;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .scratch-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: crosshair;
    transition: opacity 0.3s ease;
  }
  .scratch-instruction {
    position: absolute;
    pointer-events: none;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 1rem;
    text-align: center;
    color: #231635;
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    text-shadow: 0 1px 5px #fff;
  }
  .scratch-instruction[hidden] {
    display: none;
  }
  .scratch-controls {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    padding-top: 0.5rem;
    font-size: 0.76rem;
    line-height: 1.3;
  }
  .reveal-button {
    border: 1px solid currentColor;
    border-radius: 5px;
    background: transparent;
    color: inherit;
    padding: 0.45rem 0.65rem;
    font-weight: 800;
    min-width: 74px;
  }
  .reveal-button:disabled {
    opacity: 0.7;
    cursor: default;
  }
  .motion-button {
    border: 0;
    border-radius: 5px;
    background: #e7f778;
    color: #17152b;
    padding: 0.65rem 0.8rem;
    min-height: 42px;
    font-size: 0.8rem;
    font-weight: 800;
  }
  .motion-button:disabled {
    opacity: 0.75;
    cursor: default;
  }
  .motion-status {
    flex-basis: 100%;
    line-height: 1.4;
  }
`;
