import { describe, expect, it, jest } from '@jest/globals';
import { LinkedInUpdatesBlock, shuffleStories } from './linkedin-updates-block';

describe('LinkedInUpdatesBlock', () => {
  it('shuffles deterministically without mutating or losing stories', () => {
    const original = ['a', 'b', 'c', 'd'];
    expect(shuffleStories(original, () => 0)).toEqual(['b', 'c', 'd', 'a']);
    expect(shuffleStories(original, () => 0.999)).toEqual(original);
    expect(original).toEqual(['a', 'b', 'c', 'd']);
  });
  it('keeps the page order across re-renders and component instances', async () => {
    const first = new LinkedInUpdatesBlock();
    const second = new LinkedInUpdatesBlock();
    document.body.append(first, second);
    await Promise.all([first.updateComplete, second.updateComplete]);
    const names = (element: LinkedInUpdatesBlock) =>
      Array.from(element.shadowRoot!.querySelectorAll('h3')).map((node) => node.textContent);
    const initial = names(first);
    first.requestUpdate();
    await first.updateComplete;
    expect(names(first)).toEqual(initial);
    expect(names(second)).toEqual(initial);
    first.remove();
    second.remove();
  });
  it('links the verified Çalgan post in a static card, keeps Michał, and opens external links safely', async () => {
    const element = new LinkedInUpdatesBlock();
    document.body.appendChild(element);
    await element.updateComplete;
    const root = element.shadowRoot!;
    expect(root.querySelector('iframe')).toBeNull();
    expect(
      root
        .querySelector('img[src="/images/community/calgan-mindfulness.webp"]')
        ?.getAttribute('src'),
    ).toBe('/images/community/calgan-mindfulness.webp');
    expect(root.textContent).toContain('Çalgan Aygün');
    expect(root.textContent).toContain('Michał Tajchert');
    expect(root.textContent).toContain('Dominika Zając');
    expect(root.querySelectorAll('article')).toHaveLength(4);
    expect(root.textContent).toContain('Yonatan Levin');
    expect(
      root
        .querySelector(
          'a[href="https://www.linkedin.com/feed/update/urn:li:activity:7528145881301393408"] img',
        )
        ?.getAttribute('src'),
    ).toBe('/images/community/yonatan-courage.webp');
    expect(
      root.querySelector(
        'a[href="https://www.linkedin.com/feed/update/urn:li:activity:7527829910585880576"]',
      ),
    ).not.toBeNull();
    expect(root.textContent).not.toContain('Adrian Romański');
    expect(
      root.querySelector<HTMLAnchorElement>(
        'a[href="https://www.linkedin.com/feed/update/urn:li:activity:7527449130076626944"]',
      )?.href,
    ).toBe('https://www.linkedin.com/feed/update/urn:li:activity:7527449130076626944');
    const companyLink = root.querySelector(
      'a[href="https://www.linkedin.com/company/gdg-warszawa/"]',
    );
    expect(companyLink).not.toBeNull();
    for (const link of root.querySelectorAll('a')) {
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noopener noreferrer');
    }
    element.remove();
  });
  it('supports mobile buttons and keyboard without automatic rotation', async () => {
    const element = new LinkedInUpdatesBlock();
    document.body.appendChild(element);
    await element.updateComplete;
    const root = element.shadowRoot!;
    const track = root.querySelector<HTMLElement>('.posts')!;
    const cards = root.querySelectorAll('article');
    cards.forEach((card, index) =>
      Object.defineProperty(card, 'offsetLeft', { value: index * 300 }),
    );
    const scrollTo = jest.fn();
    track.scrollTo = scrollTo;
    const next = root.querySelector<HTMLButtonElement>('[aria-label="Next speaker story"]')!;
    const previous = root.querySelector<HTMLButtonElement>(
      '[aria-label="Previous speaker story"]',
    )!;
    expect(previous.disabled).toBe(true);
    next.click();
    await element.updateComplete;
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 300, behavior: 'smooth' });
    expect(root.querySelector('[aria-live]')?.textContent).toContain('Story 2 of 4');
    track.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await element.updateComplete;
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' });
    expect(previous.disabled).toBe(true);
    Object.defineProperty(track, 'scrollLeft', { value: 900, configurable: true });
    track.dispatchEvent(new Event('scroll'));
    await element.updateComplete;
    expect(root.querySelector('[aria-live]')?.textContent).toContain('Story 4 of 4');
    expect(next.disabled).toBe(true);
    const media = jest.spyOn(window, 'matchMedia').mockReturnValue({
      ...window.matchMedia('(prefers-reduced-motion: reduce)'),
      matches: true,
    });
    previous.click();
    await element.updateComplete;
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 600, behavior: 'auto' });
    media.mockRestore();
    for (const img of root.querySelectorAll('img')) {
      expect(img.getAttribute('loading')).toBe('lazy');
      expect(img.getAttribute('decoding')).toBe('async');
      expect(img.getAttribute('width')).toBe('800');
      expect(Number(img.getAttribute('height'))).toBeGreaterThan(990);
      expect(img.getAttribute('alt')).toBeTruthy();
    }
    element.remove();
  });
});
