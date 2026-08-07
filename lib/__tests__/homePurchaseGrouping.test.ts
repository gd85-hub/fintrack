import { describe, expect, jest, test } from '@jest/globals';

import {
  buildPurchaseUnits,
  purchaseCategoryHint,
  purchaseUnitsTotal,
} from '../../app/(app)/index';
import { type Expense, listExpensesByMonth } from '../db';
import {
  collapseIdenticalPurchaseItems,
  decideHomeRowPresentation,
  resolveHomeRowHeader,
} from '../homeRowPresentation';
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
    rawName: null,
    categoryId: 'groceries',
    categoryEmoji: '🛒',
    categoryName: 'Продукты',
    categorySlug: 'groceries',
    merchantId: receiptId ? 'merchant' : null,
    merchantName: receiptId ? 'Market' : null,
    merchantLabel: receiptId ? 'Market 101 Center' : null,
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
          raw_name: 'HLEB 7 ZRNA SECENI (KOM) (E)',
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
          receipt: { merchant_label: 'Market 101 Center' },
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
    expect(result[0]?.rawName).toBe('HLEB 7 ZRNA SECENI (KOM) (E)');
    expect(result[0]?.merchantLabel).toBe('Market 101 Center');
    expect(select).toHaveBeenCalledWith(
      expect.stringContaining('raw_name'),
    );
    expect(select).toHaveBeenCalledWith(
      expect.stringContaining('merchant_label'),
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

  test('collapses identical display names and unit prices without changing the total', () => {
    const firstShirt = {
      ...createExpense('shirt-1', 'receipt-a', {
        rsd: 69_900,
        usd: 600,
        eur: 550,
      }),
      description: 'Футболка',
      rawName: 'SMOG Majice - kratki rukav',
    };
    const secondShirt = {
      ...firstShirt,
      id: 'shirt-2',
      createdAt: '2026-08-01T12:00:02Z',
    };
    const socks = {
      ...createExpense('socks', 'receipt-a', {
        rsd: 49_900,
        usd: 430,
        eur: 390,
      }),
      description: 'Носки',
    };
    const expenses = [firstShirt, secondShirt, socks];

    const collapsed = collapseIdenticalPurchaseItems(expenses);

    expect(collapsed).toHaveLength(2);
    expect(collapsed[0]).toMatchObject({
      count: 2,
      displayName: 'Футболка',
      originalAmountCents: 139_800,
      unitPriceCents: 69_900,
    });
    expect(
      collapsed[0]?.expenses.map((expense) => expense.id),
    ).toEqual(['shirt-1', 'shirt-2']);
    expect(collapsed[0]?.firstExpense.rawName).toBe(
      'SMOG Majice - kratki rukav',
    );
    expect(collapsed[1]).toMatchObject({
      count: 1,
      displayName: 'Носки',
      originalAmountCents: 49_900,
    });
    expect(
      collapsed.reduce(
        (total, item) => total + item.originalAmountCents,
        0,
      ),
    ).toBe(
      expenses.reduce(
        (total, expense) => total + expense.originalAmountCents,
        0,
      ),
    );
  });

  test('uses explicit per-unit prices when quantities differ', () => {
    const collapsed = collapseIdenticalPurchaseItems([
      {
        description: 'Футболка',
        originalAmountCents: 139_800,
        originalCurrency: 'RSD',
        quantity: 2,
        unitPriceCents: 69_900,
      },
      {
        description: 'Футболка',
        originalAmountCents: 69_900,
        originalCurrency: 'RSD',
        quantity: 1,
        unitPriceCents: 69_900,
      },
    ]);

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]).toMatchObject({
      count: 2,
      originalAmountCents: 209_700,
      unitPriceCents: 69_900,
    });
  });

  test('keeps the same display name separate at a different unit price', () => {
    const collapsed = collapseIdenticalPurchaseItems([
      {
        description: 'Футболка',
        originalAmountCents: 69_900,
        originalCurrency: 'RSD',
      },
      {
        description: 'Футболка',
        originalAmountCents: 79_900,
        originalCurrency: 'RSD',
      },
    ]);

    expect(collapsed).toHaveLength(2);
  });

  test('keeps row kind by item count while making every row expandable', () => {
    expect(decideHomeRowPresentation(2)).toEqual({
      expandable: true,
      kind: 'purchase',
    });
    expect(decideHomeRowPresentation(1)).toEqual({
      expandable: true,
      kind: 'expense',
    });

    const [receiptUnit, manualUnit] = buildPurchaseUnits([
      createExpense('receipt-item', 'receipt-a', {
        rsd: 1_000,
        usd: 10,
        eur: 9,
      }),
      createExpense('manual-item', null, {
        rsd: 500,
        usd: 5,
        eur: 4,
      }),
    ]);
    expect(
      decideHomeRowPresentation(receiptUnit?.expenses.length ?? 0),
    ).toEqual({ expandable: true, kind: 'expense' });
    expect(
      decideHomeRowPresentation(manualUnit?.expenses.length ?? 0),
    ).toEqual({ expandable: true, kind: 'expense' });
  });

  test('uses the merchant brand as the header and falls back to description', () => {
    const withMerchant = {
      ...createExpense('mince', null, {
        rsd: 1_000,
        usd: 10,
        eur: 9,
      }),
      description: 'Фарш',
      merchantName: 'IDEA',
    };
    const withoutMerchant = {
      ...createExpense('rent', null, {
        rsd: 50_000,
        usd: 450,
        eur: 420,
      }),
      description: 'Аренда квартиры',
      merchantName: null,
    };

    expect(resolveHomeRowHeader([withMerchant])).toBe('IDEA');
    expect(resolveHomeRowHeader([withoutMerchant])).toBe(
      'Аренда квартиры',
    );
  });

  test('uses only the emoji for a single category hint', () => {
    const expense = createExpense('single-category', null, {
      rsd: 1_000,
      usd: 10,
      eur: 9,
    });

    expect(purchaseCategoryHint([expense])).toBe('🛒');
  });

  test('shows at most three unique category emojis without words', () => {
    const expenses = ['🛒', '☕', '🍞', '🚕'].map((emoji, index) => ({
      ...createExpense(`category-${index}`, 'receipt-a', {
        rsd: 1_000,
        usd: 10,
        eur: 9,
      }),
      categoryId: `category-${index}`,
      categoryEmoji: emoji,
      categoryName: `Категория ${index}`,
    }));

    expect(purchaseCategoryHint(expenses)).toBe('🛒 ☕ 🍞');
    expect(purchaseCategoryHint(expenses)).not.toContain('Категория');
  });

  test('deduplicates emojis shared by different categories', () => {
    const expenses = ['🛒', '🛒', '☕'].map((emoji, index) => ({
      ...createExpense(`duplicate-${index}`, 'receipt-a', {
        rsd: 1_000,
        usd: 10,
        eur: 9,
      }),
      categoryId: `duplicate-${index}`,
      categoryEmoji: emoji,
    }));

    expect(purchaseCategoryHint(expenses)).toBe('🛒 ☕');
  });

  test('returns an empty category hint when every emoji is blank', () => {
    const expenses = ['', '   '].map((emoji, index) => ({
      ...createExpense(`empty-${index}`, 'receipt-a', {
        rsd: 1_000,
        usd: 10,
        eur: 9,
      }),
      categoryId: `empty-${index}`,
      categoryEmoji: emoji,
    }));

    expect(purchaseCategoryHint(expenses)).toBe('');
  });
});
