import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  formatDayHeader,
  formatLongDate,
  formatMonthTitle,
  monthBounds,
  shiftMonth,
  todayLocalISO,
} from '../dates';

describe('local date utilities', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('builds today from local calendar parts', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 29, 23, 30));
    expect(todayLocalISO()).toBe('2026-07-29');
  });

  it('returns month boundaries including leap years', () => {
    expect(monthBounds('2026-07')).toEqual({
      first: '2026-07-01',
      last: '2026-07-31',
    });
    expect(monthBounds('2024-02')).toEqual({
      first: '2024-02-01',
      last: '2024-02-29',
    });
  });

  it('formats Russian day and month titles', () => {
    expect(formatDayHeader('2026-07-29')).toBe('29 июля, среда');
    expect(formatLongDate('2026-07-30')).toBe('30 июля 2026');
    expect(formatMonthTitle('2026-07')).toBe('Июль 2026');
  });

  it('moves across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
  });
});
