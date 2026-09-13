import type { ClickEvent } from './types';

/** Calendar days in the viewer's timezone, including today up to the refresh time. */
export function dailyClicks(events: ClickEvent[], days: number, now: number) {
  const series = Array.from({ length: days }, (_, index) => {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - days + index + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { date: start, start: start.getTime(), end: end.getTime(), count: 0 };
  });
  for (const event of events) {
    const time = new Date(event.timestamp).getTime();
    if (!Number.isFinite(time) || time > now) continue;
    const day = series.find((bucket) => time >= bucket.start && time < bucket.end);
    if (day) day.count += 1;
  }
  return {
    days: series,
    total: series.reduce((sum, day) => sum + day.count, 0),
    peak: Math.max(1, ...series.map((day) => day.count)),
  };
}
