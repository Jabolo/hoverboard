import { describe, expect, it, jest } from '@jest/globals';
import { portraitSource } from './portrait-source';

describe('portrait motion preference', () => {
  it('uses animation only when available, playing and motion is allowed', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    try {
      window.matchMedia = jest.fn(() => ({ matches: false }) as MediaQueryList);
      expect(portraitSource('poster', 'animation')).toBe('animation');
      expect(portraitSource('poster', 'animation', true)).toBe('poster');
      expect(portraitSource('poster')).toBe('poster');
      window.matchMedia = jest.fn(() => ({ matches: true }) as MediaQueryList);
      expect(portraitSource('poster', 'animation')).toBe('poster');
    } finally {
      if (original) Object.defineProperty(window, 'matchMedia', original);
      else Reflect.deleteProperty(window, 'matchMedia');
    }
  });
});
