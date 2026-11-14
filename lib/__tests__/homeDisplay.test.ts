import { describe, expect, jest, test } from '@jest/globals';

import {
  aggregateDisplayAmounts,
  displayAmountForExpense,
  sumExpenseDisplayAmounts,
} from '../homeDisplay';

const expense = {
  amountEurCents: 10,
  occurredOn: '2026-08-01',
  originalAmountCents: 1_200,
  originalCurrency: 'RSD',
};

describe('Home anchor display amounts', () => {
  test('an empty aggregate is zero with no unavailable rows', () => {
    expect(aggregateDisplayAmounts([], 'RSD', () => null)).toEqual({
      cents: 0,
      unavailable: 0,
    });
  });

  test('passes through original and EUR amounts without looking up a rate', () => {
    const rateAt = jest.fn<(dateISO: string) => number | null>(() => 999);

    expect(displayAmountForExpense(expense, 'RSD', rateAt)).toBe(1_200);
    expect(displayAmountForExpense(expense, 'EUR', rateAt)).toBe(10);
    expect(rateAt).not.toHaveBeenCalled();
  });

  test('converts the EUR anchor and rounds half-up at the row boundary', () => {
    const rateAt = jest.fn<(dateISO: string) => number | null>(() => 1.05);

    expect(displayAmountForExpense(expense, 'USD', rateAt)).toBe(11);
    expect(rateAt).toHaveBeenCalledTimes(1);
    expect(rateAt).toHaveBeenCalledWith('2026-08-01');
  });

  test('returns null without an anchor unless original currency passes through', () => {
    const withoutAnchor = { ...expense, amountEurCents: null };
    const rateAt = jest.fn<(dateISO: string) => number | null>(() => 117);

    expect(displayAmountForExpense(withoutAnchor, 'RSD', rateAt)).toBe(1_200);
    expect(displayAmountForExpense(withoutAnchor, 'USD', rateAt)).toBeNull();
    expect(rateAt).not.toHaveBeenCalled();
  });

  test('sums rounded rows and returns null when any row cannot be displayed', () => {
    const rows = [
      { ...expense, originalCurrency: 'EUR', originalAmountCents: 10 },
      { ...expense, originalCurrency: 'EUR', originalAmountCents: 10 },
      { ...expense, originalCurrency: 'EUR', originalAmountCents: 10 },
    ];

    expect(sumExpenseDisplayAmounts(rows, 'USD', () => 1.05)).toBe(33);
    expect(
      sumExpenseDisplayAmounts(
        [...rows, { ...expense, amountEurCents: null }],
        'USD',
        () => 1.05,
      ),
    ).toBeNull();
  });

  test('aggregates rounded displayable rows and counts unavailable rows', () => {
    const rows = [
      { ...expense, originalCurrency: 'EUR', originalAmountCents: 10 },
      { ...expense, originalCurrency: 'EUR', originalAmountCents: 10 },
      { ...expense, originalCurrency: 'EUR', originalAmountCents: 10 },
      {
        ...expense,
        amountEurCents: null,
        originalAmountCents: 5_000,
        originalCurrency: 'KZT',
      },
    ];

    expect(aggregateDisplayAmounts(rows, 'USD', () => 1.05)).toEqual({
      cents: 33,
      unavailable: 1,
    });
    expect(Math.round(30 * 1.05)).toBe(32);
  });

  test('passthrough rows stay available without rates', () => {
    const withoutAnchor = { ...expense, amountEurCents: null };
    const rateAt = jest.fn<(dateISO: string) => number | null>(() => null);

    expect(aggregateDisplayAmounts([withoutAnchor], 'RSD', rateAt)).toEqual({
      cents: 1_200,
      unavailable: 0,
    });
    expect(
      aggregateDisplayAmounts(
        [{ ...expense, originalCurrency: 'EUR', originalAmountCents: 10 }],
        'EUR',
        rateAt,
      ),
    ).toEqual({ cents: 10, unavailable: 0 });
    expect(rateAt).not.toHaveBeenCalled();
  });
});
