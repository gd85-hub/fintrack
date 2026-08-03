import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import { insertExpense, updateExpense, type ExpenseInput } from '../db';
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

const ratesMock = ratesForExpense as jest.MockedFunction<
  typeof ratesForExpense
>;
const getSessionMock = supabase.auth.getSession as unknown as jest.Mock;
const fromMock = supabase.from as unknown as jest.Mock;

const input: ExpenseInput = {
  amountCents: 12_500,
  currency: 'RSD',
  categoryId: 'groceries',
  merchantId: 'merchant-1',
  occurredOn: '2026-08-03',
  description: 'Продукты',
  note: '',
};

function recencyClient() {
  const eq = jest.fn(async () => ({ error: null }));
  const update = jest.fn(() => ({ eq }));
  return { client: { update }, eq, update };
}

describe('merchant usage recency', () => {
  beforeEach(() => {
    ratesMock.mockReset();
    getSessionMock.mockReset();
    fromMock.mockReset();
    getSessionMock.mockImplementation(async () => ({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    }));
  });

  test('bumps the selected merchant after inserting an expense', async () => {
    ratesMock.mockResolvedValue({
      date: '2026-08-03',
      usdRsd: 110,
      eurRsd: 117,
    });
    const expenseInsert = jest.fn(async () => ({ error: null }));
    const recency = recencyClient();
    fromMock
      .mockReturnValueOnce({ insert: expenseInsert })
      .mockReturnValueOnce(recency.client);

    await insertExpense(input);

    expect(recency.update).toHaveBeenCalledWith({
      updated_at: expect.any(String),
    });
    expect(recency.eq).toHaveBeenCalledWith('id', 'merchant-1');
  });

  test('bumps the selected merchant after updating an expense', async () => {
    const existingExpenseQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(async () => ({
        data: {
          original_amount: '125.00',
          original_currency: 'RSD',
          occurred_on: '2026-08-03',
        },
        error: null,
      })),
    };
    const expenseEq = jest.fn(async () => ({ error: null }));
    const expenseUpdate = jest.fn(() => ({ eq: expenseEq }));
    const recency = recencyClient();
    fromMock
      .mockReturnValueOnce(existingExpenseQuery)
      .mockReturnValueOnce({ update: expenseUpdate })
      .mockReturnValueOnce(recency.client);

    await updateExpense('expense-1', input);

    expect(ratesMock).not.toHaveBeenCalled();
    expect(recency.update).toHaveBeenCalledWith({
      updated_at: expect.any(String),
    });
    expect(recency.eq).toHaveBeenCalledWith('id', 'merchant-1');
  });

  test('changes TMT to KZT and stores only the manual RSD value', async () => {
    const existingExpenseQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(async () => ({
        data: {
          original_amount: '125.00',
          original_currency: 'TMT',
          occurred_on: '2026-08-03',
        },
        error: null,
      })),
    };
    const expenseEq = jest.fn(async () => ({ error: null }));
    const expenseUpdate = jest.fn(() => ({ eq: expenseEq }));
    const recency = recencyClient();
    fromMock
      .mockReturnValueOnce(existingExpenseQuery)
      .mockReturnValueOnce({ update: expenseUpdate })
      .mockReturnValueOnce(recency.client);

    await updateExpense('expense-1', {
      ...input,
      currency: 'KZT',
      manualRsdCents: 9_876,
    });

    expect(ratesMock).not.toHaveBeenCalled();
    expect(expenseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        original_currency: 'KZT',
        amount_rsd: '98.76',
        amount_usd: null,
        amount_eur: null,
        fx_rate_date: null,
      }),
    );
  });

  test('switches a manual expense to EUR and replaces manual values with FX', async () => {
    ratesMock.mockResolvedValue({
      date: '2026-08-03',
      usdRsd: 110,
      eurRsd: 117,
    });
    const existingExpenseQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(async () => ({
        data: {
          original_amount: '125.00',
          original_currency: 'KZT',
          occurred_on: '2026-08-03',
        },
        error: null,
      })),
    };
    const expenseEq = jest.fn(async () => ({ error: null }));
    const expenseUpdate = jest.fn(() => ({ eq: expenseEq }));
    const recency = recencyClient();
    fromMock
      .mockReturnValueOnce(existingExpenseQuery)
      .mockReturnValueOnce({ update: expenseUpdate })
      .mockReturnValueOnce(recency.client);

    await updateExpense('expense-1', {
      ...input,
      currency: 'EUR',
      manualRsdCents: null,
    });

    expect(ratesMock).toHaveBeenCalledTimes(1);
    expect(ratesMock).toHaveBeenCalledWith('2026-08-03');
    expect(expenseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        original_currency: 'EUR',
        amount_rsd: '14625.00',
        amount_usd: '132.95',
        amount_eur: '125.00',
        fx_rate_date: '2026-08-03',
      }),
    );
  });

  test('inserts an exotic-currency expense without fabricating FX', async () => {
    const expenseInsert = jest.fn(async () => ({ error: null }));
    const recency = recencyClient();
    fromMock
      .mockReturnValueOnce({ insert: expenseInsert })
      .mockReturnValueOnce(recency.client);

    await insertExpense({
      ...input,
      currency: 'KZT',
      manualRsdCents: null,
    });

    expect(ratesMock).not.toHaveBeenCalled();
    expect(expenseInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        original_currency: 'KZT',
        amount_rsd: null,
        amount_usd: null,
        amount_eur: null,
        fx_rate_date: null,
      }),
    );
  });
});
