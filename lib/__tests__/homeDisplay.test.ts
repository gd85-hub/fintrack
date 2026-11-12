import { describe, expect, jest, test } from '@jest/globals';

import {
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
});
