import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Session } from '../models/session';
import type { SpeakerData } from '../models/speaker';
import { speakerSessionLinks } from '../utils/speaker-programme';
import './session-favorite';

@customElement('speaker-session-links')
export class SpeakerSessionLinks extends LitElement {
  @property({ type: Array }) sessions: Session[] = [];
  @property({ type: Object, attribute: 'session-roles' })
  sessionRoles: SpeakerData['sessionRoles'] = {};

  static override styles = css`
    :host {
      display: block;
    }
    .sessions {
      margin: 16px 0 0;
      padding: 16px 0 0;
      border-top: 1px solid var(--terminal-line, #263d5e);
      list-style: none;
    }
    li + li {
      margin-top: 14px;
    }
    .session-label {
      color: var(--terminal-muted, #9bb0d0);
      font-size: 12px;
      line-height: 1.5;
      text-align: center;
      grid-column: 2;
    }
    .session-header {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) 44px;
      align-items: center;
    }
    .session-header session-favorite {
      grid-column: 3;
    }
    a {
      display: block;
      color: var(--terminal-copy, #eaf2ff);
      font-size: 14px;
      font-weight: 600;
      line-height: 1.5;
      text-align: center;
      text-decoration: underline;
      text-decoration-color: var(--google-blue, #4285f4);
      text-underline-offset: 4px;
      overflow-wrap: anywhere;
    }
    a:hover {
      color: var(--terminal-green, #7ef2a5);
    }
    a:focus-visible {
      outline: 2px solid var(--google-yellow, #fbbc04);
      outline-offset: 4px;
    }
  `;

  override render() {
    const links = speakerSessionLinks(this.sessions, this.sessionRoles);
    if (!links.length) return nothing;
    return html`<ul class="sessions" aria-label="Speaker sessions">
      ${links.map(
        (session) =>
          html` <li>
            <div class="session-header">
              <div class="session-label">${session.label}</div>
              <session-favorite
                session-id=${session.id}
                session-title=${session.title}
              ></session-favorite>
            </div>
            <a href=${session.href}>${session.title}</a>
          </li>`,
      )}
    </ul>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'speaker-session-links': SpeakerSessionLinks;
  }
}
