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
});

describe('resolveCategoriesForItems', () => {
  test('uses a personal dictionary hit without calling AI', async () => {
    const loadRules = jest.fn(async () => [
      {
        normalizedName: 'mleko',
        categoryId: 'groceries',
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
      { categoryId: 'groceries', excluded: false },
    ]);
    expect(loadRules).toHaveBeenCalledWith(['mleko']);
    expect(categorize).not.toHaveBeenCalled();
  });

  test('deduplicates unresolved variants and maps the AI category name', async () => {
    const loadRules = jest.fn(async () => []);
    const categorize = jest.fn(
      async (items: readonly { name: string }[]) => [
        { name: items[0]?.name ?? '', categoryName: 'Продукты' },
      ],
    );

    await expect(
      resolveCategoriesForItems(
        [{ name: 'MLEKO 968ML' }, { name: 'mleko 620g (E)' }],
        categories,
        { loadRules, categorize },
      ),
    ).resolves.toEqual([
      { categoryId: 'groceries', excluded: false },
      { categoryId: 'groceries', excluded: false },
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
      { categoryId: 'uncategorized', excluded: true },
    ]);
    expect(categorize).not.toHaveBeenCalled();
  });
});

describe('item category learning', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    fromMock.mockReset();
  });

  test('turns a category edit into a categorization rule', async () => {
    const writer = jest.fn(async () => undefined);

    await learnItemCategoryRules(
      [
        {
          name: 'MLEKO 968ML (KOM)',
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
        action: 'categorize',
      },
    ]);
  });

  test('learns an exclusion with no category', async () => {
    const writer = jest.fn(async () => undefined);

    await learnItemCategoryRules(
      [{ name: 'KESA (E)', categoryId: 'groceries', excluded: true }],
      writer,
    );

    expect(writer).toHaveBeenCalledWith([
      {
        normalizedName: 'kesa',
        categoryId: null,
        action: 'exclude',
      },
    ]);
  });

  test('keeps the last correction for duplicate normalized names', async () => {
    const writer = jest.fn(async () => undefined);

    await learnItemCategoryRules(
      [
        { name: 'MLEKO 968ML', categoryId: 'other', excluded: false },
        { name: 'mleko 620g', categoryId: 'groceries', excluded: false },
      ],
      writer,
    );

    expect(writer).toHaveBeenCalledWith([
      {
        normalizedName: 'mleko',
        categoryId: 'groceries',
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
          action: 'categorize',
          hit_count: 3,
        }),
      ],
      { onConflict: 'user_id,normalized_name' },
    );
  });
});
