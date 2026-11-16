import { describe, expect, it } from '@jest/globals';
import { VisitBlock } from './visit-block';
import { mailto } from '../utils/data';

describe('accessibility contact', () => {
  it('opens a mailto for the configured organizer address with an accessibility subject', async () => {
    const element = new VisitBlock();
    document.body.appendChild(element);
    await element.updateComplete;
    const link = element.shadowRoot!.querySelector<HTMLAnchorElement>('.help')!;
    const url = new URL(link.href);
    expect(url.protocol).toBe('mailto:');
    expect(url.pathname).toBe(mailto);
    expect(mailto).toBe('hello@gdgwarsaw.pl');
    expect(url.searchParams.get('subject')).toBe('DevFest Warsaw 2026 - accessibility adjustment');
    expect(link.textContent).toContain('Need an accessibility adjustment?');
    expect(url.searchParams.has('body')).toBe(false);
    element.remove();
  });
});
