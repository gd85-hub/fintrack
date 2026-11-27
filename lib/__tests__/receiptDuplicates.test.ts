import { describe, expect, jest, test } from '@jest/globals';

// The module reaches normalizeMerchantName through lib/receipts, which pulls in
// the Supabase client at import time. This is a pure matching test, so the
// client is stubbed out (it is never used by the matching logic).
jest.mock('../supabase', () => ({ supabase: {} }));

import {
  matchReceiptDuplicate,
  type ReceiptDuplicateInput,
} from '../receiptDuplicates';

// A fiscal QR receipt: exact timestamp, tax id, no separate occurredOn (the
// local date is derived from the timestamp's literal prefix).
const qr: ReceiptDuplicateInput = {
  totalCents: 123456,
  currency: 'RSD',
  occurredOn: null,
  occurredAt: '2026-11-10T19:30:00+02:00',
  merchantId: 'merchant-1',
  merchantName: 'UNIVEREXPORT',
  merchantLabel: 'UNIVEREXPORT 1369800-MP190',
  taxId: '101692669',
};

// A photo OCR representation of the same purchase: date only, no timestamp, no
// merchant id yet, same normalized merchant and total.
const ocr: ReceiptDuplicateInput = {
  totalCents: 123456,
  currency: 'RSD',
  occurredOn: '2026-11-10',
  occurredAt: null,
  merchantId: null,
  merchantName: 'Univerexport',
  merchantLabel: null,
  taxId: null,
};

describe('matchReceiptDuplicate', () => {
  test('a QR and an OCR capture of the same purchase are a probable duplicate', () => {
    const result = matchReceiptDuplicate(qr, ocr);
    expect(result.isProbableDuplicate).toBe(true);
    // Date-only OCR against a QR receipt is probable, not a strong identity claim.
    expect(result.confidence).toBe('probable');
    expect(result.evidence).toMatchObject({
      total: true,
      currency: true,
      date: true,
      merchantName: true,
      timestamp: false,
      merchantId: false,
    });
  });

  test('matching is symmetric regardless of save order', () => {
    expect(matchReceiptDuplicate(qr, ocr)).toEqual(
      matchReceiptDuplicate(ocr, qr),
    );
  });

  test('the same QR receipt added twice is a strong duplicate', () => {
    const result = matchReceiptDuplicate(qr, { ...qr });
    expect(result.isProbableDuplicate).toBe(true);
    // Both carry the same exact timestamp and tax id.
    expect(result.confidence).toBe('strong');
    expect(result.evidence.timestamp).toBe(true);
    expect(result.evidence.merchantId).toBe(true);
    expect(result.evidence.taxId).toBe(true);
  });

  test('the same photo receipt added twice is a probable duplicate', () => {
    const result = matchReceiptDuplicate(ocr, { ...ocr });
    expect(result.isProbableDuplicate).toBe(true);
    // Neither carries a timestamp, so it stays probable.
    expect(result.confidence).toBe('probable');
  });

  test('same merchant, date and total but a different currency does not match', () => {
    const result = matchReceiptDuplicate(qr, { ...qr, currency: 'EUR' });
    expect(result.isProbableDuplicate).toBe(false);
    expect(result.evidence.currency).toBe(false);
  });

  test('a different total does not match', () => {
    const result = matchReceiptDuplicate(qr, { ...qr, totalCents: 123457 });
    expect(result.isProbableDuplicate).toBe(false);
    expect(result.evidence.total).toBe(false);
  });

  test('a different merchant does not match', () => {
    const result = matchReceiptDuplicate(qr, {
      ...qr,
      merchantId: 'merchant-2',
      merchantName: 'MAXI',
      merchantLabel: 'MAXI 123',
    });
    expect(result.isProbableDuplicate).toBe(false);
    expect(result.evidence.merchantId).toBe(false);
    expect(result.evidence.merchantName).toBe(false);
  });

  test('a different local calendar date does not match', () => {
    const result = matchReceiptDuplicate(qr, {
      ...ocr,
      occurredOn: '2026-11-11',
    });
    expect(result.isProbableDuplicate).toBe(false);
    expect(result.evidence.date).toBe(false);
  });

  test('conflicting known tax ids block an otherwise matching pair', () => {
    const result = matchReceiptDuplicate(qr, {
      ...qr,
      taxId: '999999999',
    });
    expect(result.isProbableDuplicate).toBe(false);
    expect(result.confidence).toBe('none');
    expect(result.evidence.taxIdConflict).toBe(true);
  });

  test('clearly different known timestamps block a match', () => {
    const result = matchReceiptDuplicate(qr, {
      ...qr,
      occurredAt: '2026-11-10T21:05:00+02:00',
    });
    expect(result.isProbableDuplicate).toBe(false);
    expect(result.confidence).toBe('none');
    expect(result.evidence.timestampConflict).toBe(true);
  });

  test('timestamps within the narrow tolerance still confirm', () => {
    const result = matchReceiptDuplicate(qr, {
      ...qr,
      // 30 seconds apart: same instant to the minute (formatting/rounding).
      occurredAt: '2026-11-10T19:30:30+02:00',
    });
    expect(result.isProbableDuplicate).toBe(true);
    expect(result.confidence).toBe('strong');
    expect(result.evidence.timestampConflict).toBe(false);
  });

  test('a date-only OCR receipt matches a QR receipt when required evidence agrees', () => {
    const result = matchReceiptDuplicate(ocr, qr);
    expect(result.isProbableDuplicate).toBe(true);
    expect(result.confidence).toBe('probable');
    expect(result.evidence.timestamp).toBe(false);
    // No tax-id conflict: OCR has no tax id to disagree.
    expect(result.evidence.taxIdConflict).toBe(false);
  });

  test('normalized merchant spelling still matches', () => {
    const result = matchReceiptDuplicate(
      { ...ocr, merchantName: '  univerexport d.o.o.  ' },
      { ...ocr, merchantName: 'Univerexport DOO' },
    );
    expect(result.evidence.merchantName).toBe(true);
    expect(result.isProbableDuplicate).toBe(true);
  });

  test('a Cyrillic/Latin merchant spelling of the same name matches', () => {
    const result = matchReceiptDuplicate(
      { ...ocr, merchantName: 'ЛИДЛ' },
      { ...ocr, merchantName: 'LIDL' },
    );
    expect(result.evidence.merchantName).toBe(true);
    expect(result.isProbableDuplicate).toBe(true);
  });

  const invalidBaseline: ReceiptDuplicateInput = {
    totalCents: 123456,
    currency: 'RSD',
    occurredOn: '2026-11-10',
    occurredAt: null,
    merchantName: 'UNIVEREXPORT',
  };

  const invalidCases: [string, Partial<ReceiptDuplicateInput>][] = [
    ['a null total', { totalCents: null }],
    ['a zero total', { totalCents: 0 }],
    ['a negative total', { totalCents: -100 }],
    ['a fractional total', { totalCents: 123.4 }],
    ['an over-safe-integer total', { totalCents: Number.MAX_SAFE_INTEGER + 1 }],
    ['a null currency', { currency: null }],
    ['an invalid currency', { currency: 'EU' }],
    ['a null date', { occurredOn: null, occurredAt: null }],
    ['an invalid date', { occurredOn: '2026-13-40', occurredAt: null }],
    ['no merchant identity', { merchantId: null, merchantName: null, merchantLabel: null }],
  ];

  test.each(invalidCases)(
    'missing or invalid %s is never a positive match',
    (_label, override) => {
      const candidate = { ...invalidBaseline, ...override };
      const result = matchReceiptDuplicate(invalidBaseline, candidate);
      expect(result.isProbableDuplicate).toBe(false);
      expect(result.confidence).toBe('none');
    },
  );

  test('a custom currency on both sides matches', () => {
    const base: ReceiptDuplicateInput = {
      ...ocr,
      currency: 'THB',
    };
    const result = matchReceiptDuplicate(base, { ...base, currency: ' thb ' });
    expect(result.evidence.currency).toBe(true);
    expect(result.isProbableDuplicate).toBe(true);
  });

  test('a late-evening local date is not shifted by the timestamp offset', () => {
    // 23:30 at +02:00 is the 10th locally; a UTC slice would read the 10th too,
    // but a receipt near midnight must use the local calendar date, not UTC.
    const lateQr: ReceiptDuplicateInput = {
      ...qr,
      occurredAt: '2026-11-10T23:30:00+02:00',
    };
    const sameDayOcr: ReceiptDuplicateInput = {
      ...ocr,
      occurredOn: '2026-11-10',
    };
    expect(matchReceiptDuplicate(lateQr, sameDayOcr).evidence.date).toBe(true);

    // The same wall-clock instant expressed in UTC is 21:30 on the 10th; the
    // derived local date must come from the literal prefix, so an OCR receipt
    // dated the 11th (a genuinely different day) must not match.
    const nextDayOcr: ReceiptDuplicateInput = {
      ...ocr,
      occurredOn: '2026-11-11',
    };
    expect(matchReceiptDuplicate(lateQr, nextDayOcr).evidence.date).toBe(
      false,
    );
  });

  test('a just-after-midnight local date is not pulled back a day by the offset', () => {
    // 00:15 at +01:00 is 23:15 UTC on the previous day; the local calendar date
    // must be the later day, from the literal prefix — never the UTC day.
    const afterMidnightQr: ReceiptDuplicateInput = {
      ...qr,
      occurredAt: '2026-03-15T00:15:00+01:00',
    };
    expect(
      matchReceiptDuplicate(afterMidnightQr, {
        ...ocr,
        occurredOn: '2026-03-15',
      }).evidence.date,
    ).toBe(true);
    expect(
      matchReceiptDuplicate(afterMidnightQr, {
        ...ocr,
        occurredOn: '2026-03-14',
      }).evidence.date,
    ).toBe(false);
  });

  test('a blank merchant name falls back to a meaningful label', () => {
    const result = matchReceiptDuplicate(
      { ...ocr, merchantName: '   ', merchantLabel: 'UNIVEREXPORT' },
      { ...ocr, merchantName: 'Univerexport' },
    );
    expect(result.evidence.merchantName).toBe(true);
    expect(result.isProbableDuplicate).toBe(true);
  });

  test('an offset-less or invalid timestamp is not exact-time evidence', () => {
    // Same wall-clock text without an offset on both sides: not a confirmed
    // instant, so it neither strengthens to 'strong' nor conflicts.
    const noOffset: ReceiptDuplicateInput = {
      ...qr,
      occurredAt: '2026-11-10T19:30:00',
    };
    const result = matchReceiptDuplicate(noOffset, { ...noOffset });
    expect(result.isProbableDuplicate).toBe(true);
    expect(result.confidence).toBe('probable');
    expect(result.evidence.timestamp).toBe(false);
    expect(result.evidence.timestampConflict).toBe(false);

    const garbage: ReceiptDuplicateInput = {
      ...qr,
      occurredAt: 'not-a-timestamp',
    };
    expect(
      matchReceiptDuplicate(garbage, { ...garbage }).evidence.timestamp,
    ).toBe(false);
  });

  test('is deterministic across repeated calls', () => {
    const first = matchReceiptDuplicate(qr, ocr);
    const second = matchReceiptDuplicate(qr, ocr);
    expect(first).toEqual(second);
  });
});
