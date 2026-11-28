import { describe, expect, test } from '@jest/globals';

import type { Expense } from '../db';
import {
  buildExpenseSearchIndex,
  searchExpenseIndex,
} from '../expenseSearch';

function expense(
  id: string,
  overrides: Partial<Expense> = {},
): Expense {
  return {
    id,
    receiptId: null,
    occurredOn: '2026-11-01',
    description: '',
    rawName: null,
    categoryId: 'category-1',
    categoryEmoji: '',
    categoryName: '',
    categorySlug: null,
    merchantId: null,
    merchantName: null,
    merchantLabel: null,
    originalAmountCents: 100,
    originalCurrency: 'RSD',
    amountRsdCents: 100,
    amountUsdCents: 1,
    amountEurCents: 1,
    fxRateDate: '2026-11-01',
    note: '',
    createdAt: '2026-11-01T12:00:00+01:00',
    ...overrides,
  };
}

function ids(rows: readonly Expense[]): string[] {
  return rows.map(({ id }) => id);
}

describe('local expense search index', () => {
  test('handles an empty dataset', () => {
    const index = buildExpenseSearchIndex([]);
    expect(searchExpenseIndex(index, '')).toEqual([]);
    expect(searchExpenseIndex(index, 'milk')).toEqual([]);
  });

  test('empty and whitespace-only queries return every expense in input order', () => {
    const rows = [expense('first'), expense('second')];
    const index = buildExpenseSearchIndex(rows);
    expect(searchExpenseIndex(index, '')).toEqual(rows);
    expect(searchExpenseIndex(index, '  \n\t  ')).toEqual(rows);
  });

  test('matches case-insensitively and by partial substring', () => {
    const row = expense('lidl', { merchantName: 'LIDL' });
    const index = buildExpenseSearchIndex([row]);
    expect(searchExpenseIndex(index, 'lidl')).toEqual([row]);
    expect(searchExpenseIndex(index, 'idl')).toEqual([row]);
  });

  test('collapses repeated query and field whitespace', () => {
    const row = expense('milk', { description: 'Fresh   milk' });
    const index = buildExpenseSearchIndex([row]);
    expect(searchExpenseIndex(index, '  fresh   milk  ')).toEqual([row]);
  });

  test('normalizes composed/decomposed Latin diacritics and Serbian letters', () => {
    const rows = [
      expense('tea', { description: 'Čaj' }),
      expense('name', { merchantName: 'Đorđe' }),
      expense('decomposed', { note: 'C\u030Cokolada' }),
    ];
    const index = buildExpenseSearchIndex(rows);
    expect(ids(searchExpenseIndex(index, 'caj'))).toEqual(['tea']);
    expect(ids(searchExpenseIndex(index, 'dorde'))).toEqual(['name']);
    expect(ids(searchExpenseIndex(index, 'cokolada'))).toEqual([
      'decomposed',
    ]);
  });

  test('treats Russian ё as е without collapsing й into и', () => {
    const rows = [
      expense('plane', { description: 'самолёт' }),
      expense('may', { description: 'май' }),
      expense('mai', { description: 'маи' }),
    ];
    const index = buildExpenseSearchIndex(rows);
    expect(ids(searchExpenseIndex(index, 'самолет'))).toEqual(['plane']);
    expect(ids(searchExpenseIndex(index, 'май'))).toEqual(['may']);
    expect(ids(searchExpenseIndex(index, 'маи'))).toEqual(['mai']);
  });

  test.each([
    ['description', expense('description', { description: 'Parking' })],
    ['raw receipt item name', expense('raw', { rawName: 'MLEKO 2.8%' })],
    ['merchant name', expense('merchant', { merchantName: 'Lidl' })],
    [
      'original merchant label',
      expense('label', { merchantLabel: 'LIDL DOO PRODAVNICA 42' }),
    ],
    ['category name', expense('category', { categoryName: 'Transport' })],
    ['note', expense('note', { note: 'Airport pickup' })],
  ])('searches %s', (_field, row) => {
    const queryById: Record<string, string> = {
      description: 'park',
      raw: 'mleko',
      merchant: 'lidl',
      label: 'prodavnica',
      category: 'transport',
      note: 'pickup',
    };
    expect(
      searchExpenseIndex(
        buildExpenseSearchIndex([row]),
        queryById[row.id] ?? '',
      ),
    ).toEqual([row]);
  });

  test('uses AND semantics for multiple tokens in one field', () => {
    const row = expense('same-field', {
      description: 'Fresh whole milk',
    });
    const index = buildExpenseSearchIndex([row]);
    expect(searchExpenseIndex(index, 'fresh milk')).toEqual([row]);
    expect(searchExpenseIndex(index, 'fresh coffee')).toEqual([]);
  });

  test('allows tokens to match different fields of the same expense', () => {
    const rows = [
      expense('lidl-milk', {
        description: 'Milk',
        merchantName: 'Lidl',
      }),
      expense('parking', {
        categoryName: 'Transport',
        description: 'Parking',
      }),
    ];
    const index = buildExpenseSearchIndex(rows);
    expect(ids(searchExpenseIndex(index, 'lidl milk'))).toEqual([
      'lidl-milk',
    ]);
    expect(ids(searchExpenseIndex(index, 'parking transport'))).toEqual([
      'parking',
    ]);
  });

  test('never spreads AND tokens across different expense records', () => {
    const index = buildExpenseSearchIndex([
      expense('merchant-only', { merchantName: 'Lidl' }),
      expense('item-only', { description: 'Milk' }),
    ]);
    expect(searchExpenseIndex(index, 'lidl milk')).toEqual([]);
  });

  test('treats punctuation as token separators and rejects punctuation-only input', () => {
    const row = expense('punctuation', {
      description: 'milk/chocolate — 2-pack',
    });
    const index = buildExpenseSearchIndex([row]);
    expect(searchExpenseIndex(index, 'milk, chocolate')).toEqual([row]);
    expect(searchExpenseIndex(index, '!!! — ...')).toEqual([]);
  });

  test('handles null and empty optional fields without accidental matches', () => {
    const row = expense('empty-fields', {
      description: '   ',
      rawName: null,
      merchantName: null,
      merchantLabel: null,
      categoryName: '',
      note: '\t',
    });
    const index = buildExpenseSearchIndex([row]);
    expect(searchExpenseIndex(index, 'anything')).toEqual([]);
    expect(searchExpenseIndex(index, '')).toEqual([row]);
  });

  test('returns no rows when no field matches', () => {
    const index = buildExpenseSearchIndex([
      expense('coffee', { description: 'Coffee' }),
    ]);
    expect(searchExpenseIndex(index, 'train')).toEqual([]);
  });

  test('preserves stable input order without relevance ranking', () => {
    const rows = [
      expense('partial', { description: 'Milk chocolate' }),
      expense('exact', { description: 'Milk' }),
      expense('merchant', { merchantName: 'Milk shop' }),
    ];
    expect(ids(searchExpenseIndex(buildExpenseSearchIndex(rows), 'milk'))).toEqual([
      'partial',
      'exact',
      'merchant',
    ]);
  });

  test('preserves original object identity and does not mutate input records', () => {
    const first = Object.freeze(
      expense('first', { description: 'Milk', merchantName: 'Lidl' }),
    );
    const second = Object.freeze(expense('second', { description: 'Bread' }));
    const rows = Object.freeze([first, second]);
    const before = JSON.stringify(rows);
    const result = searchExpenseIndex(buildExpenseSearchIndex(rows), 'lidl');

    expect(result[0]).toBe(first);
    expect(JSON.stringify(rows)).toBe(before);
  });

  test('accepts trusted caller-supplied labels without translating names itself', () => {
    const row = expense('localized-category', {
      categoryName: 'Продукты',
    });
    const index = buildExpenseSearchIndex([row], {
      trustedLabelsForExpense: (candidate) =>
        candidate.categoryId === 'category-1' ? ['Groceries'] : [],
    });
    expect(searchExpenseIndex(index, 'grocer')).toEqual([row]);
    expect(searchExpenseIndex(index, 'продукт')).toEqual([row]);
  });

  test('does not search amounts, currencies, ids, or dates', () => {
    const row = expense('hidden-fields', {
      occurredOn: '2026-11-28',
      originalAmountCents: 123456,
      originalCurrency: 'EUR',
    });
    const index = buildExpenseSearchIndex([row]);
    expect(searchExpenseIndex(index, '123456')).toEqual([]);
    expect(searchExpenseIndex(index, 'eur')).toEqual([]);
    expect(searchExpenseIndex(index, '2026')).toEqual([]);
    expect(searchExpenseIndex(index, 'hidden-fields')).toEqual([]);
  });

  test('is deterministic on a large synthetic monthly dataset', () => {
    const rows = Array.from({ length: 5_000 }, (_, index) =>
      expense(`expense-${index}`, {
        description:
          index % 137 === 0 ? `Target milk ${index}` : `Item ${index}`,
        merchantName: index % 2 === 0 ? 'Lidl' : 'Maxi',
      }),
    );
    const index = buildExpenseSearchIndex(rows);
    const expected = rows
      .filter(
        (row) =>
          row.merchantName === 'Lidl' && row.description.includes('Target'),
      )
      .map(({ id }) => id);

    expect(ids(searchExpenseIndex(index, 'lidl target'))).toEqual(expected);
    expect(ids(searchExpenseIndex(index, '  LIDL, TARGET '))).toEqual(expected);
  });
});
