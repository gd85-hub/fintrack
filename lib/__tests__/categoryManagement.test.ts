import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import {
  deleteCategory,
  listCategories,
  listCategoriesForManagement,
  mergeCategories,
  UncategorizedCategoryProtectedError,
  updateCategory,
} from '../db';
import {
  categoryUsageCounts,
  filterAndSortCategories,
  isCategoryOwnedByUser,
} from '../categoryManagement';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

const getSessionMock = supabase.auth.getSession as unknown as jest.Mock;
const fromMock = supabase.from as unknown as jest.Mock;

function selectInClient(data: unknown[], error: unknown = null) {
  const inFilter = jest.fn(async () => ({ data, error }));
  const select = jest.fn(() => ({ in: inFilter }));
  return { client: { select }, inFilter, select };
}

function selectInEqClient(data: unknown[], error: unknown = null) {
  const eq = jest.fn(async () => ({ data, error }));
  const inFilter = jest.fn(() => ({ eq }));
  const select = jest.fn(() => ({ in: inFilter }));
  return { client: { select }, eq, inFilter, select };
}

function updateInEqClient(error: unknown = null) {
  const eq = jest.fn(async () => ({ error }));
  const inFilter = jest.fn(() => ({ eq }));
  const update = jest.fn(() => ({ in: inFilter }));
  return { client: { update }, eq, inFilter, update };
}

function deleteInEqClient(error: unknown = null) {
  const eq = jest.fn(async () => ({ error }));
  const inFilter = jest.fn(() => ({ eq }));
  const deleteRows = jest.fn(() => ({ in: inFilter }));
  return {
    client: { delete: deleteRows },
    deleteRows,
    eq,
    inFilter,
  };
}

function updateEqEqClient(error: unknown = null) {
  const secondEq = jest.fn(async () => ({ error }));
  const firstEq = jest.fn(() => ({ eq: secondEq }));
  const update = jest.fn(() => ({ eq: firstEq }));
  return { client: { update }, firstEq, secondEq, update };
}

function listCategoriesClient(data: unknown[], error: unknown = null) {
  const order = jest.fn(async () => ({ data, error }));
  const userEq = jest.fn(() => ({ order }));
  const activeEq = jest.fn(() => ({ eq: userEq }));
  const select = jest.fn(() => ({ eq: activeEq }));
  return { activeEq, client: { select }, order, select, userEq };
}

function listManagedCategoriesClient(
  data: unknown[],
  error: unknown = null,
) {
  const order = jest.fn(async () => ({ data, error }));
  const userEq = jest.fn(() => ({ order }));
  const select = jest.fn(() => ({ eq: userEq }));
  return { client: { select }, order, select, userEq };
}

function selectEqClient(data: unknown[], error: unknown = null) {
  const eq = jest.fn(async () => ({ data, error }));
  const select = jest.fn(() => ({ eq }));
  return { client: { select }, eq, select };
}

function selectOwnedCategoryClient(data: unknown) {
  const maybeSingle = jest.fn(async () => ({ data, error: null }));
  const userEq = jest.fn(() => ({ maybeSingle }));
  const idEq = jest.fn(() => ({ eq: userEq }));
  const select = jest.fn(() => ({ eq: idEq }));
  return { client: { select }, idEq, maybeSingle, select, userEq };
}

function selectUncategorizedClient(data: unknown) {
  const single = jest.fn(async () => ({ data, error: null }));
  const userEq = jest.fn(() => ({ single }));
  const slugEq = jest.fn(() => ({ eq: userEq }));
  const select = jest.fn(() => ({ eq: slugEq }));
  return { client: { select }, select, single, slugEq, userEq };
}

const uncategorizedTarget = {
  active: true,
  emoji: '❓',
  group: 'Прочее',
  id: 'target',
  is_system: false,
  name: 'Не распознано',
  slug: 'uncategorized',
  sort: 0,
  type: 'variable',
  user_id: 'user-1',
};

const userSource = {
  ...uncategorizedTarget,
  emoji: '🍬',
  id: 'source-a',
  is_system: false,
  name: 'Сладости',
  slug: null,
  sort: 260,
  user_id: 'user-1',
};

const formerlySystemOwned = {
  ...userSource,
  id: 'former-default',
  is_system: true,
  name: 'Продукты',
};

const foreignSource = {
  ...userSource,
  id: 'foreign-source',
  user_id: 'user-2',
};

const secondUserSource = {
  ...userSource,
  emoji: '🥤',
  id: 'source-b',
  name: 'Напитки',
  sort: 270,
};

describe('category management helpers', () => {
  test('allows writes for every category owned by the user', () => {
    expect(
      isCategoryOwnedByUser(
        { isSystem: false, userId: 'user-1' },
        'user-1',
      ),
    ).toBe(true);
    expect(
      isCategoryOwnedByUser(
        { isSystem: true, userId: 'user-1' },
        'user-1',
      ),
    ).toBe(true);
    expect(
      isCategoryOwnedByUser(
        { isSystem: false, userId: null },
        'user-1',
      ),
    ).toBe(false);
    expect(
      isCategoryOwnedByUser(
        { isSystem: false, userId: 'user-2' },
        'user-1',
      ),
    ).toBe(false);
  });

  test('counts usage and applies normalized search', () => {
    const categories = [
      {
        emoji: '🥤',
        group: 'Еда',
        name: 'Напитки',
        sort: 20,
        type: 'variable' as const,
      },
      {
        emoji: '🍬',
        group: 'Еда',
        name: 'Сладости',
        sort: 10,
        type: 'variable' as const,
      },
    ];

    expect(
      Object.fromEntries(
        categoryUsageCounts(
          ['first', 'second'],
          ['first', 'first', 'missing'],
        ),
      ),
    ).toEqual({ first: 2, second: 0 });
    expect(filterAndSortCategories(categories, 'СЛАДОСТИ')).toEqual([
      categories[1],
    ]);
  });
});

describe('category database operations', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    fromMock.mockReset();
    getSessionMock.mockImplementation(async () => ({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    }));
  });

  test('lists only active categories owned by the authenticated user', async () => {
    const categoryQuery = listCategoriesClient([uncategorizedTarget]);
    fromMock.mockReturnValueOnce(categoryQuery.client);

    await expect(listCategories()).resolves.toEqual([
      {
        emoji: '❓',
        group: 'Прочее',
        id: 'target',
        name: 'Не распознано',
        slug: 'uncategorized',
        sort: 0,
      },
    ]);
    expect(categoryQuery.activeEq).toHaveBeenCalledWith('active', true);
    expect(categoryQuery.userEq).toHaveBeenCalledWith(
      'user_id',
      'user-1',
    );
  });

  test('lists only owned categories for management', async () => {
    const categoryQuery = listManagedCategoriesClient([
      formerlySystemOwned,
    ]);
    const expenseQuery = selectEqClient([]);
    fromMock
      .mockReturnValueOnce(categoryQuery.client)
      .mockReturnValueOnce(expenseQuery.client);

    const result = await listCategoriesForManagement();

    expect(categoryQuery.userEq).toHaveBeenCalledWith(
      'user_id',
      'user-1',
    );
    expect(expenseQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(result[0]).toMatchObject({
      id: 'former-default',
      isOwnedByCurrentUser: true,
      isSystem: false,
      userId: 'user-1',
    });
  });

  test('updates a formerly system-marked category owned by the user', async () => {
    const categoryQuery = selectOwnedCategoryClient(formerlySystemOwned);
    const updateQuery = updateEqEqClient();
    fromMock
      .mockReturnValueOnce(categoryQuery.client)
      .mockReturnValueOnce(updateQuery.client);

    await expect(
      updateCategory('former-default', {
        emoji: ' 🛒 ',
        group: ' Еда ',
        name: ' Продукты дома ',
        type: 'variable',
      }),
    ).resolves.toBeUndefined();
    expect(updateQuery.update).toHaveBeenCalledWith({
      emoji: '🛒',
      group: 'Еда',
      name: 'Продукты дома',
      type: 'variable',
    });
    expect(updateQuery.firstEq).toHaveBeenCalledWith(
      'id',
      'former-default',
    );
    expect(updateQuery.secondEq).toHaveBeenCalledWith(
      'user_id',
      'user-1',
    );
  });

  test('merge re-points every category reference and deletes user sources', async () => {
    const categoryQuery = selectInClient([
      uncategorizedTarget,
      userSource,
      secondUserSource,
    ]);
    const expenseQuery = selectInEqClient([
      {
        category_id: 'source-a',
        id: 'expense-a',
        user_id: 'user-1',
      },
      {
        category_id: 'source-b',
        id: 'expense-b',
        user_id: 'user-1',
      },
    ]);
    const subscriptionQuery = selectInEqClient([
      {
        category_id: 'source-b',
        id: 'subscription-b',
        user_id: 'user-1',
      },
    ]);
    const ruleQuery = selectInEqClient([
      {
        category_id: 'source-a',
        id: 'rule-a',
        user_id: 'user-1',
      },
    ]);
    const expenseUpdate = updateInEqClient();
    const subscriptionUpdate = updateInEqClient();
    const ruleUpdate = updateInEqClient();
    const sourceDelete = deleteInEqClient();

    fromMock
      .mockReturnValueOnce(categoryQuery.client)
      .mockReturnValueOnce(expenseQuery.client)
      .mockReturnValueOnce(subscriptionQuery.client)
      .mockReturnValueOnce(ruleQuery.client)
      .mockReturnValueOnce(expenseUpdate.client)
      .mockReturnValueOnce(subscriptionUpdate.client)
      .mockReturnValueOnce(ruleUpdate.client)
      .mockReturnValueOnce(sourceDelete.client);

    await expect(
      mergeCategories('target', ['source-a', 'source-b']),
    ).resolves.toEqual({ affectedExpenses: 2 });

    for (const referenceUpdate of [
      expenseUpdate,
      subscriptionUpdate,
      ruleUpdate,
    ]) {
      expect(referenceUpdate.update).toHaveBeenCalledWith({
        category_id: 'target',
      });
      expect(referenceUpdate.inFilter).toHaveBeenCalledWith(
        'category_id',
        ['source-a', 'source-b'],
      );
      expect(referenceUpdate.eq).toHaveBeenCalledWith(
        'user_id',
        'user-1',
      );
    }
    expect(sourceDelete.inFilter).toHaveBeenCalledWith('id', [
      'source-a',
      'source-b',
    ]);
    expect(sourceDelete.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  test('merge refuses a category owned by another user before writing', async () => {
    const categoryQuery = selectInClient([
      { ...userSource, id: 'target' },
      foreignSource,
    ]);
    fromMock.mockReturnValueOnce(categoryQuery.client);

    await expect(
      mergeCategories('target', ['foreign-source']),
    ).rejects.toThrow('Категория для объединения не найдена.');
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  test('merge refuses uncategorized as a source before writing', async () => {
    const categoryQuery = selectInClient([
      { ...userSource, id: 'merge-target' },
      uncategorizedTarget,
    ]);
    fromMock.mockReturnValueOnce(categoryQuery.client);

    await expect(
      mergeCategories('merge-target', ['target']),
    ).rejects.toBeInstanceOf(UncategorizedCategoryProtectedError);
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  test('delete moves expenses and dictionary rules to uncategorized', async () => {
    const sourceQuery = selectOwnedCategoryClient({
      ...userSource,
      is_system: true,
    });
    const uncategorizedQuery = selectUncategorizedClient(
      uncategorizedTarget,
    );
    const expenseQuery = selectInEqClient([
      {
        category_id: 'source-a',
        id: 'expense-a',
        user_id: 'user-1',
      },
    ]);
    const subscriptionQuery = selectInEqClient([]);
    const ruleQuery = selectInEqClient([
      {
        category_id: 'source-a',
        id: 'rule-a',
        user_id: 'user-1',
      },
    ]);
    const expenseUpdate = updateInEqClient();
    const subscriptionUpdate = updateInEqClient();
    const ruleUpdate = updateInEqClient();
    const sourceDelete = deleteInEqClient();

    fromMock
      .mockReturnValueOnce(sourceQuery.client)
      .mockReturnValueOnce(uncategorizedQuery.client)
      .mockReturnValueOnce(expenseQuery.client)
      .mockReturnValueOnce(subscriptionQuery.client)
      .mockReturnValueOnce(ruleQuery.client)
      .mockReturnValueOnce(expenseUpdate.client)
      .mockReturnValueOnce(subscriptionUpdate.client)
      .mockReturnValueOnce(ruleUpdate.client)
      .mockReturnValueOnce(sourceDelete.client);

    await expect(deleteCategory('source-a')).resolves.toEqual({
      affectedExpenses: 1,
    });
    expect(expenseUpdate.update).toHaveBeenCalledWith({
      category_id: 'target',
    });
    expect(ruleUpdate.update).toHaveBeenCalledWith({
      category_id: 'target',
    });
    expect(uncategorizedQuery.slugEq).toHaveBeenCalledWith(
      'slug',
      'uncategorized',
    );
    expect(uncategorizedQuery.userEq).toHaveBeenCalledWith(
      'user_id',
      'user-1',
    );
    expect(sourceDelete.inFilter).toHaveBeenCalledWith('id', [
      'source-a',
    ]);
    expect(sourceDelete.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  test('restores moved references when deleting the source fails', async () => {
    const categoryQuery = selectInClient([
      uncategorizedTarget,
      userSource,
    ]);
    const expenseQuery = selectInEqClient([
      {
        category_id: 'source-a',
        id: 'expense-a',
        user_id: 'user-1',
      },
    ]);
    const subscriptionQuery = selectInEqClient([]);
    const ruleQuery = selectInEqClient([
      {
        category_id: 'source-a',
        id: 'rule-a',
        user_id: 'user-1',
      },
    ]);
    const expenseUpdate = updateInEqClient();
    const subscriptionUpdate = updateInEqClient();
    const ruleUpdate = updateInEqClient();
    const sourceDelete = deleteInEqClient({ message: 'delete failed' });
    const ruleRestore = updateInEqClient();
    const expenseRestore = updateInEqClient();

    fromMock
      .mockReturnValueOnce(categoryQuery.client)
      .mockReturnValueOnce(expenseQuery.client)
      .mockReturnValueOnce(subscriptionQuery.client)
      .mockReturnValueOnce(ruleQuery.client)
      .mockReturnValueOnce(expenseUpdate.client)
      .mockReturnValueOnce(subscriptionUpdate.client)
      .mockReturnValueOnce(ruleUpdate.client)
      .mockReturnValueOnce(sourceDelete.client)
      .mockReturnValueOnce(ruleRestore.client)
      .mockReturnValueOnce(expenseRestore.client);

    await expect(
      mergeCategories('target', ['source-a']),
    ).rejects.toEqual({ message: 'delete failed' });
    expect(ruleRestore.update).toHaveBeenCalledWith({
      category_id: 'source-a',
    });
    expect(ruleRestore.inFilter).toHaveBeenCalledWith('id', ['rule-a']);
    expect(expenseRestore.update).toHaveBeenCalledWith({
      category_id: 'source-a',
    });
    expect(expenseRestore.inFilter).toHaveBeenCalledWith('id', [
      'expense-a',
    ]);
  });

  test('delete refuses the owned uncategorized category before moving references', async () => {
    const sourceQuery = selectOwnedCategoryClient(uncategorizedTarget);
    const uncategorizedQuery = selectUncategorizedClient(
      uncategorizedTarget,
    );
    fromMock
      .mockReturnValueOnce(sourceQuery.client)
      .mockReturnValueOnce(uncategorizedQuery.client);

    await expect(deleteCategory('target')).rejects.toBeInstanceOf(
      UncategorizedCategoryProtectedError,
    );
    expect(fromMock).toHaveBeenCalledTimes(2);
  });
});
