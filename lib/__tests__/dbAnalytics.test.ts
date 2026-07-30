import {
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

import {
  type AnalyticsExpense,
  buildFixedVariableBreakdown,
  categoryBreakdownByMonth,
  listExpensesForAnalytics,
  merchantBreakdownByMonth,
} from '../db';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const fromMock = jest.mocked(supabase.from);

function mockMonthQuery(data: unknown[]) {
  const lte = jest.fn<
    (
      column: string,
      value: string,
    ) => Promise<{ data: unknown[]; error: null }>
  >();
  lte.mockResolvedValue({ data, error: null });
  const gte = jest.fn(() => ({ lte }));
  const select = jest.fn(() => ({ gte }));

  return {
    client: {
      select,
    } as unknown as ReturnType<typeof supabase.from>,
    gte,
    lte,
  };
}

describe('categoryBreakdownByMonth', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  test('groups stored currency amounts and returns month totals in cents', async () => {
    const query = mockMonthQuery([
      {
        category_id: 'food',
        amount_rsd: '100.10',
        amount_usd: '1.00',
        amount_eur: '0.90',
        category: {
          emoji: '🛒',
          name: 'Продукты',
          group: 'Еда',
        },
      },
      {
        category_id: 'food',
        amount_rsd: '49.90',
        amount_usd: '0.50',
        amount_eur: '0.40',
        category: {
          emoji: '🛒',
          name: 'Продукты',
          group: 'Еда',
        },
      },
      {
        category_id: 'transport',
        amount_rsd: '50.00',
        amount_usd: '0.45',
        amount_eur: '0.42',
        category: {
          emoji: '🚌',
          name: 'Транспорт',
          group: 'Транспорт',
        },
      },
    ]);
    fromMock.mockReturnValue(query.client);

    await expect(categoryBreakdownByMonth('2026-07')).resolves.toEqual({
      categories: [
        {
          categoryId: 'food',
          emoji: '🛒',
          name: 'Продукты',
          group: 'Еда',
          totalRsd: 15000,
          totalUsd: 150,
          totalEur: 130,
          count: 2,
        },
        {
          categoryId: 'transport',
          emoji: '🚌',
          name: 'Транспорт',
          group: 'Транспорт',
          totalRsd: 5000,
          totalUsd: 45,
          totalEur: 42,
          count: 1,
        },
      ],
      totalRsd: 20000,
      totalUsd: 195,
      totalEur: 172,
    });
    expect(fromMock).toHaveBeenCalledWith('expenses');
    expect(query.gte).toHaveBeenCalledWith('occurred_on', '2026-07-01');
    expect(query.lte).toHaveBeenCalledWith('occurred_on', '2026-07-31');
  });
});

describe('merchantBreakdownByMonth', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  test('groups places, keeps unknown expenses, and matches category totals', async () => {
    const categoryQuery = mockMonthQuery([
      {
        category_id: 'food',
        amount_rsd: '100.10',
        amount_usd: '1.00',
        amount_eur: '0.90',
        category: {
          emoji: '🛒',
          name: 'Продукты',
          group: 'Еда',
        },
      },
      {
        category_id: 'food',
        amount_rsd: '49.90',
        amount_usd: '0.50',
        amount_eur: '0.40',
        category: {
          emoji: '🛒',
          name: 'Продукты',
          group: 'Еда',
        },
      },
      {
        category_id: 'transport',
        amount_rsd: '50.00',
        amount_usd: '0.45',
        amount_eur: '0.42',
        category: {
          emoji: '🚌',
          name: 'Транспорт',
          group: 'Транспорт',
        },
      },
    ]);
    const merchantQuery = mockMonthQuery([
      {
        merchant_id: 'maxi',
        amount_rsd: '100.10',
        amount_usd: '1.00',
        amount_eur: '0.90',
        merchant: {
          name: 'Maxi',
          type_id: 'shop',
          type: {
            emoji: '🛒',
            name: 'Магазин',
            sort: 10,
          },
        },
      },
      {
        merchant_id: 'lidl',
        amount_rsd: '49.90',
        amount_usd: '0.50',
        amount_eur: '0.40',
        merchant: {
          name: 'Lidl',
          type_id: 'shop',
          type: {
            emoji: '🛒',
            name: 'Магазин',
            sort: 10,
          },
        },
      },
      {
        merchant_id: null,
        amount_rsd: '50.00',
        amount_usd: '0.45',
        amount_eur: '0.42',
        merchant: null,
      },
    ]);
    fromMock
      .mockReturnValueOnce(categoryQuery.client)
      .mockReturnValueOnce(merchantQuery.client);

    const categoryResult = await categoryBreakdownByMonth('2026-07');
    const merchantResult = await merchantBreakdownByMonth('2026-07');

    expect(merchantResult).toEqual({
      types: [
        {
          typeId: 'shop',
          emoji: '🛒',
          typeName: 'Магазин',
          totalRsd: 15000,
          totalUsd: 150,
          totalEur: 130,
          count: 2,
          merchants: [
            {
              merchantId: 'maxi',
              name: 'Maxi',
              totalRsd: 10010,
              totalUsd: 100,
              totalEur: 90,
              count: 1,
            },
            {
              merchantId: 'lidl',
              name: 'Lidl',
              totalRsd: 4990,
              totalUsd: 50,
              totalEur: 40,
              count: 1,
            },
          ],
        },
        {
          typeId: null,
          emoji: '📍',
          typeName: 'Место не определено',
          totalRsd: 5000,
          totalUsd: 45,
          totalEur: 42,
          count: 1,
          merchants: [
            {
              merchantId: null,
              name: 'Без места',
              totalRsd: 5000,
              totalUsd: 45,
              totalEur: 42,
              count: 1,
            },
          ],
        },
      ],
      totalRsd: 20000,
      totalUsd: 195,
      totalEur: 172,
    });
    expect({
      totalRsd: merchantResult.totalRsd,
      totalUsd: merchantResult.totalUsd,
      totalEur: merchantResult.totalEur,
    }).toEqual({
      totalRsd: categoryResult.totalRsd,
      totalUsd: categoryResult.totalUsd,
      totalEur: categoryResult.totalEur,
    });
    expect(merchantQuery.gte).toHaveBeenCalledWith(
      'occurred_on',
      '2026-07-01',
    );
    expect(merchantQuery.lte).toHaveBeenCalledWith(
      'occurred_on',
      '2026-07-31',
    );
  });
});

describe('listExpensesForAnalytics', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  test('maps one ordered month query to stored currency cents', async () => {
    const secondOrder = jest.fn<
      (
        column: string,
        options: { ascending: boolean },
      ) => Promise<{ data: unknown[]; error: null }>
    >();
    secondOrder.mockResolvedValue({
      data: [
        {
          id: 'expense-1',
          occurred_on: '2026-07-29',
          created_at: '2026-07-29T15:45:00Z',
          description: '',
          category_id: 'food',
          merchant_id: 'maxi',
          amount_rsd: '100.10',
          amount_usd: '1.00',
          amount_eur: '0.90',
          category: {
            emoji: '🛒',
            name: 'Продукты',
            type: 'variable',
          },
          merchant: { name: 'Maxi' },
        },
      ],
      error: null,
    });
    const firstOrder = jest.fn(() => ({ order: secondOrder }));
    const lte = jest.fn(() => ({ order: firstOrder }));
    const gte = jest.fn(() => ({ lte }));
    const select = jest.fn(() => ({ gte }));
    fromMock.mockReturnValue({
      select,
    } as unknown as ReturnType<typeof supabase.from>);

    await expect(listExpensesForAnalytics('2026-07')).resolves.toEqual([
      {
        id: 'expense-1',
        occurredOn: '2026-07-29',
        createdAt: '2026-07-29T15:45:00Z',
        description: '',
        categoryId: 'food',
        categoryEmoji: '🛒',
        categoryName: 'Продукты',
        categoryType: 'variable',
        merchantId: 'maxi',
        merchantName: 'Maxi',
        amountRsd: 10010,
        amountUsd: 100,
        amountEur: 90,
      },
    ]);
    expect(firstOrder).toHaveBeenCalledWith('occurred_on', {
      ascending: false,
    });
    expect(secondOrder).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
  });
});

describe('buildFixedVariableBreakdown', () => {
  test('groups categories and preserves the month totals in every currency', () => {
    const expenses: AnalyticsExpense[] = [
      {
        id: 'rent',
        occurredOn: '2026-07-01',
        createdAt: '2026-07-01T08:00:00Z',
        description: 'Аренда',
        categoryId: 'rent',
        categoryEmoji: '🏠',
        categoryName: 'Аренда',
        categoryType: 'fixed',
        merchantId: null,
        merchantName: null,
        amountRsd: 7000000,
        amountUsd: 63636,
        amountEur: 59701,
      },
      {
        id: 'groceries-1',
        occurredOn: '2026-07-03',
        createdAt: '2026-07-03T18:00:00Z',
        description: 'Продукты',
        categoryId: 'groceries',
        categoryEmoji: '🛒',
        categoryName: 'Продукты',
        categoryType: 'variable',
        merchantId: 'maxi',
        merchantName: 'Maxi',
        amountRsd: 50000,
        amountUsd: 455,
        amountEur: 426,
      },
      {
        id: 'groceries-2',
        occurredOn: '2026-07-10',
        createdAt: '2026-07-10T18:00:00Z',
        description: 'Продукты',
        categoryId: 'groceries',
        categoryEmoji: '🛒',
        categoryName: 'Продукты',
        categoryType: 'variable',
        merchantId: 'maxi',
        merchantName: 'Maxi',
        amountRsd: 75000,
        amountUsd: 682,
        amountEur: 639,
      },
    ];

    const result = buildFixedVariableBreakdown(expenses);
    const bucketTotals = result.buckets.reduce(
      (totals, bucket) => ({
        totalRsd: totals.totalRsd + bucket.totalRsd,
        totalUsd: totals.totalUsd + bucket.totalUsd,
        totalEur: totals.totalEur + bucket.totalEur,
      }),
      { totalRsd: 0, totalUsd: 0, totalEur: 0 },
    );
    const expenseTotals = expenses.reduce(
      (totals, expense) => ({
        totalRsd: totals.totalRsd + expense.amountRsd,
        totalUsd: totals.totalUsd + expense.amountUsd,
        totalEur: totals.totalEur + expense.amountEur,
      }),
      { totalRsd: 0, totalUsd: 0, totalEur: 0 },
    );

    expect(bucketTotals).toEqual(expenseTotals);
    expect({
      totalRsd: result.totalRsd,
      totalUsd: result.totalUsd,
      totalEur: result.totalEur,
    }).toEqual(expenseTotals);
    expect(result.buckets).toEqual([
      {
        type: 'fixed',
        categories: [
          {
            categoryId: 'rent',
            emoji: '🏠',
            name: 'Аренда',
            totalRsd: 7000000,
            totalUsd: 63636,
            totalEur: 59701,
            count: 1,
          },
        ],
        totalRsd: 7000000,
        totalUsd: 63636,
        totalEur: 59701,
        count: 1,
      },
      {
        type: 'variable',
        categories: [
          {
            categoryId: 'groceries',
            emoji: '🛒',
            name: 'Продукты',
            totalRsd: 125000,
            totalUsd: 1137,
            totalEur: 1065,
            count: 2,
          },
        ],
        totalRsd: 125000,
        totalUsd: 1137,
        totalEur: 1065,
        count: 2,
      },
    ]);
  });
});
