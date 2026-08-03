import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import {
  buildFiscalReceiptEditDraft,
  type Expense,
  updateFiscalReceipt,
} from '../db';
import { ratesForExpense } from '../fx';
import { supabase } from '../supabase';

jest.mock('../fx', () => ({
  ratesForExpense: jest.fn(),
}));

jest.mock('../supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

const getSessionMock = supabase.auth.getSession as unknown as jest.Mock;
const fromMock = supabase.from as unknown as jest.Mock;
const ratesMock = ratesForExpense as jest.MockedFunction<
  typeof ratesForExpense
>;

const receiptSnapshot = {
  id: 'receipt-1',
  user_id: 'user-1',
  source: 'fiscal_qr',
  merchant_id: 'merchant-old',
  merchant_label: 'OLD MARKET 101 CENTER',
  tax_id: '123456789',
  occurred_at: '2026-08-01T12:34:00+02:00',
  total: '300.00',
  currency: 'RSD',
  payment_type: 'Карточка',
  raw_json: { merchantName: 'OLD MARKET' },
  parsed_ok: true,
  created_at: '2026-08-01T12:35:00Z',
};

const expenseSnapshots = [
  {
    id: 'expense-1',
    user_id: 'user-1',
    occurred_on: '2026-08-01',
    occurred_at: '2026-08-01T12:34:00+02:00',
    description: 'Хлеб',
    raw_name: 'HLEB',
    category_id: 'groceries',
    merchant_id: 'merchant-old',
    original_amount: '100.00',
    original_currency: 'RSD',
    amount_rsd: '100.00',
    amount_usd: '0.91',
    amount_eur: '0.85',
    fx_rate_date: '2026-08-01',
    note: null,
    source: 'fiscal_qr',
    receipt_id: 'receipt-1',
    is_recurring: false,
    created_at: '2026-08-01T12:35:01Z',
    updated_at: '2026-08-01T12:35:01Z',
  },
  {
    id: 'expense-2',
    user_id: 'user-1',
    occurred_on: '2026-08-01',
    occurred_at: '2026-08-01T12:34:00+02:00',
    description: 'Молоко',
    raw_name: 'MLEKO',
    category_id: 'groceries',
    merchant_id: 'merchant-old',
    original_amount: '200.00',
    original_currency: 'RSD',
    amount_rsd: '200.00',
    amount_usd: '1.82',
    amount_eur: '1.71',
    fx_rate_date: '2026-08-01',
    note: null,
    source: 'fiscal_qr',
    receipt_id: 'receipt-1',
    is_recurring: false,
    created_at: '2026-08-01T12:35:02Z',
    updated_at: '2026-08-01T12:35:02Z',
  },
];

function expense(
  id: string,
  description: string,
  rawName: string,
  amountCents: number,
): Expense {
  return {
    id,
    receiptId: 'receipt-1',
    occurredOn: '2026-08-01',
    description,
    rawName,
    categoryId: 'groceries',
    categoryEmoji: '🛒',
    categoryName: 'Продукты',
    categorySlug: 'groceries',
    merchantId: 'merchant-old',
    merchantName: 'Old Market',
    merchantLabel: 'OLD MARKET 101 CENTER',
    originalAmountCents: amountCents,
    originalCurrency: 'RSD',
    amountRsdCents: amountCents,
    amountUsdCents: 0,
    amountEurCents: 0,
    fxRateDate: '2026-08-01',
    note: '',
    createdAt: '2026-08-01T12:35:00Z',
  };
}

function singleResultClient(data: unknown, method: 'maybeSingle' | 'single') {
  const result = jest.fn(async () => ({ data, error: null }));
  const eq = jest.fn(() => ({ [method]: result }));
  const select = jest.fn(() => ({ eq }));
  return {
    client: { select } as unknown as ReturnType<typeof supabase.from>,
    result,
  };
}

function listResultClient(data: unknown[]) {
  const order = jest.fn(async () => ({ data, error: null }));
  const eq = jest.fn(() => ({ order }));
  const select = jest.fn(() => ({ eq }));
  return {
    client: { select } as unknown as ReturnType<typeof supabase.from>,
  };
}

function twoFilterMutationClient(
  method: 'delete' | 'update',
  error: { message: string } | null = null,
) {
  const finalEq = jest.fn(async () => ({ error }));
  const firstEq = jest.fn(() => ({ eq: finalEq }));
  const mutation = jest.fn(() => ({ eq: firstEq }));
  return {
    client: { [method]: mutation } as unknown as ReturnType<
      typeof supabase.from
    >,
    finalEq,
    firstEq,
    mutation,
  };
}

function oneFilterDeleteClient() {
  const eq = jest.fn(async () => ({ error: null }));
  const deleteRows = jest.fn(() => ({ eq }));
  return {
    client: { delete: deleteRows } as unknown as ReturnType<
      typeof supabase.from
    >,
    deleteRows,
    eq,
  };
}

function upsertClient() {
  const upsert = jest.fn(async () => ({ error: null }));
  return {
    client: { upsert } as unknown as ReturnType<typeof supabase.from>,
    upsert,
  };
}

function oneFilterUpdateClient() {
  const eq = jest.fn(async () => ({ error: null }));
  const update = jest.fn(() => ({ eq }));
  return {
    client: { update } as unknown as ReturnType<typeof supabase.from>,
    eq,
    update,
  };
}

describe('saved receipt edit draft', () => {
  test('round-trips the saved merchant, date, and editable items', () => {
    const draft = buildFiscalReceiptEditDraft(
      {
        id: 'receipt-1',
        merchantId: 'merchant-old',
        merchantName: 'Old Market',
        merchantLabel: 'OLD MARKET 101 CENTER',
        merchantTypeId: 'shop',
        totalCents: 30_000,
        currency: 'RSD',
        paymentType: 'Карточка',
      },
      [
        expense('expense-1', 'Хлеб', 'HLEB', 10_000),
        expense('expense-2', 'Молоко', 'MLEKO', 20_000),
      ],
    );

    expect(draft).toEqual({
      receiptId: 'receipt-1',
      merchantId: 'merchant-old',
      merchantName: 'Old Market',
      merchantLabel: 'OLD MARKET 101 CENTER',
      merchantTypeId: 'shop',
      occurredOn: '2026-08-01',
      totalCents: 30_000,
      currency: 'RSD',
      paymentType: 'Карточка',
      items: [
        {
          id: 'expense-1',
          amountCents: 10_000,
          categoryId: 'groceries',
          description: 'Хлеб',
          rawName: 'HLEB',
        },
        {
          id: 'expense-2',
          amountCents: 20_000,
          categoryId: 'groceries',
          description: 'Молоко',
          rawName: 'MLEKO',
        },
      ],
    });
  });
});

describe('updateFiscalReceipt', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    fromMock.mockReset();
    ratesMock.mockReset();
    getSessionMock.mockImplementation(async () => ({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    }));
  });

  test('updates every merchant/date field and resolves FX only once', async () => {
    ratesMock.mockResolvedValue({
      date: '2026-08-03',
      usdRsd: 110,
      eurRsd: 117,
    });
    const receiptQuery = singleResultClient(
      receiptSnapshot,
      'maybeSingle',
    );
    const expensesQuery = listResultClient(expenseSnapshots);
    const merchantQuery = singleResultClient(
      { name: 'New Market', aliases: [] },
      'single',
    );
    const firstExpenseUpdate = twoFilterMutationClient('update');
    const secondExpenseUpdate = twoFilterMutationClient('update');
    const receiptUpdate = oneFilterUpdateClient();
    const aliasUpdate = oneFilterUpdateClient();

    fromMock
      .mockReturnValueOnce(receiptQuery.client)
      .mockReturnValueOnce(expensesQuery.client)
      .mockReturnValueOnce(merchantQuery.client)
      .mockReturnValueOnce(firstExpenseUpdate.client)
      .mockReturnValueOnce(secondExpenseUpdate.client)
      .mockReturnValueOnce(receiptUpdate.client)
      .mockReturnValueOnce(aliasUpdate.client);

    await expect(
      updateFiscalReceipt('receipt-1', {
        merchant: { existingId: 'merchant-new' },
        merchantLabel: 'OLD MARKET 101 CENTER',
        occurredOn: '2026-08-03',
        expenses: [
          {
            id: 'expense-1',
            amountCents: 10_000,
            categoryId: 'groceries',
            description: 'Хлеб',
            rawName: 'HLEB',
            included: true,
          },
          {
            id: 'expense-2',
            amountCents: 20_000,
            categoryId: 'groceries',
            description: 'Молоко',
            rawName: 'MLEKO',
            included: true,
          },
        ],
      }),
    ).resolves.toEqual({ deleted: false });

    expect(ratesMock).toHaveBeenCalledTimes(1);
    expect(ratesMock).toHaveBeenCalledWith('2026-08-03');
    expect(firstExpenseUpdate.mutation).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: 'merchant-new',
        occurred_on: '2026-08-03',
        occurred_at: '2026-08-03T12:34:00+02:00',
        amount_rsd: '100.00',
        amount_usd: '0.91',
        amount_eur: '0.85',
        fx_rate_date: '2026-08-03',
      }),
    );
    expect(secondExpenseUpdate.mutation).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: 'merchant-new',
        occurred_on: '2026-08-03',
        amount_rsd: '200.00',
        amount_usd: '1.82',
        amount_eur: '1.71',
        fx_rate_date: '2026-08-03',
      }),
    );
    expect(receiptUpdate.update).toHaveBeenCalledWith({
      merchant_id: 'merchant-new',
      merchant_label: 'OLD MARKET 101 CENTER',
      occurred_at: '2026-08-03T12:34:00+02:00',
      total: '300.00',
    });
    expect(aliasUpdate.update).toHaveBeenCalledWith({
      aliases: ['OLD MARKET'],
    });
  });

  test('deletes an excluded item, lowers the total, and preserves FX', async () => {
    const receiptQuery = singleResultClient(
      receiptSnapshot,
      'maybeSingle',
    );
    const expensesQuery = listResultClient(expenseSnapshots);
    const merchantQuery = singleResultClient(
      { name: 'Old Market', aliases: [] },
      'single',
    );
    const keptExpenseUpdate = twoFilterMutationClient('update');
    const excludedExpenseDelete = twoFilterMutationClient('delete');
    const receiptUpdate = oneFilterUpdateClient();

    fromMock
      .mockReturnValueOnce(receiptQuery.client)
      .mockReturnValueOnce(expensesQuery.client)
      .mockReturnValueOnce(merchantQuery.client)
      .mockReturnValueOnce(keptExpenseUpdate.client)
      .mockReturnValueOnce(excludedExpenseDelete.client)
      .mockReturnValueOnce(receiptUpdate.client);

    await expect(
      updateFiscalReceipt('receipt-1', {
        merchant: { existingId: 'merchant-old' },
        merchantLabel: 'OLD MARKET 101 CENTER',
        occurredOn: '2026-08-01',
        expenses: [
          {
            id: 'expense-1',
            amountCents: 10_000,
            categoryId: 'groceries',
            description: 'Хлеб',
            rawName: 'HLEB',
            included: true,
          },
          {
            id: 'expense-2',
            amountCents: 20_000,
            categoryId: 'groceries',
            description: 'Молоко',
            rawName: 'MLEKO',
            included: false,
          },
        ],
      }),
    ).resolves.toEqual({ deleted: false });

    expect(ratesMock).not.toHaveBeenCalled();
    const keptPayload = (
      keptExpenseUpdate.mutation as unknown as jest.Mock
    ).mock.calls[0]?.[0];
    expect(keptPayload).toEqual(
      expect.objectContaining({
        merchant_id: 'merchant-old',
        occurred_on: '2026-08-01',
        original_amount: '100.00',
      }),
    );
    expect(keptPayload).not.toHaveProperty('amount_rsd');
    expect(excludedExpenseDelete.firstEq).toHaveBeenCalledWith(
      'id',
      'expense-2',
    );
    expect(excludedExpenseDelete.finalEq).toHaveBeenCalledWith(
      'receipt_id',
      'receipt-1',
    );
    expect(receiptUpdate.update).toHaveBeenCalledWith({
      merchant_id: 'merchant-old',
      merchant_label: 'OLD MARKET 101 CENTER',
      total: '100.00',
    });
  });

  test('recomputes only an amount-edited row with one shared FX lookup', async () => {
    ratesMock.mockResolvedValue({
      date: '2026-08-01',
      usdRsd: 110,
      eurRsd: 117,
    });
    const receiptQuery = singleResultClient(
      receiptSnapshot,
      'maybeSingle',
    );
    const expensesQuery = listResultClient(expenseSnapshots);
    const merchantQuery = singleResultClient(
      { name: 'Old Market', aliases: [] },
      'single',
    );
    const changedExpenseUpdate = twoFilterMutationClient('update');
    const unchangedExpenseUpdate = twoFilterMutationClient('update');
    const receiptUpdate = oneFilterUpdateClient();

    fromMock
      .mockReturnValueOnce(receiptQuery.client)
      .mockReturnValueOnce(expensesQuery.client)
      .mockReturnValueOnce(merchantQuery.client)
      .mockReturnValueOnce(changedExpenseUpdate.client)
      .mockReturnValueOnce(unchangedExpenseUpdate.client)
      .mockReturnValueOnce(receiptUpdate.client);

    await updateFiscalReceipt('receipt-1', {
      merchant: { existingId: 'merchant-old' },
      merchantLabel: 'OLD MARKET 101 CENTER',
      occurredOn: '2026-08-01',
      expenses: [
        {
          id: 'expense-1',
          amountCents: 15_000,
          categoryId: 'groceries',
          description: 'Хлеб',
          rawName: 'HLEB',
          included: true,
        },
        {
          id: 'expense-2',
          amountCents: 20_000,
          categoryId: 'groceries',
          description: 'Молоко',
          rawName: 'MLEKO',
          included: true,
        },
      ],
    });

    expect(ratesMock).toHaveBeenCalledTimes(1);
    expect(changedExpenseUpdate.mutation).toHaveBeenCalledWith(
      expect.objectContaining({
        original_amount: '150.00',
        amount_rsd: '150.00',
        amount_usd: '1.36',
        amount_eur: '1.28',
        fx_rate_date: '2026-08-01',
      }),
    );
    const unchangedPayload = (
      unchangedExpenseUpdate.mutation as unknown as jest.Mock
    ).mock.calls[0]?.[0];
    expect(unchangedPayload).not.toHaveProperty('amount_rsd');
    expect(receiptUpdate.update).toHaveBeenCalledWith({
      merchant_id: 'merchant-old',
      merchant_label: 'OLD MARKET 101 CENTER',
      total: '350.00',
    });
  });

  test('deletes the receipt when every item is excluded', async () => {
    const receiptQuery = singleResultClient(
      receiptSnapshot,
      'maybeSingle',
    );
    const expensesQuery = listResultClient(expenseSnapshots);
    const expensesDelete = oneFilterDeleteClient();
    const receiptDelete = oneFilterDeleteClient();

    fromMock
      .mockReturnValueOnce(receiptQuery.client)
      .mockReturnValueOnce(expensesQuery.client)
      .mockReturnValueOnce(expensesDelete.client)
      .mockReturnValueOnce(receiptDelete.client);

    await expect(
      updateFiscalReceipt('receipt-1', {
        merchant: null,
        merchantLabel: 'OLD MARKET 101 CENTER',
        occurredOn: '2026-08-01',
        expenses: expenseSnapshots.map((item) => ({
          id: item.id,
          amountCents: null,
          categoryId: item.category_id,
          description: item.description,
          rawName: item.raw_name,
          included: false,
        })),
      }),
    ).resolves.toEqual({ deleted: true });

    expect(expensesDelete.eq).toHaveBeenCalledWith(
      'receipt_id',
      'receipt-1',
    );
    expect(receiptDelete.eq).toHaveBeenCalledWith('id', 'receipt-1');
    expect(ratesMock).not.toHaveBeenCalled();
  });

  test('restores the original rows when a later update fails', async () => {
    const receiptQuery = singleResultClient(
      receiptSnapshot,
      'maybeSingle',
    );
    const expensesQuery = listResultClient(expenseSnapshots);
    const merchantQuery = singleResultClient(
      { name: 'Old Market', aliases: [] },
      'single',
    );
    const firstExpenseUpdate = twoFilterMutationClient('update');
    const failedExpenseUpdate = twoFilterMutationClient('update', {
      message: 'write failed',
    });
    const receiptRestore = upsertClient();
    const expensesRestore = upsertClient();

    fromMock
      .mockReturnValueOnce(receiptQuery.client)
      .mockReturnValueOnce(expensesQuery.client)
      .mockReturnValueOnce(merchantQuery.client)
      .mockReturnValueOnce(firstExpenseUpdate.client)
      .mockReturnValueOnce(failedExpenseUpdate.client)
      .mockReturnValueOnce(receiptRestore.client)
      .mockReturnValueOnce(expensesRestore.client);

    await expect(
      updateFiscalReceipt('receipt-1', {
        merchant: { existingId: 'merchant-old' },
        merchantLabel: 'OLD MARKET 101 CENTER',
        occurredOn: '2026-08-01',
        expenses: expenseSnapshots.map((item) => ({
          id: item.id,
          amountCents: Number(item.original_amount) * 100,
          categoryId: item.category_id,
          description: item.description,
          rawName: item.raw_name,
          included: true,
        })),
      }),
    ).rejects.toEqual({ message: 'write failed' });

    expect(receiptRestore.upsert).toHaveBeenCalledWith(receiptSnapshot);
    expect(expensesRestore.upsert).toHaveBeenCalledWith(
      expenseSnapshots,
    );
  });
});
