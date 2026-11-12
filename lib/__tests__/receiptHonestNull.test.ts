import { describe, expect, jest, test } from '@jest/globals';

import { receiptFromImageAnalysis } from '../receiptImage';
import {
  needsManualRsdEquivalent,
  receiptDraftBlockers,
} from '../receiptReview';

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

jest.mock('../supabase', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
  },
}));

// Synthetic analysis: invented goods and amounts, never a real receipt.
const items = [
  {
    name: 'Виджет малый',
    rawName: 'VIDZET M',
    quantity: 1,
    unitPriceCents: 12000,
    lineTotalCents: 12000,
    categoryName: 'Прочее',
  },
  {
    name: 'Гаджет большой',
    rawName: 'GADZET L',
    quantity: 2,
    unitPriceCents: 19000,
    lineTotalCents: 38000,
    categoryName: 'Прочее',
  },
];

const analysis = {
  ok: true as const,
  merchantName: 'Kiosk Zvezda',
  occurredOn: '2026-03-04' as string | null,
  currency: 'RSD' as string | null,
  totalCents: 50000 as number | null,
  items,
  confidence: 'high' as const,
};

describe('receiptFromImageAnalysis keeps an honest null', () => {
  test('an unreadable date still produces a draft with the items intact', () => {
    const draft = receiptFromImageAnalysis({ ...analysis, occurredOn: null });

    expect(draft).not.toBeNull();
    expect(draft.occurredOn).toBeNull();
    expect(draft.currency).toBe('RSD');
    expect(draft.totalCents).toBe(50000);
    expect(draft.items).toHaveLength(2);
    expect(draft.items[0]).toMatchObject({
      name: 'Виджет малый',
      lineTotalCents: 12000,
      vatLabel: null,
    });
  });

  test('an unreadable currency still produces a draft with the items intact', () => {
    const draft = receiptFromImageAnalysis({ ...analysis, currency: null });

    expect(draft.currency).toBeNull();
    expect(draft.occurredOn).toBe('2026-03-04');
    expect(draft.totalCents).toBe(50000);
    expect(draft.items).toHaveLength(2);
  });

  test('both unreadable still produces a draft with the items intact', () => {
    const draft = receiptFromImageAnalysis({
      ...analysis,
      occurredOn: null,
      currency: null,
    });

    expect(draft.occurredOn).toBeNull();
    expect(draft.currency).toBeNull();
    expect(draft.items).toHaveLength(2);
    expect(draft.source).toBe('ocr_photo');
  });

  test('a fully read receipt behaves exactly as before', () => {
    const draft = receiptFromImageAnalysis(analysis);

    expect(draft).toMatchObject({
      ok: true,
      source: 'ocr_photo',
      merchantLabel: 'Kiosk Zvezda',
      taxId: null,
      occurredAt: null,
      occurredOn: '2026-03-04',
      currency: 'RSD',
      totalCents: 50000,
      paymentType: null,
      confidence: 'high',
    });
    expect(draft.items).toEqual(
      items.map((item) => ({ ...item, vatLabel: null })),
    );
  });

  test('a missing total still falls back to the sum of the line items', () => {
    const draft = receiptFromImageAnalysis({ ...analysis, totalCents: null });

    expect(draft.totalCents).toBe(50000);
  });
});

describe('receiptDraftBlockers', () => {
  test('reports both fields when neither was read', () => {
    expect(
      receiptDraftBlockers({ occurredOn: null, currency: null }),
    ).toEqual(['date', 'currency']);
  });

  test('reports only the date when the currency is present', () => {
    expect(
      receiptDraftBlockers({ occurredOn: null, currency: 'RSD' }),
    ).toEqual(['date']);
  });

  test('reports only the currency when the date is present', () => {
    expect(
      receiptDraftBlockers({ occurredOn: '2026-03-04', currency: null }),
    ).toEqual(['currency']);
  });

  test('reports nothing when both are filled in', () => {
    expect(
      receiptDraftBlockers({ occurredOn: '2026-03-04', currency: 'RSD' }),
    ).toEqual([]);
  });

  test('treats an invalid or blank date as a blocker', () => {
    expect(
      receiptDraftBlockers({ occurredOn: '', currency: 'RSD' }),
    ).toEqual(['date']);
    expect(
      receiptDraftBlockers({ occurredOn: '2026-02-30', currency: 'RSD' }),
    ).toEqual(['date']);
  });
});

describe('needsManualRsdEquivalent', () => {
  test('a null currency is "not chosen", so the manual RSD mode stays off', () => {
    expect(needsManualRsdEquivalent(null)).toBe(false);
    expect(needsManualRsdEquivalent(undefined)).toBe(false);
    expect(needsManualRsdEquivalent('')).toBe(false);
  });

  test('a supported currency needs no manual equivalent', () => {
    expect(needsManualRsdEquivalent('RSD')).toBe(false);
    expect(needsManualRsdEquivalent('EUR')).toBe(false);
    expect(needsManualRsdEquivalent('USD')).toBe(false);
  });

  test('an exotic currency does need one', () => {
    expect(needsManualRsdEquivalent('KZT')).toBe(true);
  });
});
