import { describe, expect, it } from '@jest/globals';
import { ScheduleBlock } from './schedule-block';
import agenda from '../../public/data/agenda-2026.json';

describe('landing schedule highlights', () => {
  it('shows only three source-backed highlights and a link to the full schedule', async () => {
    const element = new ScheduleBlock();
    document.body.appendChild(element);
    await element.updateComplete;
    const root = element.shadowRoot!;
    expect(root.querySelectorAll('li')).toHaveLength(3);
    expect(Array.from(root.querySelectorAll('time')).map((time) => time.textContent)).toEqual([
      agenda.items.find(({ id }) => id === 'registration')?.start,
      '10:15',
      agenda.items.find(({ id }) => id === 'networking')?.start,
    ]);
    expect(root.querySelector('a')?.getAttribute('href')).toBe('/schedule/');
    expect(root.textContent).not.toContain('Vibe Zone');
    expect(root.querySelector('ul')?.getAttribute('aria-label')).toContain('Warsaw time');
    element.remove();
  });
});
