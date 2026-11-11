import { describe, expect, it } from '@jest/globals';

import type { AnchorRate } from '../anchorRates';

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

const { parseAnchorRows, pickRateOnOrBefore, resolveAnchorRate } =
  require('../anchorRates') as typeof import('../anchorRates');

describe('parseAnchorRows', () => {
  it.each([null, undefined, {}, 'rates'])(
    'returns an empty list for non-array input %#',
    (data) => {
      expect(parseAnchorRows(data)).toEqual([]);
    },
  );

  it('accepts numeric and string rates and normalizes quote codes', () => {
    expect(
      parseAnchorRows([
        {
          date: '2026-10-15',
          base_currency: 'EUR',
          quote_currency: ' rsd ',
          rate: '117.2041',
        },
        {
          date: '2026-10-15',
          base_currency: 'EUR',
          quote_currency: 'USD',
          rate: 1.08,
        },
      ]),
    ).toEqual([
      { date: '2026-10-15', quote: 'RSD', ratePerEur: 117.2041 },
      { date: '2026-10-15', quote: 'USD', ratePerEur: 1.08 },
    ]);
  });

  it('skips malformed rows without dropping valid neighbours', () => {
    const valid = {
      date: '2026-10-15',
      base_currency: 'EUR',
      quote_currency: 'USD',
      rate: '1.08',
    };

    expect(
      parseAnchorRows([
        null,
        42,
        { ...valid, base_currency: 'USD' },
        { ...valid, quote_currency: 'US' },
        { ...valid, rate: 0 },
        { ...valid, rate: -1 },
        { ...valid, rate: Number.POSITIVE_INFINITY },
        { ...valid, rate: 'not-a-number' },
        valid,
      ]),
    ).toEqual([
      { date: '2026-10-15', quote: 'USD', ratePerEur: 1.08 },
    ]);
  });
});

describe('resolveAnchorRate', () => {
  it('returns EUR parity without querying a stored rate', async () => {
    await expect(resolveAnchorRate(' eur ', '2026-10-15')).resolves.toEqual({
      date: '2026-10-15',
      quote: 'EUR',
      ratePerEur: 1,
    });
  });
});

describe('pickRateOnOrBefore', () => {
  const rows: AnchorRate[] = [
    { date: '2025-03-13', quote: 'USD', ratePerEur: 1.08 },
    { date: '2025-03-14', quote: 'USD', ratePerEur: 1.09 },
    { date: '2025-03-14', quote: 'GBP', ratePerEur: 0.84 },
  ];

  it('returns an exact-date rate', () => {
    expect(pickRateOnOrBefore(rows, ' usd ', '2025-03-14')).toEqual({
      date: '2025-03-14',
      quote: 'USD',
      ratePerEur: 1.09,
    });
  });

  it.each(['2025-03-15', '2025-03-16'])(
    'uses the Friday rate for weekend date %s',
    (dateISO) => {
      expect(pickRateOnOrBefore(rows, 'USD', dateISO)).toEqual({
        date: '2025-03-14',
        quote: 'USD',
        ratePerEur: 1.09,
      });
    },
  );

  it('returns null before the earliest available rate', () => {
    expect(pickRateOnOrBefore(rows, 'USD', '2025-03-12')).toBeNull();
  });

  it('chooses the newest of several eligible rows', () => {
    expect(pickRateOnOrBefore(rows, 'USD', '2025-03-20')?.date).toBe(
      '2025-03-14',
    );
  });
});
