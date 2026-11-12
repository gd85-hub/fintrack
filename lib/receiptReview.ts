import { parseLocalISO } from './dates';
import { isCurrency } from './money';

export type ReceiptDraftBlocker = 'date' | 'currency';

export type ReceiptDraftFields = {
  occurredOn?: string | null;
  currency?: string | null;
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

  return blockers;
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
