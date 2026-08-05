import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import {
  learnItemCategoryRules,
  normalizeItemName,
  resolveCategoriesForItems,
  upsertItemCategoryRules,
} from '../itemCategorization';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

const getSessionMock = supabase.auth.getSession as unknown as jest.Mock;
const fromMock = supabase.from as unknown as jest.Mock;

const categories = [
  {
    id: 'uncategorized',
    name: 'Не распознано',
    slug: 'uncategorized',
  },
  { id: 'groceries', name: 'Продукты', slug: null },
];

describe('normalizeItemName', () => {
  test.each([
    ['  MLEKO   968ML (KOM) (E) ', 'mleko'],
    ['MLEKO 620G', 'mleko'],
    ['ＭＬＥＫＯ 968ML', 'mleko'],
    ['VLAZNE MARAMICE 64/1 (Ђ)', 'vlazne maramice'],
    ['HLEB (K OM)', 'hleb'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeItemName(input)).toBe(expected);
  });

  test.each([
    'Coca-Cola Zero 0,25 Л',
    'COCA COLA ZERO 0,25 L',
    'Coca-Cola Zero',
    'Coca-Cola Zero 0.5l',
    'coca cola zero 1 л',
  ])('collapses product formatting variants in %s', (input) => {
    expect(normalizeItemName(input)).toBe('coca cola zero');
  });

  test('normalizes punctuation while preserving diacritics', () => {
    expect(normalizeItemName('Kapučino-Espreso')).toBe('kapučino espreso');
    expect(normalizeItemName('kapučino espreso')).toBe('kapučino espreso');
  });

  test('preserves descriptors, percentages, and short leading numbers', () => {
    expect(normalizeItemName('Cigarete Winston Xspression Long')).toBe(
      'cigarete winston xspression long',
    );
    expect(normalizeItemName('Mleko 2,8% 1 л')).toBe('mleko 2,8%');
    expect(normalizeItemName('Mleko 2,8%')).not.toBe(
      normalizeItemName('Mleko 3,2%'),
    );
    expect(normalizeItemName('7 days')).toBe('7 days');
    expect(normalizeItemName('100 plus')).toBe('100 plus');
  });

  test('strips generic count units and long leading article numbers', () => {
    expect(
      normalizeItemName('50173617 zvake orbit eukaliptus dr / kom'),
    ).toBe('zvake orbit eukaliptus dr');
    expect(normalizeItemName('Kafa 10 шт.')).toBe('kafa');
  });

  test.each([
    'Coca-Cola Zero 0,25 Л',
    'COCA COLA ZERO 0,25 L',
    'Coca-Cola Zero',
    'Coca-Cola Zero 0.5l',
    'coca cola zero 1 л',
    'Kapučino-Espreso',
    'kapučino espreso',
    'Cigarete Winston Xspression Long',
    'Mleko 2,8% 1 л',
    'Mleko 3,2%',
    '7 days',
    '50173617 zvake orbit eukaliptus dr / kom',
  ])('is idempotent for %s', (input) => {
    const normalized = normalizeItemName(input);
    expect(normalizeItemName(normalized)).toBe(normalized);
  });
});

describe('resolveCategoriesForItems', () => {
  test('uses a personal dictionary hit without calling AI', async () => {
    const loadRules = jest.fn(async () => [
      {
        normalizedName: 'mleko',
        categoryId: 'groceries',
        displayName: 'Молоко',
        action: 'categorize' as const,
      },
    ]);
    const categorize = jest.fn(async () => []);

    await expect(
      resolveCategoriesForItems(
        [{ name: 'MLEKO 968ML (E)' }],
        categories,
        { loadRules, categorize },
      ),
    ).resolves.toEqual([
      {
        categoryId: 'groceries',
        displayName: 'Молоко',
        excluded: false,
      },
    ]);
    expect(loadRules).toHaveBeenCalledWith(['mleko']);
    expect(categorize).not.toHaveBeenCalled();
  });

  test('deduplicates unresolved variants and maps the AI category name', async () => {
    const loadRules = jest.fn(async () => []);
    const categorize = jest.fn(
      async (items: readonly { name: string }[]) => [
        {
          name: items[0]?.name ?? '',
          displayName: 'Молоко',
          categoryName: 'Продукты',
        },
      ],
    );

    await expect(
      resolveCategoriesForItems(
        [{ name: 'MLEKO 968ML' }, { name: 'mleko 620g (E)' }],
        categories,
        { loadRules, categorize },
      ),
    ).resolves.toEqual([
      {
        categoryId: 'groceries',
        displayName: 'Молоко',
        excluded: false,
      },
      {
        categoryId: 'groceries',
        displayName: 'Молоко',
        excluded: false,
      },
    ]);
    expect(categorize).toHaveBeenCalledWith(
      [{ name: 'MLEKO 968ML' }],
      categories,
    );
  });

  test('pre-excludes a dictionary match without calling AI', async () => {
    const loadRules = jest.fn(async () => [
      {
        normalizedName: 'kesa',
        categoryId: null,
        displayName: 'Пакет',
        action: 'exclude' as const,
      },
    ]);
    const categorize = jest.fn(async () => []);

    await expect(
      resolveCategoriesForItems(
        [{ name: 'KESA (E)' }],
        categories,
        { loadRules, categorize },
      ),
    ).resolves.toEqual([
      {
        categoryId: 'uncategorized',
        displayName: 'Пакет',
        excluded: true,
      },
    ]);
    expect(categorize).not.toHaveBeenCalled();
  });
});

describe('item category learning', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    fromMock.mockReset();
  });

  test('stores an edited display name in the categorization rule', async () => {
    const writer = jest.fn(async () => undefined);

    await learnItemCategoryRules(
      [
        {
          rawName: 'MLEKO 968ML (KOM)',
          displayName: 'Молоко домашнее',
          categoryId: 'groceries',
          excluded: false,
        },
      ],
      writer,
    );

    expect(writer).toHaveBeenCalledWith([
      {
        normalizedName: 'mleko',
        categoryId: 'groceries',
        displayName: 'Молоко домашнее',
        action: 'categorize',
      },
    ]);
  });

  test('learns an exclusion with no category', async () => {
    const writer = jest.fn(async () => undefined);

    await learnItemCategoryRules(
      [
        {
          rawName: 'KESA (E)',
          displayName: 'Пакет',
          categoryId: 'groceries',
          excluded: true,
        },
      ],
      writer,
    );

    expect(writer).toHaveBeenCalledWith([
      {
        normalizedName: 'kesa',
        categoryId: null,
        displayName: 'Пакет',
        action: 'exclude',
      },
    ]);
  });

  test('keeps the last correction for duplicate normalized names', async () => {
    const writer = jest.fn(async () => undefined);

    await learnItemCategoryRules(
      [
        {
          rawName: 'MLEKO 968ML',
          displayName: 'Молочный напиток',
          categoryId: 'other',
          excluded: false,
        },
        {
          rawName: 'mleko 620g',
          displayName: 'Молоко',
          categoryId: 'groceries',
          excluded: false,
        },
      ],
      writer,
    );

    expect(writer).toHaveBeenCalledWith([
      {
        normalizedName: 'mleko',
        categoryId: 'groceries',
        displayName: 'Молоко',
        action: 'categorize',
      },
    ]);
  });

  test('upserts the latest rule and increments its hit count', async () => {
    getSessionMock.mockImplementation(async () => ({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    }));
    const existingQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn(async () => ({
        data: [{ normalized_name: 'mleko', hit_count: 2 }],
        error: null,
      })),
    };
    const upsertQuery = {
      upsert: jest.fn(async () => ({ error: null })),
    };
    fromMock
      .mockReturnValueOnce(existingQuery)
      .mockReturnValueOnce(upsertQuery);

    await upsertItemCategoryRules([
      {
        normalizedName: 'mleko',
        categoryId: 'groceries',
        displayName: 'Молоко',
        action: 'categorize',
      },
    ]);

    expect(fromMock).toHaveBeenNthCalledWith(1, 'item_category_rules');
    expect(fromMock).toHaveBeenNthCalledWith(2, 'item_category_rules');
    expect(upsertQuery.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          user_id: 'user-1',
          normalized_name: 'mleko',
          category_id: 'groceries',
          display_name: 'Молоко',
          action: 'categorize',
          hit_count: 3,
        }),
      ],
      { onConflict: 'user_id,normalized_name' },
    );
  });
});
