import { css } from 'lit';

export const huntStyles = css`
  :host {
    --hunt-ink: #15112a;
    --hunt-text: #f6f2ff;
    --hunt-muted: #cec2e6;
    --hunt-line: #57486f;
    --hunt-panel: #251b3c;
    --hunt-lime: #e7f778;
    background: #151023;
    color: var(--hunt-text);
  }

  .hunt-shell {
    margin-inline: auto;
    padding: clamp(28px, 7vw, 78px) min(5vw, 28px) 56px;
    width: 100%;
    max-width: 1040px;
  }

  .card-page {
    max-width: 650px;
  }

  h1,
  h2,
  p {
    margin: 0;
  }

  h1 {
    font-family: var(--font-family);
    letter-spacing: -0.06em;
    line-height: 0.95;
    font-weight: 800;
    overflow-wrap: anywhere;
  }

  .kicker {
    margin-bottom: 14px;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .collection-header {
    border: 1px solid var(--hunt-line);
    border-radius: 22px;
    padding: clamp(22px, 5.2vw, 54px);
    margin-bottom: 14px;
    background:
      radial-gradient(ellipse at 95% 7%, #5c386b 0%, transparent 67%),
      radial-gradient(ellipse at 62% 120%, #292f56 0%, transparent 62%), #231637;
  }

  .collection-header .kicker {
    color: var(--hunt-lime);
  }

  .collection-header h1 {
    font-size: clamp(2.6rem, 9vw, 6.1rem);
  }

  .collection-header h1 + p {
    max-width: 52ch;
    margin-top: 19px;
    color: var(--hunt-muted);
    line-height: 1.55;
  }

  .hunt-link {
    display: inline-flex;
    align-items: center;
    gap: 0.45em;
    min-height: 44px;
    color: var(--hunt-lime);
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 0.26em;
  }

  .collection-header .hunt-link {
    margin-top: 7px;
  }

  .collection-link {
    margin-bottom: 14px;
  }

  .collection-summary,
  .code-panel {
    display: grid;
    gap: 8px;
    margin-bottom: 14px;
    padding: clamp(16px, 4vw, 27px);
    border: 1px solid var(--hunt-line);
    border-radius: 15px;
    background: var(--hunt-panel);
  }

  .collection-summary h2 {
    font-family: var(--font-family);
    font-size: clamp(1.45rem, 4vw, 1.85rem);
    font-weight: 600;
  }

  .collection-summary strong {
    color: var(--hunt-lime);
    font-variant-numeric: tabular-nums;
  }

  progress {
    width: 100%;
    height: 10px;
    margin-block: 3px;
    border: 0;
    border-radius: 999px;
    appearance: none;
    background: #100b1e;
    color: var(--hunt-lime);
  }

  progress::-webkit-progress-bar {
    border-radius: 999px;
    background: #100b1e;
  }

  progress::-webkit-progress-value {
    border-radius: 999px;
    background: var(--hunt-lime);
  }

  progress::-moz-progress-bar {
    border-radius: 999px;
    background: var(--hunt-lime);
  }

  .collection-summary p,
  .code-panel p,
  .folder-heading p,
  .folder-hint,
  .unknown p,
  .hunt-credit,
  .notice {
    color: var(--hunt-muted);
    font-size: 0.94rem;
    line-height: 1.48;
  }

  .code-panel form {
    display: grid;
    gap: 8px;
  }

  .code-panel label,
  .folder-heading h2 {
    font-family: var(--font-family);
    font-size: 1.14rem;
    font-weight: 800;
  }

  .code-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .code-row input {
    flex: 1 1 130px;
    min-width: 0;
    min-height: 44px;
    padding: 8px 12px;
    border: 1px solid #8e79af;
    border-radius: 8px;
    background: #171026;
    color: var(--hunt-text);
    font: 600 1rem var(--font-mono);
  }

  .code-row input[aria-invalid='true'] {
    border-color: #ffb2c7;
  }

  button {
    cursor: pointer;
    border-radius: 8px;
    min-height: 44px;
    padding: 8px 14px;
    font: inherit;
    font-weight: 750;
  }

  button:disabled {
    cursor: default;
  }

  .primary,
  .motion-button {
    border: 1px solid var(--hunt-lime);
    background: var(--hunt-lime);
    color: var(--hunt-ink);
  }

  .primary:hover,
  .motion-button:not(:disabled):hover {
    background: #f1ffae;
  }

  .secondary {
    margin-left: 8px;
    border: 1px solid var(--hunt-line);
    color: var(--hunt-text);
    background: var(--hunt-panel);
  }

  .folders {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 355px), 1fr));
    align-items: start;
    gap: 12px;
  }

  .folder {
    min-width: 0;
    padding: 16px;
    border: 1px solid var(--hunt-line);
    border-radius: 15px;
    background: var(--hunt-panel);
  }

  .folder-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 3px 12px;
  }

  .folder-heading p {
    font-variant-numeric: tabular-nums;
  }

  .folder-hint {
    margin-top: 6px;
  }

  .finds {
    display: grid;
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
    gap: 7px;
  }

  .find {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: 8px;
    min-height: 46px;
    padding: 8px 10px;
    border: 1px solid var(--hunt-line);
    border-radius: 8px;
    background: #171026;
    color: var(--hunt-text);
    text-decoration: none;
  }

  .find:hover {
    border-color: #ac96d0;
  }

  .find-icon {
    width: 1em;
    color: #cfb2ff;
  }

  .find.earned .find-icon,
  .find.found .find-action {
    color: var(--hunt-lime);
  }

  .find-title {
    flex: 1 1 115px;
    overflow-wrap: anywhere;
    font-weight: 700;
  }

  .find-action {
    color: var(--hunt-muted);
    font-size: 0.85rem;
  }

  .unknown {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
    padding: 7px 10px;
    border: 1px dashed #6d5a8d;
    border-radius: 8px;
  }

  .unknown-icon {
    display: grid;
    place-items: center;
    width: 22px;
    height: 26px;
    border-radius: 5px;
    border: 1px solid var(--hunt-line);
    color: var(--hunt-muted);
    background: #171026;
    font-family: var(--font-mono);
  }

  .notice {
    margin-bottom: 14px;
  }

  .hunt-credit {
    display: grid;
    gap: 8px;
    padding-top: 18px;
    margin-top: 24px;
    border-top: 1px solid var(--hunt-line);
  }

  .hunt-credit a {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 0.19em;
  }

  .ticket,
  .card-status {
    padding: clamp(17px, 5.2vw, 42px);
    border-radius: clamp(16px, 4vw, 26px);
  }

  .ticket {
    color: #201831;
    background: #f3ecd9;
    box-shadow: 0 18px 44px rgb(8 4 15 / 38%);
  }

  .ticket .kicker {
    color: #5f416e;
  }

  .ticket h1,
  .card-status h1 {
    font-size: clamp(2.05rem, 7.75vw, 4.4rem);
    margin-bottom: clamp(14px, 4vw, 26px);
  }

  .card-status {
    background: var(--hunt-panel);
    border: 1px solid var(--hunt-line);
  }

  .card-status p + button {
    margin-top: 16px;
  }

  .reveal-result {
    display: grid;
    gap: 8px;
    border: 1px solid #9c91a4;
    border-radius: 11px;
    padding: clamp(13px, 3.8vw, 24px);
    background: #f9f2e5;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .reveal-result p {
    font-size: clamp(1.02rem, 3vw, 1.18rem);
    white-space: pre-line;
  }

  .reveal-result h2 {
    font-size: 0.82rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .reveal-issue:not(:empty) {
    margin-top: 12px;
    font-weight: 700;
  }

  .scratch-widget {
    min-width: 0;
  }

  .scratch-surface {
    position: relative;
    isolation: isolate;
    min-height: clamp(125px, 31vw, 192px);
    border-radius: 11px;
    overflow: hidden;
    background: #e9ddc2;
  }

  .scratch-answer {
    position: absolute;
    inset: 0;
    background:
      repeating-linear-gradient(0deg, transparent 0 7px, #ceb6d2 8px 9px),
      linear-gradient(125deg, #ffefd3, #dcc9e7 53%, #b8e9d8);
  }

  .scratch-canvas,
  .scratch-instruction {
    position: absolute;
    inset: 0;
  }

  .scratch-canvas {
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: crosshair;
    transition: opacity 0.3s ease;
  }

  .scratch-instruction {
    pointer-events: none;
    display: grid;
    place-items: center;
    padding: 1rem;
    text-align: center;
    color: #231635;
    font: 800 0.83rem var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    text-shadow: 0 1px 5px #fff;
  }

  .scratch-instruction[hidden] {
    display: none;
  }

  .scratch-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 12px;
    margin-top: 8px;
    font-size: 0.92rem;
  }

  .reveal-button {
    border: 1px solid #383047;
    background: transparent;
    color: inherit;
  }

  .reveal-button:hover {
    background: #e8ddc7;
  }

  .motion-button {
    border-color: #4a5722;
  }

  .motion-button:disabled,
  .reveal-button:disabled {
    opacity: 0.72;
  }

  .motion-status {
    flex-basis: 100%;
    color: #443851;
    font-size: 0.83rem;
  }

  :is(button, a, input):focus-visible {
    outline: 3px solid #d4b4ff;
    outline-offset: 3px;
  }

  .ticket button:focus-visible {
    outline-color: #4b226a;
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

  @media (prefers-reduced-motion: reduce) {
    .scratch-canvas {
      transition: none;
    }
  }
`;
