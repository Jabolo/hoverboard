import { describe, expect, it, jest } from '@jest/globals';
import { PortraitMotionPreference } from './portrait-motion-preference';

describe('portrait motion without a visible control', () => {
  it('renders no button, respects preference changes and cleans up its listener', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    const preference = Object.assign(new EventTarget(), { matches: false });
    const remove = jest.spyOn(preference, 'removeEventListener');
    const changes: boolean[] = [];
    const element = new PortraitMotionPreference();
    element.addEventListener('portrait-motion-change', (event) => {
      changes.push((event as CustomEvent<{ paused: boolean }>).detail.paused);
    });
    try {
      window.matchMedia = jest.fn(() => preference as MediaQueryList);
      document.body.append(element);
      await element.updateComplete;
      expect(element.shadowRoot?.querySelector('button')).toBeNull();
      expect(changes).toEqual([false]);
      preference.matches = true;
      preference.dispatchEvent(new Event('change'));
      expect(changes).toEqual([false, true]);
      element.remove();
      expect(remove).toHaveBeenCalledWith('change', expect.any(Function));
      preference.matches = false;
      preference.dispatchEvent(new Event('change'));
      expect(changes).toEqual([false, true]);
    } finally {
      element.remove();
      if (original) Object.defineProperty(window, 'matchMedia', original);
      else Reflect.deleteProperty(window, 'matchMedia');
    }
  });
});
