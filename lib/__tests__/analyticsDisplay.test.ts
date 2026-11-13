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

    expect(total).toBe(33);
    expect(categories.categories.reduce(
      (sum, category) => sum + (category.amount ?? 0),
      0,
    )).toBe(total);
    expect(merchants.merchants.reduce(
      (sum, merchant) => sum + (merchant.amount ?? 0),
      0,
    )).toBe(total);
    expect(fixedVariable.buckets.reduce(
      (sum, bucket) => sum + (bucket.amount ?? 0),
      0,
    )).toBe(total);
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

    expect(displayTotal(originalRows, 'RSD', rateAt)).toBe(10_000);
    expect(displayTotal(originalRows, 'EUR', rateAt)).toBe(90);
    expect(rateAt).not.toHaveBeenCalled();
  });

  test('a missing anchor makes its group and every containing total unavailable', () => {
    const rows = [expense('known'), expense('missing', { amountEur: null })];

    expect(displayTotal(rows, 'USD', () => 1.05)).toBeNull();
    expect(
      displayCategoryBreakdown(rows, 'USD', () => 1.05).categories[0]?.amount,
    ).toBeNull();
    expect(
      displayMerchantBreakdown(rows, 'USD', () => 1.05).merchants[0]?.amount,
    ).toBeNull();
    expect(
      displayFixedVariableBreakdown(rows, 'USD', () => 1.05).buckets[1]
        ?.amount,
    ).toBeNull();
  });
});
