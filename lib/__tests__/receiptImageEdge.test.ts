import { describe, expect, test } from '@jest/globals';

import { validateModelOutput } from '../../supabase/functions/analyze-receipt-image/index';

describe('receipt image Edge output validation', () => {
  test('keeps tidy Russian names and raw evidence while constraining categories', () => {
    const result = validateModelOutput(
      {
        merchantName: 'Srbijavoz',
        merchantTypeSlug: 'transport',
        occurredOn: '2026-08-02',
        currency: 'RSD',
        totalCents: 2000,
        confidence: 'high',
        items: [
          {
            name: 'Билет на поезд',
            rawName: 'VK: 262148216366(kom)(E)',
            quantity: 1,
            unitPriceCents: 1500,
            lineTotalCents: 1500,
            categoryName: 'Транспорт',
          },
          {
            name: 'Напиток',
            rawName: null,
            quantity: null,
            unitPriceCents: null,
            lineTotalCents: 500,
            categoryName: 'Выдуманная категория',
          },
        ],
      },
      new Set(['Транспорт', 'Продукты']),
      new Set(['transport']),
      false,
      '',
    );

    expect(result?.items).toEqual([
      {
        name: 'Билет на поезд',
        rawName: 'VK: 262148216366(kom)(E)',
        quantity: 1,
        unitPriceCents: 1500,
        lineTotalCents: 1500,
        categoryName: 'Транспорт',
      },
      {
        name: 'Напиток',
        rawName: null,
        quantity: null,
        unitPriceCents: null,
        lineTotalCents: 500,
        categoryName: 'Не распознано',
      },
    ]);
  });
});
