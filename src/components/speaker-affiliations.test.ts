import { describe, expect, it, jest } from '@jest/globals';
import { html } from 'lit';
import { fixture } from '../../__tests__/helpers/fixtures';
import { SpeakerAffiliations } from './speaker-affiliations';
import './speaker-affiliations';

jest.mock('@polymer/iron-icon', () => ({}));
jest.mock('../utils/icons', () => ({}));

const badges = [
  {
    name: 'gde',
    description: 'Google Developer Expert',
    link: 'https://developers.google.com/community/experts',
  },
];

describe('speaker affiliations', () => {
  it('shows a company logo and GDE recognition independently together', async () => {
    const { shadowRoot } = await fixture<SpeakerAffiliations>(html`
      <speaker-affiliations
        company="Qualtrics"
        logo-url="/preview/logos/qualtrics.svg"
        .badges=${badges}
      ></speaker-affiliations>
    `);
    expect(shadowRoot.querySelector('img')).toHaveAttribute('alt', 'Qualtrics logo');
    expect(shadowRoot.querySelector('img')).toHaveAttribute('src', '/preview/logos/qualtrics.svg');
    expect(shadowRoot.querySelector('.recognition')).toHaveTextContent('Google Developer Expert');
  });

  it('shows a company without inventing a GDE badge', async () => {
    const { shadowRoot } = await fixture<SpeakerAffiliations>(html`
      <speaker-affiliations
        company="Netflix"
        logo-url="/preview/logos/netflix.svg"
        logo-background="dark"
      ></speaker-affiliations>
    `);
    expect(shadowRoot.querySelector('.company-mark')).toHaveClass('dark');
    expect(shadowRoot.querySelector('.recognition')).toBeNull();
  });

  it('omits duplicate company text when a logo is unavailable and still shows GDE', async () => {
    const { shadowRoot } = await fixture<SpeakerAffiliations>(html`
      <speaker-affiliations company="Stealth Startup" .badges=${badges}></speaker-affiliations>
    `);
    expect(shadowRoot).not.toHaveTextContent('Stealth Startup');
    expect(shadowRoot.querySelector('img')).toBeNull();
    expect(shadowRoot.querySelector('.recognition')).toHaveTextContent('Google Developer Expert');
  });

  it('renders nothing for a company without a logo or recognition', async () => {
    const { shadowRoot } = await fixture<SpeakerAffiliations>(html`
      <speaker-affiliations company="Stealth Startup"></speaker-affiliations>
    `);
    expect(shadowRoot.querySelector('[role="group"]')).toBeNull();
    expect(shadowRoot).not.toHaveTextContent('Stealth Startup');
  });

  it('supports a GDE without a company and renders nothing when both are absent', async () => {
    const { element, shadowRoot } = await fixture<SpeakerAffiliations>(html`
      <speaker-affiliations .badges=${badges}></speaker-affiliations>
    `);
    expect(shadowRoot.querySelector('img')).toBeNull();
    expect(shadowRoot.querySelector('.recognition')).toHaveTextContent('Google Developer Expert');
    element.badges = [];
    await element.updateComplete;
    expect(shadowRoot.querySelector('[role="group"]')).toBeNull();
  });
});
