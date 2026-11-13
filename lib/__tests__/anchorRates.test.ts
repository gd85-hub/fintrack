import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { AnchorRate } from '../anchorRates';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

const {
  AnchorRateUnavailableError,
  anchorRateForExpense,
  ensureAnchorRatesForRange,
  parseAnchorRows,
  pickRateOnOrBefore,
  resolveAnchorRate,
} = require('../anchorRates') as typeof import('../anchorRates');
const fromMock = supabase.from as unknown as jest.Mock;
const invokeMock = supabase.functions.invoke as unknown as jest.Mock;

function rangeQuery(data: unknown[]) {
  const order = jest.fn(async () => ({ data, error: null }));
  const gte = jest.fn(() => ({ order }));
  const lte = jest.fn(() => ({ gte }));
  const quoteEq = jest.fn(() => ({ lte }));
  const baseEq = jest.fn(() => ({ eq: quoteEq }));
  const select = jest.fn(() => ({ eq: baseEq }));
  return {
    client: { select } as unknown as ReturnType<typeof supabase.from>,
  };
}

function rateQuery(data: unknown[]) {
  const limit = jest.fn(async () => ({ data, error: null }));
  const order = jest.fn(() => ({ limit }));
  const lte = jest.fn(() => ({ order }));
  const quoteEq = jest.fn(() => ({ lte, order }));
  const baseEq = jest.fn(() => ({ eq: quoteEq }));
  const select = jest.fn(() => ({ eq: baseEq }));
  return {
    client: { select } as unknown as ReturnType<typeof supabase.from>,
  };
}

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
  beforeEach(() => {
    fromMock.mockReset();
    invokeMock.mockReset();
  });

  it('returns EUR parity without querying a stored rate', async () => {
    await expect(resolveAnchorRate(' eur ', '2026-10-15')).resolves.toEqual({
      date: '2026-10-15',
      quote: 'EUR',
      ratePerEur: 1,
    });
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe('anchorRateForExpense', () => {
  beforeEach(() => {
    fromMock.mockReset();
    invokeMock.mockReset();
    invokeMock.mockImplementation(async () => ({ data: null, error: null }));
  });

  it('returns EUR parity without queries or synchronization', async () => {
    await expect(
      anchorRateForExpense(' eur ', '2026-10-15'),
    ).resolves.toEqual({
      date: '2026-10-15',
      quote: 'EUR',
      ratePerEur: 1,
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('synchronizes after a miss and resolves the refreshed rate', async () => {
    const emptyEarlier = rateQuery([]);
    const emptyEarliest = rateQuery([]);
    const refreshed = rateQuery([
      { date: '2026-10-14', quote_currency: 'USD', rate: '1.08' },
    ]);
    fromMock
      .mockReturnValueOnce(emptyEarlier.client)
      .mockReturnValueOnce(emptyEarliest.client)
      .mockReturnValueOnce(refreshed.client);

    await expect(
      anchorRateForExpense('USD', '2026-10-15'),
    ).resolves.toEqual({
      date: '2026-10-14',
      quote: 'USD',
      ratePerEur: 1.08,
    });
    expect(invokeMock).toHaveBeenCalledWith('sync-rates', {
      body: { dates: ['2026-10-15'] },
    });
  });

  it('throws after synchronization when the rate is still unavailable', async () => {
    fromMock
      .mockReturnValueOnce(rateQuery([]).client)
      .mockReturnValueOnce(rateQuery([]).client)
      .mockReturnValueOnce(rateQuery([]).client)
      .mockReturnValueOnce(rateQuery([]).client);

    await expect(
      anchorRateForExpense('USD', '2026-10-15'),
    ).rejects.toBeInstanceOf(AnchorRateUnavailableError);
    expect(invokeMock).toHaveBeenCalledTimes(1);
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

describe('ensureAnchorRatesForRange', () => {
  beforeEach(() => {
    fromMock.mockReset();
    invokeMock.mockReset();
    invokeMock.mockImplementation(async () => ({ data: null, error: null }));
  });

  it('returns stored rows without syncing when every date is covered', async () => {
    fromMock.mockReturnValueOnce(
      rangeQuery([
        { date: '2026-10-14', quote_currency: 'RUB', rate: '92.5' },
      ]).client,
    );

    await expect(
      ensureAnchorRatesForRange(' rub ', ['2026-10-15', '2026-10-16']),
    ).resolves.toEqual([
      { date: '2026-10-14', quote: 'RUB', ratePerEur: 92.5 },
    ]);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('syncs all missing dates once and returns the refreshed rows', async () => {
    fromMock
      .mockReturnValueOnce(rangeQuery([]).client)
      .mockReturnValueOnce(rateQuery([]).client)
      .mockReturnValueOnce(
        rangeQuery([
          { date: '2026-10-15', quote_currency: 'RUB', rate: '92.5' },
          { date: '2026-10-16', quote_currency: 'RUB', rate: '93' },
        ]).client,
      );

    await expect(
      ensureAnchorRatesForRange('RUB', [
        '2026-10-15',
        '2026-10-16',
        '2026-10-15',
      ]),
    ).resolves.toEqual([
      { date: '2026-10-15', quote: 'RUB', ratePerEur: 92.5 },
      { date: '2026-10-16', quote: 'RUB', ratePerEur: 93 },
    ]);
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith('sync-rates', {
      body: { dates: ['2026-10-15', '2026-10-16'] },
    });
  });

  it('returns early for EUR', async () => {
    await expect(
      ensureAnchorRatesForRange('EUR', ['2026-10-15']),
    ).resolves.toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('returns early for an empty date list', async () => {
    await expect(ensureAnchorRatesForRange('RUB', [])).resolves.toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('checks coverage for the requested quote instead of any EUR-base row', async () => {
    fromMock
      .mockReturnValueOnce(
        rangeQuery([
          { date: '2026-10-14', quote_currency: 'RSD', rate: '117.2' },
        ]).client,
      )
      .mockReturnValueOnce(rateQuery([]).client)
      .mockReturnValueOnce(
        rangeQuery([
          { date: '2026-10-14', quote_currency: 'RUB', rate: '92.5' },
        ]).client,
      );

    await ensureAnchorRatesForRange('RUB', ['2026-10-15']);

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith('sync-rates', {
      body: { dates: ['2026-10-15'] },
    });
  });
});
