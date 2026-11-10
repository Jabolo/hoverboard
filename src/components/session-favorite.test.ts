import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { html } from 'lit';
import { fixture } from '../../__tests__/helpers/fixtures';
import type { SessionFavorite } from './session-favorite';
import './session-favorite';

describe('session favorite button', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
  });

  it('updates both hearts for the same session without navigating or signing in', async () => {
    const first = document.createElement('session-favorite');
    const second = document.createElement('session-favorite');
    for (const heart of [first, second]) {
      heart.sessionId = 'PANEL-01';
      heart.sessionTitle = 'The panel';
      document.body.append(heart);
      await heart.updateComplete;
    }
    const button = first.shadowRoot!.querySelector('button') as HTMLButtonElement;
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAccessibleName('Save The panel to my sessions');
    button.click();
    await first.updateComplete;
    await second.updateComplete;
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAccessibleName('Remove The panel from saved sessions');
    expect(second.shadowRoot!.querySelector('button')).toHaveAttribute('aria-pressed', 'true');
    first.remove();
    second.remove();
  });

  it('clearly reports when the browser will not persist a change', async () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    const { element, shadowRoot } = await fixture<SessionFavorite>(html`
      <session-favorite session-id="blocked-ui" session-title="The talk"></session-favorite>
    `);
    (shadowRoot.querySelector('button') as HTMLButtonElement).click();
    await element.updateComplete;
    expect(shadowRoot.querySelector('[role="status"]')).toHaveTextContent('this visit only');
  });
});
