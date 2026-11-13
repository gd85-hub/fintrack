import { parseLocalISO } from './dates';
import { isCurrency } from './money';

export type ReceiptDraftBlocker = 'date' | 'currency' | 'total';

export type ReceiptDraftFields = {
  occurredOn?: string | null;
  currency?: string | null;
  totalCents?: number | null;
};

// What still blocks saving a receipt draft: the fields the vision model honestly
// could not read and the human has not filled in yet. Pure, so the review
// screen and the tests share one definition of "ready to save".
export function receiptDraftBlockers(
  draft: ReceiptDraftFields | null | undefined,
): ReceiptDraftBlocker[] {
  const blockers: ReceiptDraftBlocker[] = [];

  const occurredOn = draft ? draft.occurredOn : null;
  if (!occurredOn || !parseLocalISO(occurredOn)) {
    blockers.push('date');
  }

  const currency = draft ? draft.currency : null;
  if (!currency || !currency.trim()) {
    blockers.push('currency');
  }

  const totalCents = draft ? draft.totalCents : null;
  if (totalCents === null || totalCents === undefined) {
    blockers.push('total');
  }

  return blockers;
}

// null means the comparison is unavailable, not that the totals matched.
export function reviewTotalsMismatch(
  includedTotal: number | null,
  receiptTotal: number | null,
): boolean | null {
  if (includedTotal === null || receiptTotal === null) {
    return null;
  }
  return includedTotal !== receiptTotal;
}

// A null currency means "not chosen yet", never "an exotic currency": the
// manual RSD-equivalent branch stays closed until the human picks one.
export function needsManualRsdEquivalent(
  currency: string | null | undefined,
): boolean {
  return (
    typeof currency === 'string' &&
    currency.trim().length > 0 &&
    !isCurrency(currency)
  );
}
