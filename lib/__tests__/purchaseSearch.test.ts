import { describe, expect, test } from '@jest/globals';

import type { Expense } from '../db';
import { aggregateDisplayAmounts } from '../homeDisplay';
import {
  assemblePurchaseSearchResults,
  buildPurchaseSearchIndex,
  searchPurchaseIndex,
} from '../purchaseSearch';

function expense(
  id: string,
  overrides: Partial<Expense> = {},
): Expense {
  return {
    id,
    receiptId: null,
    occurredOn: '2026-11-02',
    description: id,
    rawName: null,
    categoryId: 'category-1',
    categoryEmoji: '🛒',
    categoryName: 'Groceries',
    categorySlug: 'groceries',
    merchantId: null,
    merchantName: null,
    merchantLabel: null,
    originalAmountCents: 100,
    originalCurrency: 'EUR',
    amountRsdCents: 11_700,
    amountUsdCents: 108,
    amountEurCents: 100,
    fxRateDate: '2026-11-02',
    note: '',
    createdAt: `2026-11-02T12:00:${id.length.toString().padStart(2, '0')}+01:00`,
    ...overrides,
  };
}

function resultKeys(
  result: ReturnType<typeof searchPurchaseIndex<Expense>>,
): string[] {
  return result.days.flatMap((day) =>
    day.results.map(({ purchase }) => purchase.key),
  );
}

describe('purchase-level expense search results', () => {
  test('handles an empty dataset and empty query', () => {
    const index = buildPurchaseSearchIndex([]);
    expect(searchPurchaseIndex(index, '')).toEqual({
      days: [],
      matchingExpenseCount: 0,
      purchaseCount: 0,
    });
  });

  test('empty and whitespace queries return every complete purchase', () => {
    const receiptItems = [
      expense('milk', { receiptId: 'receipt-a' }),
      expense('bread', { receiptId: 'receipt-a' }),
    ];
    const manual = expense('rent', { occurredOn: '2026-11-01' });
    const index = buildPurchaseSearchIndex([...receiptItems, manual]);

    for (const query of ['', '  \n\t ']) {
      const result = searchPurchaseIndex(index, query);
      expect(resultKeys(result)).toEqual([
        'receipt:receipt-a',
        'expense:rent',
      ]);
      expect(result.purchaseCount).toBe(2);
      expect(result.matchingExpenseCount).toBe(3);
    }
  });

  test('returns no result for no match or punctuation-only input', () => {
    const index = buildPurchaseSearchIndex([
      expense('milk', { receiptId: 'receipt-a' }),
    ]);
    expect(searchPurchaseIndex(index, 'coffee')).toEqual({
      days: [],
      matchingExpenseCount: 0,
      purchaseCount: 0,
    });
    expect(searchPurchaseIndex(index, '!!! — ...')).toEqual({
      days: [],
      matchingExpenseCount: 0,
      purchaseCount: 0,
    });
  });

  test('one matching item returns its complete purchase', () => {
    const rows = [
      expense('milk', {
        description: 'Milk',
        receiptId: 'receipt-a',
      }),
      expense('bread', {
        description: 'Bread',
        receiptId: 'receipt-a',
      }),
      expense('cheese', {
        description: 'Cheese',
        receiptId: 'receipt-a',
      }),
    ];
    const result = searchPurchaseIndex(buildPurchaseSearchIndex(rows), 'milk');
    const first = result.days[0]?.results[0];

    expect(first?.purchase.key).toBe('receipt:receipt-a');
    expect(first?.purchase.receiptId).toBe('receipt-a');
    expect(first?.purchase.expenses.map(({ id }) => id)).toEqual([
      'milk',
      'bread',
      'cheese',
    ]);
    expect(first?.matchingExpenses.map(({ id }) => id)).toEqual(['milk']);
  });

  test('multiple matching items still return one purchase and exact counts', () => {
    const rows = [
      expense('milk', {
        description: 'Milk',
        receiptId: 'receipt-a',
      }),
      expense('oat-milk', {
        description: 'Oat milk',
        receiptId: 'receipt-a',
      }),
      expense('bread', {
        description: 'Bread',
        receiptId: 'receipt-a',
      }),
    ];
    const result = searchPurchaseIndex(buildPurchaseSearchIndex(rows), 'milk');

    expect(result.purchaseCount).toBe(1);
    expect(result.matchingExpenseCount).toBe(2);
    expect(result.days[0]?.results[0]?.matchingExpenses.map(({ id }) => id)).toEqual([
      'milk',
      'oat-milk',
    ]);
  });

  test('merchant query returns all matching purchases without merging them', () => {
    const rows = [
      expense('receipt-item', {
        merchantName: 'Lidl',
        receiptId: 'receipt-a',
      }),
      expense('manual', { merchantName: 'Lidl' }),
      expense('other', { merchantName: 'Maxi' }),
    ];
    const result = searchPurchaseIndex(buildPurchaseSearchIndex(rows), 'lidl');

    expect(resultKeys(result)).toEqual([
      'receipt:receipt-a',
      'expense:manual',
    ]);
    expect(result.purchaseCount).toBe(2);
    expect(result.matchingExpenseCount).toBe(2);
  });

  test('keeps independent manual expenses as separate purchase units', () => {
    const rows = [
      expense('manual-a', { description: 'Taxi airport' }),
      expense('manual-b', { description: 'Taxi home' }),
    ];
    expect(
      resultKeys(searchPurchaseIndex(buildPurchaseSearchIndex(rows), 'taxi')),
    ).toEqual(['expense:manual-a', 'expense:manual-b']);
  });

  test('does not combine AND tokens across receipt positions', () => {
    const rows = [
      expense('lidl', {
        merchantName: 'Lidl',
        receiptId: 'receipt-a',
      }),
      expense('milk', {
        description: 'Milk',
        receiptId: 'receipt-a',
      }),
    ];
    expect(
      searchPurchaseIndex(buildPurchaseSearchIndex(rows), 'lidl milk'),
    ).toEqual({ days: [], matchingExpenseCount: 0, purchaseCount: 0 });
  });

  test('preserves original purchase identity, expense references and ordering', () => {
    const first = expense('first', {
      description: 'Target',
      receiptId: 'receipt-a',
    });
    const second = expense('second', { receiptId: 'receipt-a' });
    const index = buildPurchaseSearchIndex([first, second]);
    const sourcePurchase = index.purchaseDays[0]?.purchases[0];
    const result = searchPurchaseIndex(index, 'target');
    const found = result.days[0]?.results[0];

    expect(found?.purchase).toBe(sourcePurchase);
    expect(found?.purchase.expenses[0]).toBe(first);
    expect(found?.purchase.expenses[1]).toBe(second);
    expect(found?.matchingExpenses[0]).toBe(first);
  });

  test('keeps stable day, purchase and matching-item order and omits empty days', () => {
    const rows = [
      expense('day-two-a', {
        description: 'Target A',
        receiptId: 'receipt-a',
      }),
      expense('day-two-b', {
        description: 'Target B',
        receiptId: 'receipt-a',
      }),
      expense('day-two-manual', { description: 'Target C' }),
      expense('empty-day', {
        occurredOn: '2026-11-01',
        description: 'No match',
      }),
      expense('last-day', {
        occurredOn: '2026-10-31',
        description: 'Target D',
      }),
    ];
    const result = searchPurchaseIndex(buildPurchaseSearchIndex(rows), 'target');

    expect(result.days.map(({ date }) => date)).toEqual([
      '2026-11-02',
      '2026-10-31',
    ]);
    expect(resultKeys(result)).toEqual([
      'receipt:receipt-a',
      'expense:day-two-manual',
      'expense:last-day',
    ]);
    expect(
      result.days[0]?.results[0]?.matchingExpenses.map(({ id }) => id),
    ).toEqual(['day-two-a', 'day-two-b']);
  });

  test('matches visually identical items independently before display collapsing', () => {
    const rows = [
      expense('first', {
        description: 'Milk',
        rawName: 'MLEKO',
        receiptId: 'receipt-a',
      }),
      expense('second', {
        description: 'Milk',
        rawName: 'NAPITAK',
        receiptId: 'receipt-a',
      }),
    ];
    const result = searchPurchaseIndex(buildPurchaseSearchIndex(rows), 'mleko');

    expect(result.days[0]?.results[0]?.purchase.expenses).toHaveLength(2);
    expect(result.days[0]?.results[0]?.matchingExpenses.map(({ id }) => id)).toEqual([
      'first',
    ]);
  });

  test('keeps full purchase totals rather than a matching subtotal', () => {
    const amounts = [150, 200, 250, 500, 400];
    const names = ['Milk', 'Bread', 'Oat milk', 'Cheese', 'Apples'];
    const rows = names.map((description, index) =>
      expense(`item-${index}`, {
        amountEurCents: amounts[index],
        description,
        originalAmountCents: amounts[index] ?? 0,
        receiptId: 'receipt-a',
      }),
    );
    const found = searchPurchaseIndex(
      buildPurchaseSearchIndex(rows),
      'milk',
    ).days[0]?.results[0];

    expect(found?.matchingExpenses).toHaveLength(2);
    expect(
      aggregateDisplayAmounts(found?.purchase.expenses ?? [], 'EUR', () => null),
    ).toEqual({ cents: 1_500, unavailable: 0 });
    expect(
      aggregateDisplayAmounts(found?.matchingExpenses ?? [], 'EUR', () => null),
    ).toEqual({ cents: 400, unavailable: 0 });
  });

  test('preserves missing FX anchors and custom-currency originals', () => {
    const custom = expense('custom', {
      amountEurCents: null,
      description: 'Custom purchase',
      fxRateDate: null,
      originalAmountCents: 12_345,
      originalCurrency: 'CHF',
    });
    const found = searchPurchaseIndex(
      buildPurchaseSearchIndex([custom]),
      'custom',
    ).days[0]?.results[0];

    expect(found?.purchase.expenses[0]).toBe(custom);
    expect(found?.purchase.expenses[0]?.amountEurCents).toBeNull();
    expect(found?.purchase.expenses[0]?.originalCurrency).toBe('CHF');
    expect(
      aggregateDisplayAmounts(found?.purchase.expenses ?? [], 'CHF', () => null),
    ).toEqual({ cents: 12_345, unavailable: 0 });
    expect(
      aggregateDisplayAmounts(found?.purchase.expenses ?? [], 'USD', () => null),
    ).toEqual({ cents: 0, unavailable: 1 });
  });

  test('forwards trusted additional labels to the expense search index', () => {
    const row = expense('localized', { categoryName: 'Продукты' });
    const index = buildPurchaseSearchIndex([row], {
      trustedLabelsForExpense: () => ['Groceries'],
    });
    expect(resultKeys(searchPurchaseIndex(index, 'grocer'))).toEqual([
      'expense:localized',
    ]);
  });

  test('assembly accepts matching IDs from an independent future provider', () => {
    const row = expense('semantic-match', { description: 'Moja Kravica' });
    const index = buildPurchaseSearchIndex([row]);
    const result = assemblePurchaseSearchResults(index.purchaseDays, [
      { id: 'semantic-match' },
    ]);

    expect(result.days[0]?.results[0]?.purchase.expenses[0]).toBe(row);
    expect(result.days[0]?.results[0]?.matchingExpenses[0]).toBe(row);
  });

  test('does not mutate input records or arrays', () => {
    const first = Object.freeze(
      expense('first', { description: 'Milk', receiptId: 'receipt-a' }),
    );
    const second = Object.freeze(
      expense('second', { description: 'Bread', receiptId: 'receipt-a' }),
    );
    const rows = Object.freeze([first, second]);
    const before = JSON.stringify(rows);
    const result = searchPurchaseIndex(buildPurchaseSearchIndex(rows), 'milk');

    expect(JSON.stringify(rows)).toBe(before);
    expect(result.days[0]?.results[0]?.purchase.expenses[0]).toBe(first);
  });

  test('supports consecutive queries without stale result leakage', () => {
    const index = buildPurchaseSearchIndex([
      expense('milk', { description: 'Milk' }),
      expense('bread', { description: 'Bread' }),
    ]);

    expect(resultKeys(searchPurchaseIndex(index, 'milk'))).toEqual([
      'expense:milk',
    ]);
    expect(resultKeys(searchPurchaseIndex(index, 'bread'))).toEqual([
      'expense:bread',
    ]);
    expect(resultKeys(searchPurchaseIndex(index, 'milk'))).toEqual([
      'expense:milk',
    ]);
  });

  test('is deterministic on a large synthetic monthly dataset', () => {
    const rows = Array.from({ length: 5_000 }, (_, index) =>
      expense(`expense-${index}`, {
        description: index % 211 === 0 ? `Target ${index}` : `Item ${index}`,
        merchantName: index % 2 === 0 ? 'Lidl' : 'Maxi',
        occurredOn: `2026-11-${String(28 - (index % 28)).padStart(2, '0')}`,
        receiptId: index % 3 === 0 ? `receipt-${Math.floor(index / 3)}` : null,
      }),
    );
    const index = buildPurchaseSearchIndex(rows);
    const first = searchPurchaseIndex(index, 'lidl target');
    const second = searchPurchaseIndex(index, '  LIDL, TARGET ');

    expect(second).toEqual(first);
    expect(first.matchingExpenseCount).toBeGreaterThan(0);
    expect(first.purchaseCount).toBeLessThanOrEqual(first.matchingExpenseCount);
  });
});
