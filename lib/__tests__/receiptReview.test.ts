import { describe, expect, jest, test } from '@jest/globals';

import {
  includedReviewTotal,
  parseReviewAmountInput,
  reviewTotalsMismatch,
} from '../../app/(app)/receipt/review';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock('../../contexts/ReceiptDraftContext', () => ({
  useReceiptDraft: jest.fn(),
}));

jest.mock('../supabase', () => ({
  supabase: {},
}));

describe('receipt review totals', () => {
  test('parses comma and dot amounts without accepting empty or zero values', () => {
    expect(parseReviewAmountInput('12,5')).toBe(1_250);
    expect(parseReviewAmountInput('12.5')).toBe(1_250);
    expect(parseReviewAmountInput('')).toBeNull();
    expect(parseReviewAmountInput('0')).toBeNull();
  });

  test('uses edited included amounts and ignores excluded items', () => {
    const total = includedReviewTotal([
      { amountCents: 1_250, included: true },
      { amountCents: 750, included: true },
      { amountCents: 9_999, included: false },
    ]);

    expect(total).toBe(2_000);
    expect(reviewTotalsMismatch(total, 2_000)).toBe(false);
    expect(reviewTotalsMismatch(total, 2_100)).toBe(true);
  });

  test('returns no total while an included amount is invalid', () => {
    expect(
      includedReviewTotal([
        { amountCents: 1_250, included: true },
        { amountCents: null, included: true },
      ]),
    ).toBeNull();
  });
});
