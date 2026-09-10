import { jest } from '@jest/globals';
import '@testing-library/jest-dom/jest-globals';

jest.mock('firebase/messaging');
jest.mock('../src/firebase');

// @material/web uses window.matchMedia which is not available in JSDOM.
// https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

class MockPointerEvent {}

Object.defineProperty(window, 'PointerEvent', {
  writable: true,
  value: MockPointerEvent,
});

// JSDOM exposes ElementInternals but does not implement setFormValue yet.
// Material Web 2.5 calls it synchronously for form-associated buttons.
const attachInternals = HTMLElement.prototype.attachInternals;
HTMLElement.prototype.attachInternals = function () {
  const elementInternals = attachInternals.call(this);
  if (typeof elementInternals.setFormValue !== 'function') {
    elementInternals.setFormValue = jest.fn();
  }
  return elementInternals;
};

Object.defineProperty(Element.prototype, 'animate', {
  writable: true,
  value: jest.fn().mockReturnValue({
    cancel: jest.fn(),
    finish: jest.fn(),
    pause: jest.fn(),
    play: jest.fn(),
    reverse: jest.fn(),
    updatePlaybackRate: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }),
});
