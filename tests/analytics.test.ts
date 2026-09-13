import { describe, expect, it } from 'vitest';
import { dailyClicks } from '../lib/analytics';
import type { ClickEvent } from '../lib/types';

const event = (date: Date | string): ClickEvent => ({
  id: 'test',
  linkId: 'link',
  timestamp: typeof date === 'string' ? date : date.toISOString(),
});

describe('calendar-day analytics', () => {
  const now = new Date(2026, 8, 13, 15, 30).getTime();
  it('counts exactly the days visible on the chart, including the first midnight', () => {
    const result = dailyClicks(
      [
        event(new Date(2026, 8, 6, 23, 59)),
        event(new Date(2026, 8, 7, 0, 0)),
        event(new Date(2026, 8, 13, 12)),
        event(new Date(2026, 8, 13, 13)),
      ],
      7,
      now,
    );
    expect(result.total).toBe(3);
    expect(result.days.map((day) => day.count)).toEqual([1, 0, 0, 0, 0, 0, 2]);
    expect(result.peak).toBe(2);
  });
  it('ignores invalid timestamps and future events', () => {
    const result = dailyClicks(
      [event('invalid'), event(new Date(now + 1)), event(new Date(now))],
      7,
      now,
    );
    expect(result.total).toBe(1);
    expect(result.days[6].count).toBe(1);
  });
  it('handles month boundaries and empty histories', () => {
    const result = dailyClicks([], 30, new Date(2026, 0, 5, 12).getTime());
    expect(result.days).toHaveLength(30);
    expect(result.days[0].date.getMonth()).toBe(11);
    expect(result.days[0].date.getDate()).toBe(7);
    expect(result.total).toBe(0);
    expect(result.peak).toBe(1);
    for (let index = 1; index < result.days.length; index++) {
      expect(result.days[index].start).toBe(result.days[index - 1].end);
    }
  });
});
