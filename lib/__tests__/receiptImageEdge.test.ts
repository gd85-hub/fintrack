import { describe, expect, test } from '@jest/globals';

import {
  normalizeReceiptDate,
  receiptAnalysisSystemPrompt,
  validateModelOutput,
} from '../../supabase/functions/analyze-receipt-image/index';

const validItem = {
  name: 'Сэндвич',
  rawName: 'PICA SENDVIC VRAT(Ђ)',
  quantity: 1,
  unitPriceCents: 35000,
  lineTotalCents: 35000,
  categoryName: 'Кафе',
};

function modelOutput(overrides: Record<string, unknown> = {}) {
  return {
    merchantName: 'SKROZ DOBRA PEKARA',
    merchantTypeSlug: 'cafe',
    occurredOn: '2026-07-29',
    currency: 'RSD',
    totalCents: 35000,
    confidence: 'high',
    items: [validItem],
    ...overrides,
  };
}

describe('receipt image system prompt', () => {
  test('directs the model to prefer the venue brand and read full Serbian item lines', () => {
    expect(receiptAnalysisSystemPrompt).toContain(
      'SKROZ DOBRA PEKARA',
    );
    expect(receiptAnalysisSystemPrompt).toContain('ФИСКАЛНИ РАЧУН');
    expect(receiptAnalysisSystemPrompt).toContain('TRGOCENTAR');
    expect(receiptAnalysisSystemPrompt).toContain('PICA SENDVIC VRAT(Ђ)');
    expect(receiptAnalysisSystemPrompt).toContain(
      'name it Сэндвич, not Пицца',
    );
    expect(receiptAnalysisSystemPrompt).toContain(
      'cafe or food-style category',
    );
    expect(receiptAnalysisSystemPrompt).toContain(
      'strict YYYY-MM-DD format',
    );
    expect(receiptAnalysisSystemPrompt).toContain(
      'Serbian dinar is RSD',
    );
  });
});

describe('normalizeReceiptDate', () => {
  test.each([
    ['29.07.2026.', '2026-07-29'],
    ['2026-07-29', '2026-07-29'],
    ['1.2.2026', '2026-02-01'],
    ['29.07.2026. 14:35:20', '2026-07-29'],
    ['garbage', null],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeReceiptDate(input)).toBe(expected);
  });
});

describe('receipt image Edge output validation', () => {
  test('preserves items while normalizing a dotted date and spaced currency', () => {
    const result = validateModelOutput(
      modelOutput({ occurredOn: '29.07.2026.', currency: ' rsd ' }),
      new Set(['Кафе']),
      new Set(['cafe']),
      false,
      '',
    );

    expect(result).toMatchObject({
      ok: true,
      occurredOn: '2026-07-29',
      currency: 'RSD',
      items: [validItem],
    });
  });

  test('falls back invalid scalar fields without discarding readable items', () => {
    const result = validateModelOutput(
      modelOutput({
        merchantName: 73,
        occurredOn: 'sometime in July',
        currency: 'рсд',
        totalCents: '350.00',
        confidence: 'uncertain',
      }),
      new Set(['Кафе']),
      new Set(['cafe']),
      false,
      '',
    );

    expect(result).toMatchObject({
      ok: true,
      merchantName: null,
      occurredOn: null,
      currency: null,
      totalCents: null,
      confidence: 'low',
      items: [validItem],
    });
  });

  test('returns null when no line item is readable', () => {
    expect(
      validateModelOutput(
        modelOutput({ items: [] }),
        new Set(['Кафе']),
        new Set(['cafe']),
        false,
        '',
      ),
    ).toBeNull();
  });

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
