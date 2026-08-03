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
        merchantLabel: 'UNIVEREXPORT 1369800-MP190',
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
    expect(receiptInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: 'merchant-1',
        merchant_label: 'UNIVEREXPORT 1369800-MP190',
      }),
    );
  });

  test('creates one brand merchant and keeps each branch label', async () => {
    getSessionMock.mockImplementation(async () => ({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    }));
    ratesMock.mockResolvedValue({
      date: '2026-08-03',
      usdRsd: 110,
      eurRsd: 117,
    });

    const merchantSingle = jest.fn(async () => ({
      data: { id: 'merchant-brand' },
      error: null,
    }));
    const merchantSelect = jest.fn(() => ({ single: merchantSingle }));
    const merchantInsert = jest.fn(() => ({ select: merchantSelect }));
    const receiptSingle = jest.fn(async () => ({
      data: { id: 'receipt-brand' },
      error: null,
    }));
    const receiptSelect = jest.fn(() => ({ single: receiptSingle }));
    const receiptInsert = jest.fn(() => ({ select: receiptSelect }));
    const expenseInsert = jest.fn(async () => ({ error: null }));

    fromMock
      .mockReturnValueOnce({ insert: merchantInsert })
      .mockReturnValueOnce({ insert: receiptInsert })
      .mockReturnValueOnce({ insert: expenseInsert });

    await saveFiscalReceipt({
      receipt: {
        ok: true,
        source: 'fiscal_qr',
        merchantName: 'MIX MARKT',
        merchantLabel: 'MIX MARKT 38103 NS CENTAR',
        taxId: '101692669',
        occurredAt: '2026-08-03T12:00:00+02:00',
        totalCents: 10_000,
        currency: 'RSD',
        paymentType: 'Карточка',
        items: [
          {
            name: 'HLEB',
            quantity: 1,
            unitPriceCents: 10_000,
            lineTotalCents: 10_000,
            vatLabel: 'E',
          },
        ],
      },
      merchant: { name: 'MIX MARKT', typeId: 'shop' },
      expenses: [
        {
          amountCents: 10_000,
          categoryId: 'groceries',
          description: 'Хлеб',
          rawName: 'HLEB',
        },
      ],
    });

    expect(merchantInsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      name: 'MIX MARKT',
      type_id: 'shop',
      aliases: [],
    });
    expect(receiptInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: 'merchant-brand',
        merchant_label: 'MIX MARKT 38103 NS CENTAR',
      }),
    );

    const existingMerchantQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(async () => ({
        data: { name: 'MIX MARKT', aliases: [] },
        error: null,
      })),
    };
    const secondReceiptSingle = jest.fn(async () => ({
      data: { id: 'receipt-second-branch' },
      error: null,
    }));
    const secondReceiptSelect = jest.fn(() => ({
      single: secondReceiptSingle,
    }));
    const secondReceiptInsert = jest.fn(() => ({
      select: secondReceiptSelect,
    }));
    const secondExpenseInsert = jest.fn(async () => ({ error: null }));

    fromMock
      .mockReturnValueOnce(existingMerchantQuery)
      .mockReturnValueOnce({ insert: secondReceiptInsert })
      .mockReturnValueOnce({ insert: secondExpenseInsert });

    await saveFiscalReceipt({
      receipt: {
        ok: true,
        source: 'fiscal_qr',
        merchantName: 'MIX MARKT',
        merchantLabel: 'MIX MARKT 41027 NS LIMAN',
        taxId: '101692669',
        occurredAt: '2026-08-03T13:00:00+02:00',
        totalCents: 12_000,
        currency: 'RSD',
        paymentType: 'Карточка',
        items: [
          {
            name: 'MLEKO',
            quantity: 1,
            unitPriceCents: 12_000,
            lineTotalCents: 12_000,
            vatLabel: 'E',
          },
        ],
      },
      merchant: { existingId: 'merchant-brand' },
      expenses: [
        {
          amountCents: 12_000,
          categoryId: 'groceries',
          description: 'Молоко',
          rawName: 'MLEKO',
        },
      ],
    });

    expect(merchantInsert).toHaveBeenCalledTimes(1);
    expect(secondReceiptInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: 'merchant-brand',
        merchant_label: 'MIX MARKT 41027 NS LIMAN',
      }),
    );
  });
});
