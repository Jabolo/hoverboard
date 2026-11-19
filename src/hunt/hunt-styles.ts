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
    display: grid;
    grid-template-columns: minmax(0, 1.65fr) minmax(220px, 1fr);
    gap: clamp(16px, 4vw, 44px);
    align-items: end;
    margin-bottom: 24px;
    padding: clamp(20px, 4.5vw, 42px);
    border-radius: 16px;
    background:
      radial-gradient(ellipse at 76% -10%, #613c65 0%, transparent 62%),
      radial-gradient(ellipse at 58% 130%, #313963 0%, transparent 68%), #25173f;
  }

  .collection-header h1 {
    font-size: clamp(2.55rem, 7vw, 5.15rem);
    letter-spacing: -0.04em;
  }

  .collection-header h1 + p {
    max-width: 58ch;
    margin-top: 10px;
    color: var(--hunt-muted);
    line-height: 1.5;
  }

  .hunt-shell h1:focus {
    outline: none;
  }

  @media (max-width: 630px) {
    .collection-header {
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
      margin-bottom: 14px;
    }
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
    margin-top: 2px;
  }

  .collection-link {
    margin-bottom: 14px;
  }

  .collection-summary {
    display: grid;
    gap: 7px;
    border-top: 1px solid #846e9b;
    padding-top: 10px;
  }

  .collection-tools {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px 16px;
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--hunt-line);
  }

  .code-panel[open] {
    flex: 1 1 260px;
  }

  .code-panel summary {
    cursor: pointer;
    color: #e7d8ff;
    width: fit-content;
    min-height: 44px;
    padding: 11px 0;
    text-underline-offset: 0.22em;
  }

  .code-panel summary:hover {
    text-decoration: underline;
  }

  .code-panel form {
    max-width: 440px;
    margin-top: 7px;
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

  .album-motion .motion-button {
    background: transparent;
    color: #ebdfef;
    border-color: #82709b;
  }

  .album-motion .motion-button:not(:disabled):hover {
    background: #392b4e;
  }

  .folders {
    --album-rotate-x: 0deg;
    --album-rotate-y: 0deg;
    --album-sheen-x: 0%;
    display: grid;
    gap: 16px;
  }

  .folder {
    --deck-paper: #f0dcea;
    --deck-colour: #d6a8ec;
    --deck-prism: #b3c5fa;
    min-width: 0;
    padding: clamp(13px, 2.8vw, 23px);
    border: 1px solid #55486e;
    border-radius: 16px;
    background: linear-gradient(135deg, #2a2140, #1c172c 70%);
  }

  .folder[data-group='play'] {
    --deck-paper: #f0ebcf;
    --deck-colour: #cddd87;
    --deck-prism: #f4c0c8;
  }

  .folder[data-group='venue'] {
    --deck-paper: #e1efe9;
    --deck-colour: #9fddc6;
    --deck-prism: #b9b0ed;
  }

  .folder[data-group='mystery'] {
    --deck-paper: #e6e4f8;
    --deck-colour: #acafe5;
    --deck-prism: #c5e2e0;
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
    margin-top: 4px;
  }

  .finds {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: clamp(8px, 1.3vw, 14px);
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
  }

  .finds > li {
    --foil-offset: -1.1s;
    min-width: 0;
  }

  .finds > li:nth-child(3n + 2) {
    --foil-offset: -3.1s;
  }

  .finds > li:nth-child(3n + 3) {
    --foil-offset: -5.1s;
  }

  .find {
    --hover-angle: 0deg;
    position: relative;
    isolation: isolate;
    overflow: hidden;
    display: flex;
    min-width: 0;
    min-height: 120px;
    width: 100%;
    height: 100%;
    aspect-ratio: 1.48;
    flex-direction: column;
    justify-content: space-between;
    gap: 12px;
    padding: clamp(9px, 1.5vw, 15px);
    border: 1px solid #594d71;
    border-radius: 12px;
    text-align: left;
    text-decoration: none;
    color: #291534;
    background: var(--deck-paper);
    box-shadow: 0 4px 10px rgb(12 8 21 / 34%);
    transform: perspective(650px) rotateX(var(--album-rotate-x))
      rotateY(calc(var(--album-rotate-y) + var(--hover-angle)));
    transition:
      transform 160ms ease-out,
      border-color 160ms ease-out;
  }

  .find:is(a, button):hover {
    --hover-angle: -5deg;
    border-color: #f3d8fe;
  }

  .find::before,
  .find::after,
  .foil-art {
    position: absolute;
    z-index: -1;
    pointer-events: none;
  }

  .find::before {
    content: '';
    inset: 5px;
    border: 1px solid rgb(53 36 75 / 29%);
    border-radius: 8px;
  }

  .foil-art {
    right: -22%;
    bottom: -67%;
    width: 95%;
    aspect-ratio: 1;
    border-radius: 50%;
    background:
      radial-gradient(
        circle,
        transparent 0 9%,
        rgb(56 39 89 / 31%) 9.5% 12%,
        transparent 12.5% 19%,
        rgb(255 255 255 / 52%) 19.5% 20%,
        transparent 20.5% 58%,
        rgb(82 60 116 / 31%) 58.5% 59%,
        transparent 59.5% 66%,
        rgb(255 255 255 / 61%) 66.5% 67.5%,
        transparent 68%
      ),
      conic-gradient(
        from 95deg,
        var(--deck-paper),
        var(--deck-colour),
        var(--deck-prism),
        var(--deck-paper),
        var(--deck-prism),
        var(--deck-colour),
        var(--deck-paper)
      );
    box-shadow: inset 0 0 0 1px rgb(50 34 72 / 30%);
  }

  .find::after {
    content: '';
    inset: -85% -30%;
    background: linear-gradient(
      112deg,
      transparent 33%,
      rgb(255 255 255 / 45%) 46%,
      rgb(255 255 255 / 10%) 51%,
      transparent 63%
    );
    animation: album-sheen 8s var(--foil-offset) ease-in-out infinite alternate;
  }

  @keyframes album-sheen {
    from {
      transform: translateX(calc(-36% + var(--album-sheen-x)));
    }
    to {
      transform: translateX(calc(34% + var(--album-sheen-x)));
    }
  }

  .find.found {
    color: #fff1ff;
    background: linear-gradient(145deg, #4e3b72, #32284f 66%);
  }

  .find.found .foil-art {
    opacity: 0.5;
  }

  .find.found::before {
    border-color: rgb(244 216 255 / 27%);
  }

  .find-title {
    position: relative;
    overflow-wrap: anywhere;
    font-size: clamp(0.95rem, 1.9vw, 1.22rem);
    font-weight: 800;
    line-height: 1.13;
    text-wrap: pretty;
  }

  .find-action,
  .perfect-stamp {
    position: relative;
    align-self: flex-start;
    border-radius: 4px;
    padding: 3px 6px;
    color: #fdf1ff;
    background: #342144;
    font-size: 0.75rem;
    font-weight: 700;
    line-height: 1.15;
  }

  .perfect-stamp {
    color: #162113;
    background: #e7f778;
  }

  .find.unknown {
    justify-content: center;
    align-items: center;
    color: #d2c4e6;
    background: linear-gradient(145deg, #3c3157, #211b33 67%);
  }

  .find.unknown .foil-art {
    opacity: 0.31;
    filter: grayscale(0.7);
  }

  .find.unknown::before {
    border-color: #645782;
  }

  .find.unknown::after {
    opacity: 0.35;
  }

  .unknown-mark {
    color: #d0c1e3;
    font-size: clamp(1.7rem, 5vw, 2.55rem);
    font-weight: 750;
    line-height: 1;
  }

  @media (max-width: 870px) {
    .finds {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 520px) {
    .finds {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
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

  .replay-action,
  .close-replay {
    justify-self: start;
    border: 1px solid #4e3960;
    color: #342144;
    background: #eee1ee;
  }

  dialog {
    max-width: min(570px, calc(100% - 28px));
    max-height: calc(100% - 26px);
    padding: 0;
    border: 0;
    border-radius: 16px;
    background: #f3ecd9;
    color: #201831;
    box-shadow: 0 18px 60px rgb(0 0 0 / 56%);
  }

  dialog::backdrop {
    background: rgb(14 8 26 / 79%);
  }

  .replay-ticket {
    width: min(530px, 100%);
    box-shadow: none;
  }

  .replay-header {
    display: flex;
    flex-wrap: wrap;
    align-items: start;
    justify-content: space-between;
    gap: 8px 16px;
    margin-bottom: 14px;
  }

  .replay-header h2 {
    overflow-wrap: anywhere;
    font-size: clamp(1.4rem, 5vw, 2.2rem);
    max-width: 23ch;
  }

  .replay-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    margin-top: 8px;
    color: #4f2775;
    text-underline-offset: 0.2em;
    font-weight: 700;
  }

  .scratch-answer:not(:empty) {
    display: grid;
    place-items: center;
    padding: 12px;
    overflow: hidden;
    text-align: center;
    font-size: clamp(0.88rem, 3.5vw, 1.17rem);
    line-height: 1.24;
    white-space: pre-line;
  }

  .reveal-result p {
    font-size: clamp(1.02rem, 3vw, 1.18rem);
    white-space: pre-line;
  }

  .reveal-result :is(h2, h3) {
    margin: 0;
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

  :is(button, a, input, summary):focus-visible {
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
    .album-motion {
      display: none;
    }

    .scratch-canvas,
    .find {
      transition: none;
    }

    .find {
      transform: none;
    }

    .find::after {
      animation: none;
      transform: translateX(-12%);
    }
  }
`;
