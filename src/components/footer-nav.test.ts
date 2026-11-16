import { describe, expect, it } from '@jest/globals';
import { screen, within } from '@testing-library/dom';
import { html } from 'lit';
import { fixture } from '../../__tests__/helpers/fixtures';
import { codeOfConduct } from '../utils/data';
import { FooterNav } from './footer-nav';

describe('footer-nav', () => {
  it('defines a component', () => {
    expect(customElements.get('footer-nav')).toBeDefined();
  });

  it('renders organizer logo and links', async () => {
    const { shadowRootForWithin } = await fixture(
      html`<footer-nav data-testid="footer"></footer-nav>`,
    );
    const withinShadowRoot = within(shadowRootForWithin);
    const logo = withinShadowRoot.getByAltText('DevFest 2026');
    const hoverboardLink = withinShadowRoot.getByText('Project Hoverboard');

    expect(screen.getByTestId('footer')).toBeInTheDocument();
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', '/images/logos/devfest-2026-wordmark-dark.svg');
    expect(hoverboardLink).toBeInTheDocument();
    expect(hoverboardLink).toHaveAttribute('href', 'https://github.com/gdg-x/hoverboard');
    expect(hoverboardLink).toHaveAttribute('target', '_blank');
    expect(hoverboardLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders code of conduct link', async () => {
    const { shadowRootForWithin } = await fixture(html`<footer-nav></footer-nav>`);
    const withinShadowRoot = within(shadowRootForWithin);
    const cocLink = withinShadowRoot.getByText(codeOfConduct);

    expect(cocLink).toBeInTheDocument();
    expect(cocLink).toHaveAttribute('href', '/coc');
  });
});

describe('footer attribution', () => {
  it('preserves Hoverboard and legal links beside the author’s verified profiles', async () => {
    const element = new FooterNav();
    document.body.appendChild(element);
    await element.updateComplete;
    const root = element.shadowRoot!;
    expect(root.textContent).toContain('Made by');
    expect(root.textContent).toContain('Michał Jabłoński');
    expect(root.querySelector<HTMLAnchorElement>('.author')!.href).toBe(
      'https://michaljablonski.dev/',
    );
    const linkedin = root.querySelector<HTMLAnchorElement>('.linkedin')!;
    expect(linkedin.href).toBe('https://www.linkedin.com/in/m-jab/');
    expect(linkedin.getAttribute('aria-label')).toContain('Michał Jabłoński on LinkedIn');
    expect(root.querySelector('a[href="https://github.com/gdg-x/hoverboard"]')).not.toBeNull();
    expect(root.querySelector('a[href="/coc"]')).not.toBeNull();
    expect(root.querySelector('a[href="/privacy"]')).not.toBeNull();
    root.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]').forEach((link) => {
      expect(link.rel).toBe('noopener noreferrer');
    });
    element.remove();
  });
});
