import { describe, expect, it } from '@jest/globals';

import {
  displayCents,
  sumDisplayCents,
  type DisplayableAmount,
} from '../fxDisplay';
import { roundHalfUp } from '../money';

const amount: DisplayableAmount = {
  originalCents: 12_345,
  originalCurrency: 'USD',
  anchorCents: 11_111,
};

describe('displayCents', () => {
  it('prefers stored original and anchor amounts over a supplied rate', () => {
    expect(displayCents(amount, ' usd ', 999)).toBe(amount.originalCents);
    expect(displayCents(amount, 'eur ', 999)).toBe(amount.anchorCents);
  });

  it('rounds half-up exactly once at the final cent value', () => {
    expect(
      displayCents(
        { originalCents: 1, originalCurrency: 'USD', anchorCents: 1 },
        'GBP',
        0.5,
      ),
    ).toBe(1);
    expect(
      displayCents(
        { originalCents: 1, originalCurrency: 'USD', anchorCents: 1 },
        'GBP',
        0.49,
      ),
    ).toBe(0);
    expect(
      displayCents(
        {
          originalCents: 10_000,
          originalCurrency: 'USD',
          anchorCents: 10_000,
        },
        'RSD',
        117.2041,
      ),
    ).toBe(1_172_041);
  });

  it.each([null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'returns null when the calculated branch receives rate %s',
    (rate) => {
      expect(displayCents(amount, 'RSD', rate)).toBeNull();
    },
  );

  it.each([
    { ...amount, originalCents: -1 },
    { ...amount, originalCents: 1.5 },
    { ...amount, anchorCents: -1 },
    { ...amount, anchorCents: Number.MAX_SAFE_INTEGER + 1 },
  ])('rejects invalid cent inputs', (invalidAmount) => {
    expect(() => displayCents(invalidAmount, 'RSD', 117)).toThrow(
      'non-negative integer number of cents',
    );
  });
});

describe('sumDisplayCents', () => {
  it('sums row values and treats an empty list as zero', () => {
    expect(sumDisplayCents([100, 250, 50])).toBe(400);
    expect(sumDisplayCents([])).toBe(0);
  });

  it('returns null when any row has no display value', () => {
    expect(sumDisplayCents([100, null, 50])).toBeNull();
  });

  it('display totals equal across groupings and never convert the total', () => {
    const ratePerEur = 1.05;
    const rows: DisplayableAmount[] = [
      { originalCents: 10, originalCurrency: 'EUR', anchorCents: 10 },
      { originalCents: 10, originalCurrency: 'EUR', anchorCents: 10 },
      { originalCents: 10, originalCurrency: 'EUR', anchorCents: 10 },
    ];
    const displayedRows = rows.map((row) =>
      displayCents(row, 'USD', ratePerEur),
    );
    const wholeTotal = sumDisplayCents(displayedRows);
    const convertedTotal = roundHalfUp(
      rows.reduce((sum, row) => sum + row.anchorCents, 0) * ratePerEur,
    );

    expect(wholeTotal).toBe(33);
    expect(convertedTotal).toBe(32);
    expect(wholeTotal).not.toBe(convertedTotal);

    const groupings = [
      [[0, 1], [2]],
      [[0], [1, 2]],
    ];
    for (const grouping of groupings) {
      const groupTotals = grouping.map((indexes) =>
        sumDisplayCents(indexes.map((index) => displayedRows[index] ?? null)),
      );
      expect(sumDisplayCents(groupTotals)).toBe(wholeTotal);
    }
  });
});
