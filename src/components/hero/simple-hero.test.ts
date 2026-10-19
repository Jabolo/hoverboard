import { describe, expect, it, jest } from '@jest/globals';
import { html } from 'lit';
import { fixture } from '../../../__tests__/helpers/fixtures';
import { heroSettings } from '../../utils/data';
import { SimpleHero } from './simple-hero';
import './simple-hero';

jest.mock('../../store/ui/actions');

describe('simple-hero detail presentation', () => {
  it('preserves the configured title and description by default', async () => {
    const { shadowRoot } = await fixture<SimpleHero>(
      html`<simple-hero page="schedule"></simple-hero>`,
    );
    expect(shadowRoot.querySelector('.hero-title')).toHaveTextContent(heroSettings.schedule.title);
    expect(shadowRoot.querySelector('.hero-description')).toHaveTextContent(
      heroSettings.schedule.description,
    );
  });

  it('accepts a detail heading and hides the generic description without removing slotted content', async () => {
    const { element, shadowRoot } = await fixture<SimpleHero>(html`
      <simple-hero page="schedule" heading="Sessions" hide-description>
        <h2>Selected session</h2>
      </simple-hero>
    `);
    expect(shadowRoot.querySelector('.hero-title')).toHaveTextContent('Sessions');
    expect(shadowRoot.querySelector('.hero-description')).toBeNull();
    expect(element.querySelector('h2')).toHaveTextContent('Selected session');
  });
});
