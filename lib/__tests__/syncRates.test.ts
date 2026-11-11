import { describe, expect, it } from '@jest/globals';

import {
  clampToSettled,
  isValidDate,
  parseFrankfurterResponse,
} from '../../supabase/functions/sync-rates/source';

// Real Frankfurter v2 response for 2025-03-14, reduced to 12 currencies.
const frankfurterFixture: unknown = [
  { date: '2025-03-14', base: 'EUR', quote: 'AUD', rate: 1.7246 },
  { date: '2025-03-14', base: 'EUR', quote: 'CAD', rate: 1.5636 },
  { date: '2025-03-14', base: 'EUR', quote: 'CHF', rate: 0.9601 },
  { date: '2025-03-14', base: 'EUR', quote: 'CNY', rate: 7.8584 },
  { date: '2025-03-14', base: 'EUR', quote: 'GBP', rate: 0.83855 },
  { date: '2025-03-14', base: 'EUR', quote: 'JPY', rate: 161.14 },
  { date: '2025-03-14', base: 'EUR', quote: 'KZT', rate: 539.27 },
  { date: '2025-03-14', base: 'EUR', quote: 'RSD', rate: 117.42 },
  { date: '2025-03-14', base: 'EUR', quote: 'RUB', rate: 93.65 },
  { date: '2025-03-14', base: 'EUR', quote: 'TRY', rate: 39.785 },
  { date: '2025-03-14', base: 'EUR', quote: 'USD', rate: 1.0858 },
  { date: '2025-03-14', base: 'EUR', quote: 'ZAR', rate: 19.8071 },
];

describe('parseFrankfurterResponse', () => {
  it('parses a real Frankfurter v2 response fixture', () => {
    const quotes = parseFrankfurterResponse(
      frankfurterFixture,
      '2025-03-14',
    );
    const codes = new Set(quotes.map((quote) => quote.code));

    expect([...codes]).toEqual(
      expect.arrayContaining(['RSD', 'RUB', 'KZT', 'TRY', 'USD']),
    );
    expect(quotes).toHaveLength(12);
    expect(
      quotes.every(
        (quote) =>
          quote.code === quote.code.toUpperCase() && quote.ratePerEur > 0,
      ),
    ).toBe(true);
  });

  it.each([null, { rates: [] }, 'rates'])(
    'returns an empty list for non-array payload %#',
    (payload) => {
      expect(parseFrankfurterResponse(payload, '2025-03-14')).toEqual([]);
    },
  );

  it('skips malformed rows while preserving valid neighbours', () => {
    const valid = {
      date: '2025-03-14',
      base: 'eur',
      quote: ' usd ',
      rate: 1.0858,
    };
    const quotes = parseFrankfurterResponse(
      [
        null,
        42,
        { date: '2025-03-14', base: 'EUR', quote: 'RSD' },
        { date: '2025-03-14', base: 'EUR', quote: 'RSD', rate: 0 },
        { date: '2025-03-14', base: 'EUR', quote: 'RSD', rate: -1 },
        { date: '2025-03-14', base: 'EUR', quote: 'RSD', rate: '117' },
        { date: '2025-03-14', base: 'USD', quote: 'RSD', rate: 117 },
        { date: '2025-02-30', base: 'EUR', quote: 'RSD', rate: 117 },
        { date: '2025-03-14', base: 'EUR', quote: 'RS', rate: 117 },
        valid,
      ],
      '2025-03-14',
    );

    expect(quotes).toEqual([
      { date: '2025-03-14', code: 'USD', ratePerEur: 1.0858 },
    ]);
  });

  it('skips the EUR anchor quote', () => {
    expect(
      parseFrankfurterResponse(
        [{ date: '2025-03-14', base: 'EUR', quote: 'EUR', rate: 1 }],
        '2025-03-14',
      ),
    ).toEqual([]);
  });

  it('rejects future quote dates and keeps earlier publication dates', () => {
    expect(
      parseFrankfurterResponse(
        [
          { date: '2025-03-15', base: 'EUR', quote: 'USD', rate: 1.1 },
          { date: '2025-03-13', base: 'EUR', quote: 'GBP', rate: 0.84 },
        ],
        '2025-03-14',
      ),
    ).toEqual([
      { date: '2025-03-13', code: 'GBP', ratePerEur: 0.84 },
    ]);
  });

  it('keeps the first duplicate for a date and currency', () => {
    expect(
      parseFrankfurterResponse(
        [
          { date: '2025-03-14', base: 'EUR', quote: 'USD', rate: 1.1 },
          { date: '2025-03-14', base: 'EUR', quote: 'usd', rate: 1.2 },
        ],
        '2025-03-14',
      ),
    ).toEqual([
      { date: '2025-03-14', code: 'USD', ratePerEur: 1.1 },
    ]);
  });
});

describe('clampToSettled', () => {
  it.each([
    ['2026-10-14', '2026-10-15', '2026-10-14'],
    ['2026-10-15', '2026-10-15', '2026-10-14'],
    ['2026-10-20', '2026-10-15', '2026-10-14'],
    ['2026-03-01', '2026-03-01', '2026-02-28'],
    ['2026-01-01', '2026-01-01', '2025-12-31'],
  ])('clamps %s against %s to %s', (date, today, expected) => {
    expect(clampToSettled(date, today)).toBe(expected);
  });
});

describe('isValidDate', () => {
  it.each(['2026-02-30', '2026-13-01', 'not-a-date', '2026-aa-01'])(
    'rejects %s',
    (date) => {
      expect(isValidDate(date)).toBe(false);
    },
  );

  it('accepts a real calendar date', () => {
    expect(isValidDate('2028-02-29')).toBe(true);
  });
});
