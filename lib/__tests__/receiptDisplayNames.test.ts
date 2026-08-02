import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import { saveFiscalReceipt } from '../db';
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

describe('receipt display-name persistence', () => {
  beforeEach(() => {
    ratesMock.mockReset();
    getSessionMock.mockReset();
    fromMock.mockReset();
  });

  test('stores the human description and raw receipt name together', async () => {
    getSessionMock.mockImplementation(async () => ({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    }));
    ratesMock.mockResolvedValue({
      date: '2026-08-02',
      usdRsd: 110,
      eurRsd: 117,
    });

    const merchantQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(async () => ({
        data: { name: 'UNIVEREXPORT', aliases: [] },
        error: null,
      })),
    };
    const receiptSingle = jest.fn(async () => ({
      data: { id: 'receipt-1' },
      error: null,
    }));
    const receiptSelect = jest.fn(() => ({ single: receiptSingle }));
    const receiptInsert = jest.fn(() => ({ select: receiptSelect }));
    const expenseInsert = jest.fn(async () => ({ error: null }));

    fromMock
      .mockReturnValueOnce(merchantQuery)
      .mockReturnValueOnce({ insert: receiptInsert })
      .mockReturnValueOnce({ insert: expenseInsert });

    await saveFiscalReceipt({
      receipt: {
        ok: true,
        source: 'fiscal_qr',
        merchantName: 'UNIVEREXPORT',
        taxId: '101692669',
        occurredAt: '2026-08-02T12:00:00+02:00',
        totalCents: 25000,
        currency: 'RSD',
        paymentType: 'Готовина',
        items: [
          {
            name: 'HLEB 7 ZRNA SECENI (KOM) (E)',
            quantity: 1,
            unitPriceCents: 25000,
            lineTotalCents: 25000,
            vatLabel: 'E',
          },
        ],
      },
      merchant: { existingId: 'merchant-1' },
      expenses: [
        {
          amountCents: 25000,
          categoryId: 'groceries',
          description: 'Хлеб',
          rawName: 'HLEB 7 ZRNA SECENI (KOM) (E)',
        },
      ],
    });

    expect(expenseInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        description: 'Хлеб',
        raw_name: 'HLEB 7 ZRNA SECENI (KOM) (E)',
      }),
    ]);
  });
});
