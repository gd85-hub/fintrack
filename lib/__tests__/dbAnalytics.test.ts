import {
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

import { categoryBreakdownByMonth } from '../db';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const fromMock = jest.mocked(supabase.from);

describe('categoryBreakdownByMonth', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  test('groups stored currency amounts and returns month totals in cents', async () => {
    const lte = jest.fn<
      (
        column: string,
        value: string,
      ) => Promise<{
        data: {
          category_id: string;
          amount_rsd: string;
          amount_usd: string;
          amount_eur: string;
          category: {
            emoji: string;
            name: string;
            group: string;
          };
        }[];
        error: null;
      }>
    >();
    lte.mockResolvedValue({
      data: [
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
      ],
      error: null,
    });
    const gte = jest.fn(() => ({ lte }));
    const select = jest.fn(() => ({ gte }));
    fromMock.mockReturnValue({
      select,
    } as unknown as ReturnType<typeof supabase.from>);

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
    expect(gte).toHaveBeenCalledWith('occurred_on', '2026-07-01');
    expect(lte).toHaveBeenCalledWith('occurred_on', '2026-07-31');
  });
});
