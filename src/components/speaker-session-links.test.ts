import { describe, expect, it } from '@jest/globals';
import { html } from 'lit';
import { fixture } from '../../__tests__/helpers/fixtures';
import type { Session } from '../models/session';
import { SpeakerSessionLinks } from './speaker-session-links';
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
  });

  it('creates no empty section when session data is missing', async () => {
    const { shadowRoot } = await fixture<SpeakerSessionLinks>(
      html`<speaker-session-links></speaker-session-links>`,
    );
    expect(shadowRoot.querySelector('ul')).toBeNull();
  });
});
