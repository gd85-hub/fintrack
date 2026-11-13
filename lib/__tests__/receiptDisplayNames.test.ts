import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import { anchorRateForExpense } from '../anchorRates';
import { saveFiscalReceipt } from '../db';
import { ratesForExpense } from '../fx';
import type { ParsedReceipt } from '../receipts';
import { supabase } from '../supabase';

jest.mock('../anchorRates', () => ({
  anchorRateForExpense: jest.fn(),
}));

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
const anchorRateMock = anchorRateForExpense as jest.MockedFunction<
  typeof anchorRateForExpense
>;
const getSessionMock = supabase.auth.getSession as unknown as jest.Mock;
const fromMock = supabase.from as unknown as jest.Mock;
const recencyEqMock = jest.fn(async () => ({ error: null }));
const recencyUpdateMock = jest.fn(() => ({ eq: recencyEqMock }));
const recencyClient = { update: recencyUpdateMock };

describe('receipt display-name persistence', () => {
  beforeEach(() => {
    ratesMock.mockReset();
    anchorRateMock.mockReset();
    anchorRateMock.mockImplementation(async (currency, dateISO) => ({
      date: dateISO,
      quote: currency,
      ratePerEur: currency === 'RSD' ? 117 : 1.064,
    }));
    getSessionMock.mockReset();
    fromMock.mockReset();
    recencyEqMock.mockClear();
    recencyUpdateMock.mockClear();
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
    const receipt = {
      ok: true as const,
      source: 'ocr_photo' as const,
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
    } satisfies ParsedReceipt & { totalCents: number };

    fromMock
      .mockReturnValueOnce(merchantQuery)
      .mockReturnValueOnce({ insert: receiptInsert })
      .mockReturnValueOnce({ insert: expenseInsert })
      .mockReturnValueOnce(recencyClient);

    await saveFiscalReceipt({
      receipt,
      rawReceipt: { ...receipt, totalCents: null },
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
        raw_json: expect.objectContaining({ totalCents: null }),
        total: '250.00',
      }),
    );
    expect(recencyUpdateMock).toHaveBeenCalledWith({
      updated_at: expect.any(String),
    });
    expect(recencyEqMock).toHaveBeenCalledWith('id', 'merchant-1');
  });

  test('uses one currency anchor for every item in a covered-currency receipt', async () => {
    getSessionMock.mockImplementation(async () => ({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    }));
    anchorRateMock.mockResolvedValue({
      date: '2026-08-02',
      quote: 'KZT',
      ratePerEur: 500,
    });

    const merchantQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(async () => ({
        data: { name: 'TMT MARKET', aliases: [] },
        error: null,
      })),
    };
    const receiptSingle = jest.fn(async () => ({
      data: { id: 'receipt-manual' },
      error: null,
    }));
    const receiptSelect = jest.fn(() => ({ single: receiptSingle }));
    const receiptInsert = jest.fn(() => ({ select: receiptSelect }));
    const expenseInsert = jest.fn(async () => ({ error: null }));

    fromMock
      .mockReturnValueOnce(merchantQuery)
      .mockReturnValueOnce({ insert: receiptInsert })
      .mockReturnValueOnce({ insert: expenseInsert })
      .mockReturnValueOnce(recencyClient);

    await saveFiscalReceipt({
      receipt: {
        ok: true,
        source: 'ocr_photo',
        merchantName: 'TMT MARKET',
        taxId: null,
        occurredAt: '2026-08-02T12:00:00+02:00',
        totalCents: 30_000,
        currency: 'KZT',
        paymentType: null,
        items: [],
      },
      merchant: { existingId: 'merchant-1' },
      manualRsdTotalCents: 10_001,
      expenses: [
        {
          amountCents: 10_000,
          categoryId: 'groceries',
          description: 'Первая позиция',
          rawName: 'ITEM ONE',
        },
        {
          amountCents: 20_000,
          categoryId: 'groceries',
          description: 'Вторая позиция',
          rawName: 'ITEM TWO',
        },
      ],
    });

    expect(ratesMock).not.toHaveBeenCalled();
    expect(anchorRateMock).toHaveBeenCalledTimes(1);
    expect(anchorRateMock).toHaveBeenCalledWith('KZT', '2026-08-02');
    expect(receiptInsert).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'KZT' }),
    );
    expect(expenseInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        original_currency: 'KZT',
        amount_rsd: null,
        amount_usd: null,
        amount_eur: '0.20',
        fx_rate_date: null,
      }),
      expect.objectContaining({
        original_currency: 'KZT',
        amount_rsd: null,
        amount_usd: null,
        amount_eur: '0.40',
        fx_rate_date: null,
      }),
    ]);
  });

  test('blocks a receipt save before inserts when the anchor rate is unavailable', async () => {
    getSessionMock.mockImplementation(async () => ({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    }));
    ratesMock.mockResolvedValue({
      date: '2026-08-02',
      usdRsd: 110,
      eurRsd: 117,
    });
    anchorRateMock.mockRejectedValue(new Error('anchor unavailable'));

    await expect(
      saveFiscalReceipt({
        receipt: {
          ok: true,
          source: 'fiscal_qr',
          merchantName: 'UNIVEREXPORT',
          taxId: '101692669',
          occurredAt: '2026-08-02T12:00:00+02:00',
          totalCents: 10_000,
          currency: 'RSD',
          paymentType: 'Карточка',
          items: [],
        },
        merchant: { existingId: 'merchant-1' },
        expenses: [
          {
            amountCents: 10_000,
            categoryId: 'groceries',
            description: 'Хлеб',
            rawName: 'HLEB',
          },
        ],
      }),
    ).rejects.toThrow('anchor unavailable');

    expect(fromMock).not.toHaveBeenCalled();
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
      merchant: { name: 'MIX MARKT' },
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
      type_id: null,
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
      .mockReturnValueOnce({ insert: secondExpenseInsert })
      .mockReturnValueOnce(recencyClient);

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
    expect(recencyUpdateMock).toHaveBeenCalledTimes(1);
    expect(recencyEqMock).toHaveBeenCalledWith('id', 'merchant-brand');
  });
});
