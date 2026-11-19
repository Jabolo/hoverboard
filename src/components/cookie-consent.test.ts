import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { CookieConsent } from './cookie-consent';
import { getAnalyticsConsent, setAnalyticsConsent } from '../utils/analytics';
import { isAgendaPreviewEnabled } from '../utils/agenda-preview-mode';

jest.mock('../utils/analytics', () => ({
  getAnalyticsConsent: jest.fn(),
  setAnalyticsConsent: jest.fn(),
}));
jest.mock('../utils/agenda-preview-mode', () => ({
  isAgendaPreviewEnabled: jest.fn(() => false),
}));

describe('footer cookie settings', () => {
  afterEach(() => {
    document.body.replaceChildren();
    jest.clearAllMocks();
    jest.mocked(isAgendaPreviewEnabled).mockReturnValue(false);
  });

  it('requires an initial choice and records only the selected option', async () => {
    jest.mocked(getAnalyticsConsent).mockReturnValue(null);
    const consent = new CookieConsent();
    document.body.append(consent);
    await consent.updateComplete;
    expect(consent.shadowRoot?.querySelector('[role="dialog"]')).not.toBeNull();
    expect(setAnalyticsConsent).not.toHaveBeenCalled();
    consent.shadowRoot?.querySelector<HTMLButtonElement>('button.secondary')?.click();
    await consent.updateComplete;
    expect(setAnalyticsConsent).toHaveBeenCalledWith('denied');
    expect(consent.shadowRoot?.querySelector('button.settings')).not.toBeNull();
  });

  it('opens the existing settings dialog from the footer and retains a fallback', async () => {
    jest.mocked(getAnalyticsConsent).mockReturnValue('denied');
    const consent = new CookieConsent();
    const footer = document.createElement('footer');
    const trigger = document.createElement('button');
    footer.append(trigger);
    document.body.append(consent, footer);
    await consent.updateComplete;
    expect(consent.hasAttribute('data-cookie-footer')).toBe(false);
    window.dispatchEvent(
      new CustomEvent('devfest-cookie-footer', { detail: { footer, mounted: true } }),
    );
    expect(consent.hasAttribute('data-cookie-footer')).toBe(true);
    trigger.focus();
    window.dispatchEvent(new CustomEvent('devfest-cookie-settings', { detail: { trigger } }));
    await consent.updateComplete;
    expect(consent.shadowRoot?.querySelector('[role="dialog"]')).not.toBeNull();
    expect(consent.shadowRoot?.activeElement).toBe(
      consent.shadowRoot?.querySelector('.actions button'),
    );
    consent.shadowRoot?.querySelector<HTMLButtonElement>('.actions button')?.click();
    await consent.updateComplete;
    expect(setAnalyticsConsent).toHaveBeenCalledWith('granted');
    expect(document.activeElement).toBe(trigger);
    window.dispatchEvent(
      new CustomEvent('devfest-cookie-footer', { detail: { footer, mounted: false } }),
    );
    expect(consent.hasAttribute('data-cookie-footer')).toBe(false);
  });

  it('retains the existing floating control for the special agenda preview build', async () => {
    jest.mocked(getAnalyticsConsent).mockReturnValue('denied');
    jest.mocked(isAgendaPreviewEnabled).mockReturnValue(true);
    const consent = new CookieConsent();
    const footer = document.createElement('footer');
    document.body.append(consent, footer);
    await consent.updateComplete;
    window.dispatchEvent(
      new CustomEvent('devfest-cookie-footer', { detail: { footer, mounted: true } }),
    );
    expect(consent.hasAttribute('data-cookie-footer')).toBe(false);
    expect(consent.shadowRoot?.querySelector('button.settings')).not.toBeNull();
  });

  it('returns focus to a new footer if navigation removes the original trigger', async () => {
    jest.mocked(getAnalyticsConsent).mockReturnValue('denied');
    const consent = new CookieConsent();
    const originalFooter = document.createElement('footer');
    const originalTrigger = document.createElement('button');
    originalFooter.append(originalTrigger);
    document.body.append(consent, originalFooter);
    await consent.updateComplete;
    window.dispatchEvent(
      new CustomEvent('devfest-cookie-footer', {
        detail: { footer: originalFooter, mounted: true },
      }),
    );
    window.dispatchEvent(
      new CustomEvent('devfest-cookie-settings', { detail: { trigger: originalTrigger } }),
    );
    await consent.updateComplete;
    originalFooter.remove();
    window.dispatchEvent(
      new CustomEvent('devfest-cookie-footer', {
        detail: { footer: originalFooter, mounted: false },
      }),
    );
    const replacement = document.createElement('div');
    const replacementTrigger = document.createElement('button');
    replacementTrigger.className = 'cookie-settings';
    replacement.attachShadow({ mode: 'open' }).append(replacementTrigger);
    document.body.append(replacement);
    window.dispatchEvent(
      new CustomEvent('devfest-cookie-footer', { detail: { footer: replacement, mounted: true } }),
    );
    consent.shadowRoot?.querySelector<HTMLButtonElement>('button.secondary')?.click();
    await consent.updateComplete;
    expect(replacement.shadowRoot?.activeElement).toBe(replacementTrigger);
  });

  it('does not reopen an intentionally hidden consent component', async () => {
    jest.mocked(getAnalyticsConsent).mockReturnValue('denied');
    const consent = new CookieConsent();
    consent.hidden = true;
    document.body.append(consent);
    await consent.updateComplete;
    window.dispatchEvent(new Event('devfest-cookie-settings'));
    await consent.updateComplete;
    expect(consent.shadowRoot?.querySelector('[role="dialog"]')).toBeNull();
  });

  it('uses the floating control when the original trigger becomes hidden', async () => {
    jest.mocked(getAnalyticsConsent).mockReturnValue('denied');
    const consent = new CookieConsent();
    const trigger = document.createElement('button');
    document.body.append(consent, trigger);
    await consent.updateComplete;
    window.dispatchEvent(new CustomEvent('devfest-cookie-settings', { detail: { trigger } }));
    await consent.updateComplete;
    trigger.style.display = 'none';
    consent.shadowRoot?.querySelector<HTMLButtonElement>('button.secondary')?.click();
    await consent.updateComplete;
    expect(consent.shadowRoot?.activeElement).toBe(
      consent.shadowRoot?.querySelector('button.settings'),
    );
  });
});
