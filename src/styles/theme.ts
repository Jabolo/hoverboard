import { css } from 'lit';

export const theme = css`
  :host {
    /* Neon Terminal system: keep the official Google colors as signals on a
       dark, information-dense Hoverboard surface. */
    --google-blue: #4285f4;
    --google-green: #34a853;
    --google-yellow: #fbbc04;
    --google-red: #ea4335;
    --terminal-background: #070c14;
    --terminal-panel: #0d1727;
    --terminal-panel-raised: #112039;
    --terminal-line: #263d5e;
    --terminal-copy: #eaf2ff;
    --terminal-muted: #9bb0d0;
    --terminal-green: #7ef2a5;
    --terminal-blue: #4c8df7;
    --terminal-yellow: #fbd776;
    --terminal-red: #ff7b72;
    --brand-off-white: #f0f0f0;
    --terminal-code: 'SFMono-Regular', 'Roboto Mono', 'Cascadia Code', monospace;
    --google-blue-strong: #1967d2;
    --google-green-strong: #137333;
    --google-yellow-strong: #a15c00;
    --google-red-strong: #b3261e;
    --dark-primary-color: var(--google-blue-strong);
    --default-primary-color: var(--terminal-blue);
    --focused-color: #174ea6;
    --light-primary-color: #d2e3fc;
    --md-sys-color-primary: var(--default-primary-color);
    --md-sys-color-on-primary: #fff;
    --md-sys-color-primary-container: var(--primary-color-white);
    --md-sys-color-on-primary-container: var(--focused-color);
    --text-primary-color: var(--terminal-copy);
    --accent-color: var(--google-red);
    --primary-background-color: var(--terminal-background);
    --primary-text-color: var(--terminal-copy);
    --secondary-text-color: var(--terminal-muted);
    --disabled-text-color: #60708c;
    --divider-color: var(--terminal-line);
    --footer-background-color: #050910;
    --footer-text-color: var(--terminal-muted);
    --twitter-color: #4099ff;
    --facebook-color: #3b5998;
    --border-light-color: var(--terminal-line);
    --error-color: var(--google-red-strong);

    /* Custom */
    --default-background-color: var(--terminal-panel);
    --secondary-background-color: var(--terminal-panel);
    --additional-background-color: var(--terminal-panel-raised);
    --contrast-additional-background-color: #172a45;
    --animation: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    --slide-animation: 0.4s cubic-bezier(0, 0, 0.2, 1);
    --border-radius: 8px;
    --box-shadow: 0 10px 30px rgb(0 0 0 / 24%);
    --box-shadow-primary-color: 0 0 0 1px rgb(66 133 244 / 28%), 0 12px 30px rgb(66 133 244 / 18%);
    --box-shadow-primary-color-hover:
      0 0 0 1px rgb(126 242 165 / 60%), 0 16px 36px rgb(66 133 244 / 24%);
    --font-family:
      -apple-system, blinkmacsystemfont, 'Segoe UI', roboto, helvetica, arial, sans-serif,
      'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
    --font-mono: 'SFMono-Regular', 'Roboto Mono', 'Cascadia Code', 'Liberation Mono', monospace;
    --heading-font-family: var(--font-mono);
    --max-container-width: 1280px;
    --primary-color-transparent: rgb(66 133 244 / 12%);
    --primary-color-light: #79aafa;
    --primary-color-white: #e8f0fe;

    /* Labels */
    --gde: var(--google-blue);
    --wtm: var(--google-green);
    --gdg: var(--google-blue);

    /* Tags */
    --general: #9e9e9e;
    --android: #78c257;
    --web: #2196f3;
    --cloud: #3f51b5;
    --community: #e91e63;
    --design: #e91e63;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
    -moz-osx-font-smoothing: grayscale;
    -webkit-font-smoothing: antialiased;
  }

  body {
    font-family: var(--font-family);
    text-rendering: optimizelegibility;
    color: var(--primary-text-color);
    background: var(--primary-background-color);
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: 0;
    font-family: var(--heading-font-family);
    font-weight: 700;
    letter-spacing: -0.03em;
  }

  h1 {
    padding: 8px 8px 24px 14px;
    font-size: 24px;
    line-height: 30px;
    font-weight: 700;
  }

  a {
    color: var(--default-primary-color);
    text-decoration: none;
    transition: border-color var(--animation);
  }

  :focus-visible {
    outline: 2px solid var(--google-green);
    outline-offset: 3px;
  }

  md-outlined-button,
  md-filled-button,
  md-text-button {
    color: var(--default-primary-color);
    transition: background-color var(--animation);
  }

  md-outlined-button:hover,
  md-filled-button:hover,
  md-text-button:hover {
    background-color: var(--primary-color-transparent);
  }

  md-outlined-button[disabled],
  md-filled-button[disabled],
  md-text-button[disabled] {
    cursor: default;
    background-color: var(--primary-color-transparent);
    opacity: 0.8;
  }

  md-outlined-button[primary],
  md-filled-button[primary],
  md-text-button[primary] {
    background-color: var(--default-primary-color);
    color: var(--text-primary-color);
  }

  md-outlined-button[primary]:hover,
  md-filled-button[primary]:hover,
  md-text-button[primary]:hover {
    background-color: var(--primary-color-light);
  }

  md-outlined-button[primary][invert],
  md-filled-button[primary][invert],
  md-text-button[primary][invert] {
    color: var(--default-primary-color);
    background-color: var(--text-primary-color);
  }

  md-outlined-button[primary][invert]:hover,
  md-filled-button[primary][invert]:hover,
  md-text-button[primary][invert]:hover {
    background-color: var(--primary-color-white);
  }

  md-outlined-button[primary-text],
  md-filled-button[primary-text],
  md-text-button[primary-text] {
    color: var(--default-primary-color);
  }

  md-outlined-button.animated iron-icon,
  md-filled-button.animated iron-icon,
  md-text-button.animated iron-icon {
    transition: transform var(--animation);
  }

  md-outlined-button.animated.icon-right:hover iron-icon,
  md-filled-button.animated.icon-right:hover iron-icon,
  md-text-button.animated.icon-right:hover iron-icon {
    transform: translateX(4px);
  }

  md-outlined-button.animated.icon-left:hover iron-icon,
  md-filled-button.animated.icon-left:hover iron-icon,
  md-text-button.animated.icon-left:hover iron-icon {
    transform: translateX(-4px);
  }

  .container,
  .container-narrow {
    margin: 0 auto;
    padding: 24px 16px;
    max-width: var(--max-container-width);
  }

  .container-narrow {
    max-width: 800px;
  }

  .container-title {
    margin-bottom: 24px;
    padding: 0;
    font-size: 32px;
    line-height: 1.1;
    font-family: var(--heading-font-family);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .big-icon {
    --iron-icon-height: 48px;
    --iron-icon-width: 48px;
  }

  .gde-b {
    background-color: var(--gde);
  }

  .wtm-b {
    background-color: var(--wtm);
  }

  .gdg-b {
    background-color: var(--gdg);
  }

  .google-b {
    background-color: var(--secondary-background-color);
  }

  .google-b .badge-icon {
    --iron-icon-width: 18px;
    --iron-icon-height: 18px;

    color: #fff;
  }

  .card {
    background-color: var(--default-background-color);
    border: 1px solid var(--divider-color);
    box-shadow: var(--box-shadow);
    border-radius: var(--border-radius);
    transition: box-shadow var(--animation);
    cursor: pointer;
  }

  .tag {
    height: 32px;
    padding: 8px 12px;
    font-size: 12px;
    color: currentcolor;
    background: var(--terminal-panel-raised);
    border: 1px solid currentcolor;
    border-radius: 32px;
    margin: 1px;
    line-height: initial;
  }

  @media (width >= 640px) {
    .container,
    .container-narrow {
      padding: 32px;
    }

    .card:hover {
      box-shadow: var(--box-shadow);
    }
  }
`;
