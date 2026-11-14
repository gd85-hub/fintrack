import { describe, expect, jest, test } from '@jest/globals';

import {
  displayCategoryBreakdown,
  displayFixedVariableBreakdown,
  displayMerchantBreakdown,
  displayTotal,
} from '../analyticsDisplay';
import type { AnalyticsExpense } from '../db';
import { roundHalfUp } from '../money';

function expense(
  id: string,
  overrides: Partial<AnalyticsExpense> = {},
): AnalyticsExpense {
  return {
    amountEur: 10,
    amountRsd: 1_200,
    amountUsd: 11,
    categoryEmoji: '🛒',
    categoryGroup: 'Еда',
    categoryId: 'food',
    categoryName: 'Продукты',
    categoryType: 'variable',
    createdAt: '2026-08-01T12:00:00Z',
    description: id,
    id,
    merchantId: 'market',
    merchantName: 'Market',
    occurredOn: '2026-08-01',
    originalAmountCents: 10,
    originalCurrency: 'EUR',
    ...overrides,
  };
}

describe('analytics anchor display aggregation', () => {
  test('category totals sum rounded rows instead of converting an anchor total', () => {
    const rows = [expense('a'), expense('b'), expense('c')];
    const result = displayCategoryBreakdown(rows, 'USD', () => 1.05);

    expect(result.categories[0]?.amount).toBe(33);
    expect(result.total).toBe(33);
    expect(result.unavailable).toBe(0);
    expect(roundHalfUp(30 * 1.05)).toBe(32);
  });

  test('category, merchant and fixed-variable group totals equal the display total', () => {
    const rows = [
      expense('fixed', {
        categoryId: 'rent',
        categoryName: 'Аренда',
        categoryType: 'fixed',
        merchantId: null,
        merchantName: null,
      }),
      expense('food-a'),
      expense('food-b', { merchantId: 'cafe', merchantName: 'Cafe' }),
    ];
    const total = displayTotal(rows, 'USD', () => 1.05);
    const categories = displayCategoryBreakdown(rows, 'USD', () => 1.05);
    const merchants = displayMerchantBreakdown(rows, 'USD', () => 1.05);
    const fixedVariable = displayFixedVariableBreakdown(
      rows,
      'USD',
      () => 1.05,
    );

    expect(total).toEqual({ cents: 33, unavailable: 0 });
    expect(categories.categories.reduce(
      (sum, category) => sum + (category.amount ?? 0),
      0,
    )).toBe(total.cents);
    expect(merchants.merchants.reduce(
      (sum, merchant) => sum + (merchant.amount ?? 0),
      0,
    )).toBe(total.cents);
    expect(fixedVariable.buckets.reduce(
      (sum, bucket) => sum + (bucket.amount ?? 0),
      0,
    )).toBe(total.cents);
  });

  test('original and EUR passthrough do not resolve a rate', () => {
    const rateAt = jest.fn<(dateISO: string) => number | null>(() => 999);
    const originalRows = [
      expense('rsd', {
        amountEur: 90,
        originalAmountCents: 10_000,
        originalCurrency: 'RSD',
      }),
    ];

    expect(displayTotal(originalRows, 'RSD', rateAt)).toEqual({
      cents: 10_000,
      unavailable: 0,
    });
    expect(displayTotal(originalRows, 'EUR', rateAt)).toEqual({
      cents: 90,
      unavailable: 0,
    });
    expect(rateAt).not.toHaveBeenCalled();
  });

  test('a dirty mixed set keeps usable totals and one shared unavailable count', () => {
    const rows = [
      expense('rsd', {
        amountEur: 10,
        categoryId: 'transport',
        categoryType: 'fixed',
        merchantId: 'station',
        occurredOn: '2026-08-01',
        originalAmountCents: 1_200,
        originalCurrency: 'RSD',
      }),
      expense('eur', {
        amountEur: 10,
        occurredOn: '2026-08-02',
      }),
      expense('missing', {
        amountEur: null,
        categoryId: 'other',
        merchantId: 'kiosk',
        occurredOn: '2026-08-03',
        originalAmountCents: 5_000,
        originalCurrency: 'KZT',
      }),
    ];
    const total = displayTotal(rows, 'RSD', () => 120);
    const categories = displayCategoryBreakdown(rows, 'RSD', () => 120);
    const merchants = displayMerchantBreakdown(rows, 'RSD', () => 120);
    const fixedVariable = displayFixedVariableBreakdown(
      rows,
      'RSD',
      () => 120,
    );

    expect(total).toEqual({ cents: 2_400, unavailable: 1 });
    expect(categories.unavailable).toBe(1);
    expect(merchants.unavailable).toBe(1);
    expect(fixedVariable.unavailable).toBe(1);
    expect(
      categories.categories.reduce((sum, row) => sum + row.amount, 0),
    ).toBe(total.cents);
    expect(
      merchants.merchants.reduce((sum, row) => sum + row.amount, 0),
    ).toBe(total.cents);
    expect(
      fixedVariable.buckets.reduce((sum, row) => sum + row.amount, 0),
    ).toBe(total.cents);
  });
});
