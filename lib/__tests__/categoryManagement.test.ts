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

function updateEqEqClient(error: unknown = null) {
  const secondEq = jest.fn(async () => ({ error }));
  const firstEq = jest.fn(() => ({ eq: secondEq }));
  const update = jest.fn(() => ({ eq: firstEq }));
  return { client: { update }, firstEq, secondEq, update };
}

type PageOptions = { errorFrom?: number; serverLimit?: number };

// A page loader for fetchAllRows: stateless in `from`, so the same client can
// answer every page; a slice past the end returns [] and ends the loop. With
// serverLimit it caps each page below the requested range (simulating a
// PostgREST cap), which forces multiple pages. errorFrom fails from that offset.
function pageRange(data: unknown[], options: PageOptions = {}) {
  return jest.fn(async (from: number, to: number) => {
    if (options.errorFrom !== undefined && from >= options.errorFrom) {
      return { data: null, error: { message: `read-page-${from}` } };
    }
    const requested = to - from + 1;
    const returned = Math.min(requested, options.serverLimit ?? requested);
    return { data: data.slice(from, from + returned), error: null };
  });
}

// Paginated management usage read: select → eq → order → range.
function pagedCountClient(data: unknown[], options: PageOptions = {}) {
  const range = pageRange(data, options);
  const order = jest.fn(() => ({ range }));
  const eq = jest.fn(() => ({ order }));
  const select = jest.fn(() => ({ eq }));
  return { client: { select }, eq, order, range, select };
}

// Combined reference-table client: paginated read (select → in → eq → order →
// range) plus update (update → in → eq), so one memoized client serves both a
// snapshot read and its re-point/restore writes regardless of call order.
function refTableClient(
  data: unknown[],
  options: PageOptions & { updateError?: unknown } = {},
) {
  const range = pageRange(data, options);
  const readOrder = jest.fn(() => ({ range }));
  const readEq = jest.fn(() => ({ order: readOrder }));
  const readIn = jest.fn(() => ({ eq: readEq }));
  const select = jest.fn(() => ({ in: readIn }));
  const updateEq = jest.fn(async () => ({ error: options.updateError ?? null }));
  const updateIn = jest.fn(() => ({ eq: updateEq }));
  const update = jest.fn(() => ({ in: updateIn }));
  return { client: { select, update }, range, update, updateEq, updateIn };
}

// categories table for mergeCategories: snapshot read (select → in) and final
// delete (delete → in → eq) in one client.
function categoriesMergeClient(
  snapshot: unknown[],
  options: { deleteError?: unknown } = {},
) {
  const snapshotIn = jest.fn(async () => ({ data: snapshot, error: null }));
  const select = jest.fn(() => ({ in: snapshotIn }));
  const deleteEq = jest.fn(async () => ({ error: options.deleteError ?? null }));
  const deleteIn = jest.fn(() => ({ eq: deleteEq }));
  const deleteRows = jest.fn(() => ({ in: deleteIn }));
  return {
    client: { select, delete: deleteRows },
    deleteEq,
    deleteIn,
    deleteRows,
    snapshotIn,
  };
}

// Dispatch from(table) to a fixed per-table client, so paginated reads that
// call from() once per page need no fragile call-order sequencing.
function installTables(map: Record<string, unknown>) {
  fromMock.mockImplementation((table: unknown) => {
    const client = map[table as string];
    if (!client) {
      throw new Error(`Unexpected from(${String(table)})`);
    }
    return client;
  });
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
    const expenseQuery = pagedCountClient([]);
    installTables({
      categories: categoryQuery.client,
      expenses: expenseQuery.client,
    });

    const result = await listCategoriesForManagement();

    expect(categoryQuery.userEq).toHaveBeenCalledWith(
      'user_id',
      'user-1',
    );
    expect(expenseQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(expenseQuery.order).toHaveBeenCalledWith('id', {
      ascending: true,
    });
    expect(result[0]).toMatchObject({
      id: 'former-default',
      isOwnedByCurrentUser: true,
      isSystem: false,
      userId: 'user-1',
    });
  });

  test('counts category usage across every expense page', async () => {
    const categoryQuery = listManagedCategoriesClient([
      { ...userSource, id: 'source-a' },
    ]);
    // Three references with a server cap of two per page: the count must still
    // include the row that only appears on the second page.
    const expenseQuery = pagedCountClient(
      [
        { category_id: 'source-a', id: 'expense-1' },
        { category_id: 'source-a', id: 'expense-2' },
        { category_id: 'source-a', id: 'expense-3' },
      ],
      { serverLimit: 2 },
    );
    installTables({
      categories: categoryQuery.client,
      expenses: expenseQuery.client,
    });

    const result = await listCategoriesForManagement();

    expect(result[0]).toMatchObject({ id: 'source-a', usageCount: 3 });
    expect(expenseQuery.range.mock.calls.length).toBeGreaterThan(1);
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
    const categories = categoriesMergeClient([
      uncategorizedTarget,
      userSource,
      secondUserSource,
    ]);
    const expenses = refTableClient([
      { category_id: 'source-a', id: 'expense-a', user_id: 'user-1' },
      { category_id: 'source-b', id: 'expense-b', user_id: 'user-1' },
    ]);
    const subscriptions = refTableClient([
      { category_id: 'source-b', id: 'subscription-b', user_id: 'user-1' },
    ]);
    const rules = refTableClient([
      { category_id: 'source-a', id: 'rule-a', user_id: 'user-1' },
    ]);
    installTables({
      categories: categories.client,
      expenses: expenses.client,
      subscriptions: subscriptions.client,
      item_category_rules: rules.client,
    });

    await expect(
      mergeCategories('target', ['source-a', 'source-b']),
    ).resolves.toEqual({ affectedExpenses: 2 });

    for (const reference of [expenses, subscriptions, rules]) {
      expect(reference.update).toHaveBeenCalledWith({
        category_id: 'target',
      });
      expect(reference.updateIn).toHaveBeenCalledWith('category_id', [
        'source-a',
        'source-b',
      ]);
      expect(reference.updateEq).toHaveBeenCalledWith('user_id', 'user-1');
    }
    expect(categories.deleteIn).toHaveBeenCalledWith('id', [
      'source-a',
      'source-b',
    ]);
    expect(categories.deleteEq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  test('merge counts affected expenses across every reference page', async () => {
    const categories = categoriesMergeClient([
      uncategorizedTarget,
      userSource,
    ]);
    // Server caps reference pages at two rows; the third expense is only
    // reachable on a later page and must still be counted and re-pointed.
    const expenses = refTableClient(
      [
        { category_id: 'source-a', id: 'expense-a', user_id: 'user-1' },
        { category_id: 'source-a', id: 'expense-b', user_id: 'user-1' },
        { category_id: 'source-a', id: 'expense-c', user_id: 'user-1' },
      ],
      { serverLimit: 2 },
    );
    const subscriptions = refTableClient([]);
    const rules = refTableClient([]);
    installTables({
      categories: categories.client,
      expenses: expenses.client,
      subscriptions: subscriptions.client,
      item_category_rules: rules.client,
    });

    await expect(
      mergeCategories('target', ['source-a']),
    ).resolves.toEqual({ affectedExpenses: 3 });
    expect(expenses.range.mock.calls.length).toBeGreaterThan(1);
  });

  test('merge aborts before any mutation when a reference page fails', async () => {
    const categories = categoriesMergeClient([
      uncategorizedTarget,
      userSource,
    ]);
    const expenses = refTableClient(
      [
        { category_id: 'source-a', id: 'expense-a', user_id: 'user-1' },
        { category_id: 'source-a', id: 'expense-b', user_id: 'user-1' },
        { category_id: 'source-a', id: 'expense-c', user_id: 'user-1' },
      ],
      { serverLimit: 2, errorFrom: 2 },
    );
    const subscriptions = refTableClient([]);
    const rules = refTableClient([]);
    installTables({
      categories: categories.client,
      expenses: expenses.client,
      subscriptions: subscriptions.client,
      item_category_rules: rules.client,
    });

    await expect(
      mergeCategories('target', ['source-a']),
    ).rejects.toMatchObject({ message: 'read-page-2' });
    expect(expenses.update).not.toHaveBeenCalled();
    expect(subscriptions.update).not.toHaveBeenCalled();
    expect(rules.update).not.toHaveBeenCalled();
    expect(categories.deleteRows).not.toHaveBeenCalled();
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
    const expenses = refTableClient([
      { category_id: 'source-a', id: 'expense-a', user_id: 'user-1' },
    ]);
    const subscriptions = refTableClient([]);
    const rules = refTableClient([
      { category_id: 'source-a', id: 'rule-a', user_id: 'user-1' },
    ]);
    const categories = categoriesMergeClient([]);
    installTables({
      categories: categories.client,
      expenses: expenses.client,
      subscriptions: subscriptions.client,
      item_category_rules: rules.client,
    });
    // The two categories reads (source, uncategorized) are the first from()
    // calls; the final categories delete falls through to the dispatch above.
    fromMock
      .mockReturnValueOnce(sourceQuery.client)
      .mockReturnValueOnce(uncategorizedQuery.client);

    await expect(deleteCategory('source-a')).resolves.toEqual({
      affectedExpenses: 1,
    });
    expect(expenses.update).toHaveBeenCalledWith({
      category_id: 'target',
    });
    expect(rules.update).toHaveBeenCalledWith({
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
    expect(categories.deleteIn).toHaveBeenCalledWith('id', ['source-a']);
    expect(categories.deleteEq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  test('restores moved references when deleting the source fails', async () => {
    const categories = categoriesMergeClient(
      [uncategorizedTarget, userSource],
      { deleteError: { message: 'delete failed' } },
    );
    const expenses = refTableClient([
      { category_id: 'source-a', id: 'expense-a', user_id: 'user-1' },
    ]);
    const subscriptions = refTableClient([]);
    const rules = refTableClient([
      { category_id: 'source-a', id: 'rule-a', user_id: 'user-1' },
    ]);
    installTables({
      categories: categories.client,
      expenses: expenses.client,
      subscriptions: subscriptions.client,
      item_category_rules: rules.client,
    });

    await expect(
      mergeCategories('target', ['source-a']),
    ).rejects.toEqual({ message: 'delete failed' });
    // Each reference client is re-pointed forward (to target) and then restored
    // (back to source) from the complete snapshot.
    expect(rules.update).toHaveBeenCalledWith({ category_id: 'source-a' });
    expect(rules.updateIn).toHaveBeenCalledWith('id', ['rule-a']);
    expect(expenses.update).toHaveBeenCalledWith({
      category_id: 'source-a',
    });
    expect(expenses.updateIn).toHaveBeenCalledWith('id', ['expense-a']);
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
