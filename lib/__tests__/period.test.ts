import { describe, expect, it } from '@jest/globals';

import type { Translate } from '../i18n';
import { periodLabel, resolvePeriod } from '../period';

const today = '2026-10-15';
const januaryToday = '2026-01-15';
const leapMarchToday = '2028-03-10';
const nonLeapMarchToday = '2026-03-10';
const t: Translate = (key) =>
  key === 'period.last3Months' ? 'Last 3 months' : key;

describe('resolvePeriod', () => {
  it('resolves this month to inclusive month bounds', () => {
    expect(resolvePeriod({ kind: 'thisMonth' }, today)).toEqual({
      fromISO: '2026-10-01',
      toISO: '2026-10-31',
    });
  });

  it('resolves last month across inclusive month bounds', () => {
    expect(resolvePeriod({ kind: 'lastMonth' }, today)).toEqual({
      fromISO: '2026-09-01',
      toISO: '2026-09-30',
    });
  });

  it('resolves the last three calendar months', () => {
    expect(resolvePeriod({ kind: 'last3Months' }, today)).toEqual({
      fromISO: '2026-08-01',
      toISO: '2026-10-31',
    });
  });

  it('resolves this calendar year', () => {
    expect(resolvePeriod({ kind: 'thisYear' }, today)).toEqual({
      fromISO: '2026-01-01',
      toISO: '2026-12-31',
    });
  });

  it('resolves January periods across the year boundary', () => {
    expect(resolvePeriod({ kind: 'lastMonth' }, januaryToday)).toEqual({
      fromISO: '2025-12-01',
      toISO: '2025-12-31',
    });
    expect(resolvePeriod({ kind: 'last3Months' }, januaryToday)).toEqual({
      fromISO: '2025-11-01',
      toISO: '2026-01-31',
    });
    expect(resolvePeriod({ kind: 'thisYear' }, januaryToday)).toEqual({
      fromISO: '2026-01-01',
      toISO: '2026-12-31',
    });
    expect(resolvePeriod({ kind: 'thisMonth' }, januaryToday)).toEqual({
      fromISO: '2026-01-01',
      toISO: '2026-01-31',
    });
  });

  it('resolves leap February through last month', () => {
    expect(resolvePeriod({ kind: 'lastMonth' }, leapMarchToday)).toEqual({
      fromISO: '2028-02-01',
      toISO: '2028-02-29',
    });
  });

  it('resolves non-leap February through last month', () => {
    expect(resolvePeriod({ kind: 'lastMonth' }, nonLeapMarchToday)).toEqual({
      fromISO: '2026-02-01',
      toISO: '2026-02-28',
    });
  });

  it('passes a custom range through unchanged', () => {
    expect(
      resolvePeriod(
        {
          kind: 'custom',
          fromISO: '2026-02-03',
          toISO: '2026-04-05',
        },
        today,
      ),
    ).toEqual({ fromISO: '2026-02-03', toISO: '2026-04-05' });
  });
});

describe('periodLabel', () => {
  it('formats translated and custom labels', () => {
    expect(periodLabel({ kind: 'last3Months' }, 'en', t)).toBe(
      'Last 3 months',
    );
    expect(
      periodLabel(
        {
          kind: 'custom',
          fromISO: '2026-08-01',
          toISO: '2026-10-31',
        },
        'en',
        t,
      ),
    ).toBe('August 1 – October 31');
  });
});
