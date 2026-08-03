import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { manipulateAsync } from 'expo-image-manipulator';

import { receiptExpenseAmounts } from '../db';
import {
  analyzeReceiptImages,
  compressReceiptImages,
  receiptFromImageAnalysis,
  validateReceiptImageAnalysis,
} from '../receiptImage';
import { supabase } from '../supabase';

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

jest.mock('../supabase', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
  },
}));

const manipulateMock = manipulateAsync as jest.MockedFunction<
  typeof manipulateAsync
>;
const invokeMock = supabase.functions.invoke as jest.MockedFunction<
  typeof supabase.functions.invoke
>;

const analysisPayload = {
  ok: true as const,
  merchantName: 'Anthropic',
  merchantTypeSlug: 'online',
  occurredOn: '2026-08-02',
  currency: 'USD',
  totalCents: 1000,
  items: [
    {
      name: 'Подписка Claude',
      rawName: 'Claude Pro subscription',
      quantity: 1,
      unitPriceCents: 1000,
      lineTotalCents: 1000,
      categoryName: 'Подписки',
    },
  ],
  confidence: 'high' as const,
};

describe('receipt image analysis', () => {
  beforeEach(() => {
    manipulateMock.mockReset();
    invokeMock.mockReset();
  });

  test('validates and maps structured analysis into the shared receipt draft', () => {
    const analysis = validateReceiptImageAnalysis(analysisPayload);
    expect(analysis).toEqual(analysisPayload);
    expect(analysis.ok && receiptFromImageAnalysis(analysis)).toEqual({
      ok: true,
      source: 'ocr_photo',
      merchantName: 'Anthropic',
      merchantLabel: 'Anthropic',
      merchantTypeSlug: 'online',
      taxId: null,
      occurredAt: null,
      occurredOn: '2026-08-02',
      totalCents: 1000,
      currency: 'USD',
      paymentType: null,
      items: [
        {
          name: 'Подписка Claude',
          rawName: 'Claude Pro subscription',
          quantity: 1,
          unitPriceCents: 1000,
          lineTotalCents: 1000,
          categoryName: 'Подписки',
          vatLabel: null,
        },
      ],
      confidence: 'high',
    });
  });

  test('keeps a photo merchant label while deriving its brand', () => {
    const analysis = validateReceiptImageAnalysis({
      ...analysisPayload,
      merchantName: 'MIX MARKT 38103 NS CENTAR',
    });

    expect(analysis.ok && receiptFromImageAnalysis(analysis)).toMatchObject({
      merchantName: 'MIX MARKT',
      merchantLabel: 'MIX MARKT 38103 NS CENTAR',
    });
  });

  test('rejects invalid dates and missing line items', () => {
    expect(
      validateReceiptImageAnalysis({
        ...analysisPayload,
        occurredOn: '2026-02-30',
      }),
    ).toEqual({ ok: false, error: 'parse_failed' });
    expect(
      validateReceiptImageAnalysis({ ...analysisPayload, items: [] }),
    ).toEqual({ ok: false, error: 'parse_failed' });
  });

  test('accepts an older image response without optional rawName', () => {
    const item = analysisPayload.items[0];
    const { rawName: _rawName, ...itemWithoutRawName } = item;

    expect(
      validateReceiptImageAnalysis({
        ...analysisPayload,
        items: [itemWithoutRawName],
      }),
    ).toMatchObject({
      ok: true,
      items: [{ name: 'Подписка Claude' }],
    });
  });

  test('resizes the long edge and returns compressed JPEG base64', async () => {
    manipulateMock.mockResolvedValue({
      uri: 'compressed.jpg',
      width: 1600,
      height: 800,
      base64: 'YWJjZA==',
    });

    await expect(
      compressReceiptImages([
        { uri: 'receipt.png', width: 3200, height: 1600 },
      ]),
    ).resolves.toEqual(['YWJjZA==']);
    expect(manipulateMock).toHaveBeenCalledWith(
      'receipt.png',
      [{ resize: { width: 1600 } }],
      { base64: true, compress: 0.7, format: 'jpeg' },
    );
  });

  test('sends only images and real lookup options to the Edge Function', async () => {
    invokeMock.mockResolvedValue({ data: analysisPayload, error: null });

    await expect(
      analyzeReceiptImages(
        ['YWJjZA=='],
        [
          {
            id: 'subscriptions',
            slug: null,
            emoji: '📱',
            name: 'Подписки',
            group: 'Сервисы',
            sort: 1,
          },
        ],
        [
          {
            id: 'online-id',
            emoji: '🌐',
            name: 'Онлайн',
            slug: 'online',
            sort: 1,
          },
        ],
      ),
    ).resolves.toEqual(analysisPayload);
    expect(invokeMock).toHaveBeenCalledWith('analyze-receipt-image', {
      body: {
        images: ['YWJjZA=='],
        categories: [{ id: 'subscriptions', name: 'Подписки' }],
        merchantTypes: [{ slug: 'online', name: 'Онлайн' }],
      },
    });
  });
});

describe('receipt image currency persistence', () => {
  test('uses stored-rate conversion for supported currencies', () => {
    expect(
      receiptExpenseAmounts(1000, 'USD', {
        date: '2026-08-02',
        usdRsd: 110,
        eurRsd: 117,
      }),
    ).toEqual({
      amount_rsd: '1100.00',
      amount_usd: '10.00',
      amount_eur: '9.40',
      fx_rate_date: '2026-08-02',
    });
  });

  test('keeps conversions null for unsupported currencies', () => {
    expect(receiptExpenseAmounts(1000, 'TRY', null)).toEqual({
      amount_rsd: null,
      amount_usd: null,
      amount_eur: null,
      fx_rate_date: null,
    });
  });

  test('stores only a manual RSD share for unsupported currencies', () => {
    expect(receiptExpenseAmounts(1000, 'KZT', null, 625)).toEqual({
      amount_rsd: '6.25',
      amount_usd: null,
      amount_eur: null,
      fx_rate_date: null,
    });
  });
});
