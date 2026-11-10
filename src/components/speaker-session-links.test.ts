import { describe, expect, it } from '@jest/globals';
import { html } from 'lit';
import { fixture } from '../../__tests__/helpers/fixtures';
import type { Session } from '../models/session';
import { SpeakerSessionLinks } from './speaker-session-links';
import type { SessionFavorite } from './session-favorite';
import './speaker-session-links';

const panel: Session = {
  id: 'PANEL-01',
  title: 'Engineering together',
  description: 'Panel abstract',
};

describe('speaker session links', () => {
  it('shows an accessible session title link and participation role', async () => {
    const { shadowRoot } = await fixture<SpeakerSessionLinks>(html`
      <speaker-session-links
        .sessions=${[panel]}
        .sessionRoles=${{ 'PANEL-01': 'Moderator' }}
      ></speaker-session-links>
    `);
    expect(shadowRoot.querySelector('a')).toHaveAttribute('href', '/sessions/PANEL-01');
    expect(shadowRoot.querySelector('a')).toHaveTextContent('Engineering together');
    expect(shadowRoot.querySelector('.session-label')).toHaveTextContent(
      'Moderator · Shared panel',
    );
    expect(shadowRoot.querySelector('ul')).toHaveAttribute('aria-label', 'Speaker sessions');
    expect(shadowRoot.querySelectorAll('a a')).toHaveLength(0);
    const favorite = shadowRoot.querySelector('session-favorite');
    expect(favorite).toHaveAttribute('session-id', 'PANEL-01');
    expect(favorite).toHaveAttribute('session-title', 'Engineering together');
    expect(shadowRoot.querySelector('a session-favorite')).toBeNull();
  });

  it('creates no empty section when session data is missing', async () => {
    const { shadowRoot } = await fixture<SpeakerSessionLinks>(
      html`<speaker-session-links></speaker-session-links>`,
    );
    expect(shadowRoot.querySelector('ul')).toBeNull();
  });

  it('keeps the same panel heart in sync across two speaker cards', async () => {
    window.localStorage.clear();
    const first = document.createElement('speaker-session-links');
    const second = document.createElement('speaker-session-links');
    first.sessions = [panel];
    second.sessions = [panel];
    document.body.append(first, second);
    await Promise.all([first.updateComplete, second.updateComplete]);
    const firstHeart = first.shadowRoot!.querySelector('session-favorite') as SessionFavorite;
    const secondHeart = second.shadowRoot!.querySelector('session-favorite') as SessionFavorite;
    await Promise.all([firstHeart.updateComplete, secondHeart.updateComplete]);
    firstHeart.shadowRoot!.querySelector('button')!.click();
    await Promise.all([firstHeart.updateComplete, secondHeart.updateComplete]);
    expect(secondHeart.shadowRoot!.querySelector('button')).toHaveAttribute('aria-pressed', 'true');
    first.remove();
    second.remove();
    window.localStorage.clear();
  });
});
