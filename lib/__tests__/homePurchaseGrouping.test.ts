import { describe, expect, jest, test } from '@jest/globals';

import {
  buildPurchaseUnits,
  purchaseUnitsTotal,
} from '../../app/(app)/index';
import { type Expense, listExpensesByMonth } from '../db';
import type { Currency } from '../money';
import { supabase } from '../supabase';

jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../contexts/DisplayCurrencyContext', () => ({
  useDisplayCurrency: jest.fn(),
}));

jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

function createExpense(
  id: string,
  receiptId: string | null,
  amounts: { eur: number; rsd: number; usd: number },
): Expense {
  return {
    id,
    receiptId,
    occurredOn: '2026-08-01',
    description: id,
    categoryId: 'groceries',
    categoryEmoji: '🛒',
    categoryName: 'Продукты',
    categorySlug: 'groceries',
    merchantId: receiptId ? 'merchant' : null,
    merchantName: receiptId ? 'Market' : null,
    originalAmountCents: amounts.rsd,
    originalCurrency: 'RSD',
    amountRsdCents: amounts.rsd,
    amountUsdCents: amounts.usd,
    amountEurCents: amounts.eur,
    fxRateDate: '2026-08-01',
    note: '',
    createdAt: `2026-08-01T12:00:0${id.length}Z`,
  };
}

describe('Home purchase grouping', () => {
  test('maps receipt_id from the ordered Home expense query', async () => {
    const secondOrder = jest.fn<
      () => Promise<{ data: unknown[]; error: null }>
    >();
    secondOrder.mockResolvedValue({
      data: [
        {
          id: 'receipt-line',
          receipt_id: 'receipt-a',
          occurred_on: '2026-08-01',
          description: 'Хлеб',
          category_id: 'groceries',
          merchant_id: 'merchant',
          original_amount: '100.00',
          original_currency: 'RSD',
          amount_rsd: '100.00',
          amount_usd: '1.00',
          amount_eur: '0.90',
          fx_rate_date: '2026-08-01',
          note: null,
          created_at: '2026-08-01T12:00:00Z',
          category: {
            emoji: '🛒',
            name: 'Продукты',
            slug: 'groceries',
          },
          merchant: { name: 'Market' },
        },
      ],
      error: null,
    });
    const firstOrder = jest.fn(() => ({ order: secondOrder }));
    const lte = jest.fn(() => ({ order: firstOrder }));
    const gte = jest.fn(() => ({ lte }));
    const select = jest.fn(() => ({ gte }));
    jest.mocked(supabase.from).mockReturnValue({
      select,
    } as unknown as ReturnType<typeof supabase.from>);

    const result = await listExpensesByMonth('2026-08');

    expect(result[0]?.receiptId).toBe('receipt-a');
    expect(select).toHaveBeenCalledWith(
      expect.stringContaining('receipt_id'),
    );
  });

  test('groups receipt lines at their first position and keeps manual expenses separate', () => {
    const expenses = [
      createExpense('receipt-a-1', 'receipt-a', {
        rsd: 1_000,
        usd: 10,
        eur: 9,
      }),
      createExpense('manual', null, { rsd: 500, usd: 5, eur: 4 }),
      createExpense('receipt-a-2', 'receipt-a', {
        rsd: 2_000,
        usd: 20,
        eur: 18,
      }),
      createExpense('receipt-b-1', 'receipt-b', {
        rsd: 3_000,
        usd: 30,
        eur: 27,
      }),
    ];

    const units = buildPurchaseUnits(expenses);

    expect(units.map((unit) => unit.key)).toEqual([
      'receipt:receipt-a',
      'expense:manual',
      'receipt:receipt-b',
    ]);
    expect(units[0]?.expenses.map((expense) => expense.id)).toEqual([
      'receipt-a-1',
      'receipt-a-2',
    ]);
    expect(units[1]?.expenses).toHaveLength(1);
  });

  test.each<Currency>(['RSD', 'USD', 'EUR'])(
    'purchase-unit totals equal the old flat day subtotal in %s',
    (currency) => {
      const expenses = [
        createExpense('receipt-a-1', 'receipt-a', {
          rsd: 1_000,
          usd: 10,
          eur: 9,
        }),
        createExpense('receipt-a-2', 'receipt-a', {
          rsd: 2_000,
          usd: 20,
          eur: 18,
        }),
        createExpense('manual', null, {
          rsd: 500,
          usd: 5,
          eur: 4,
        }),
      ];
      const oldDaySubtotal = expenses.reduce((sum, expense) => {
        if (currency === 'USD') {
          return sum + expense.amountUsdCents;
        }
        if (currency === 'EUR') {
          return sum + expense.amountEurCents;
        }
        return sum + expense.amountRsdCents;
      }, 0);

      expect(
        purchaseUnitsTotal(buildPurchaseUnits(expenses), currency),
      ).toBe(oldDaySubtotal);
    },
  );
});
