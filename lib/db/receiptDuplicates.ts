import { parseLocalISO } from '../dates';
import { decimalToCents } from '../money';
import {
  matchReceiptDuplicate,
  type ReceiptDuplicateInput,
  type ReceiptDuplicateMatch,
} from '../receiptDuplicates';
import { supabase } from '../supabase';
import { authenticatedUserId } from './internal';
import { fetchAllRows } from './pagination';

// The incoming (not-yet-saved) receipt the caller wants to check for duplicates.
// `occurredOn` is the resolved local calendar date of the purchase; DUP-02B
// derives it from the parsed receipt (occurredOn or the occurred_at prefix).
export type IncomingReceiptForDuplicates = {
  totalCents: number | null;
  currency: string | null;
  occurredOn: string;
  occurredAt?: string | null;
  merchantId?: string | null;
  merchantName?: string | null;
  merchantLabel?: string | null;
  taxId?: string | null;
};

// One existing receipt that is a probable duplicate, with enough metadata for a
// DUP-02B warning plus the matching evidence from the pure matcher.
export type ReceiptDuplicateCandidate = {
  receiptId: string;
  source: string | null;
  merchantId: string | null;
  merchantName: string | null;
  merchantLabel: string | null;
  occurredOn: string;
  occurredAt: string | null;
  totalCents: number | null;
  currency: string | null;
  match: ReceiptDuplicateMatch;
};

type ExpenseReceiptRow = {
  id: string;
  receipt_id: string;
  occurred_on: string;
};

type ReceiptCandidateRow = {
  id: string;
  source: string | null;
  merchant_id: string | null;
  merchant_label: string | null;
  tax_id: string | null;
  occurred_at: string | null;
  total: number | string | null;
  currency: string | null;
  merchant: { name: string } | null;
};

const RECEIPT_CANDIDATE_SELECT =
  'id,source,merchant_id,merchant_label,tax_id,occurred_at,total,currency,merchant:merchants!receipts_merchant_id_fkey(name)';

// Returns the authenticated account's existing receipts that are a probable
// duplicate of the incoming purchase. Detection only — no save-flow change, no
// merge/delete, no warning UI (that is DUP-02B).
//
// Candidate dating uses the authoritative saved local date, `expenses.occurred_on`,
// not the receipt timestamp or `raw_json`: `receipts` stores only a timestamptz
// whose serialization may not preserve the original local date prefix, and an
// OCR receipt's `raw_json` may hold the pre-confirmation model response. Saved
// receipt `total`/`currency` are used, never sums of converted amounts.
//
// A retrieval failure is propagated (it must not be mistaken for "no duplicates").
export async function findReceiptDuplicates(
  incoming: IncomingReceiptForDuplicates,
): Promise<ReceiptDuplicateCandidate[]> {
  // Without a valid local date there is no account-scoped candidate set to
  // compare against.
  if (!parseLocalISO(incoming.occurredOn)) {
    return [];
  }

  const userId = await authenticatedUserId();

  // Candidate receipts are those linked to any expense on the same local date
  // for this account. Explicit `user_id` scope on top of RLS; the full set is
  // paged deterministically by id.
  const expenseRows = await fetchAllRows<ExpenseReceiptRow>((from, to) =>
    supabase
      .from('expenses')
      .select('id,receipt_id,occurred_on')
      .eq('user_id', userId)
      .eq('occurred_on', incoming.occurredOn)
      .not('receipt_id', 'is', null)
      .order('id', { ascending: true })
      .range(from, to),
  );

  // One receipt can own many expense rows; collapse to one candidate per
  // receipt and keep its authoritative saved local date.
  const localDateByReceipt = new Map<string, string>();
  for (const row of expenseRows) {
    if (!localDateByReceipt.has(row.receipt_id)) {
      localDateByReceipt.set(row.receipt_id, row.occurred_on);
    }
  }
  const receiptIds = [...localDateByReceipt.keys()];
  if (receiptIds.length === 0) {
    return [];
  }

  const receiptRows = await fetchAllRows<ReceiptCandidateRow>((from, to) =>
    supabase
      .from('receipts')
      .select(RECEIPT_CANDIDATE_SELECT)
      .eq('user_id', userId)
      .in('id', receiptIds)
      .order('id', { ascending: true })
      .range(from, to),
  );

  const incomingInput: ReceiptDuplicateInput = {
    totalCents: incoming.totalCents,
    currency: incoming.currency,
    occurredOn: incoming.occurredOn,
    occurredAt: incoming.occurredAt ?? null,
    merchantId: incoming.merchantId ?? null,
    merchantName: incoming.merchantName ?? null,
    merchantLabel: incoming.merchantLabel ?? null,
    taxId: incoming.taxId ?? null,
  };

  const candidates: ReceiptDuplicateCandidate[] = [];
  for (const receipt of receiptRows) {
    const merchantName = receipt.merchant?.name ?? null;
    const occurredOn =
      localDateByReceipt.get(receipt.id) ?? incoming.occurredOn;
    const totalCents =
      receipt.total === null ? null : decimalToCents(receipt.total);

    const match = matchReceiptDuplicate(incomingInput, {
      totalCents,
      currency: receipt.currency,
      occurredOn,
      occurredAt: receipt.occurred_at,
      merchantId: receipt.merchant_id,
      merchantName,
      merchantLabel: receipt.merchant_label,
      taxId: receipt.tax_id,
    });

    if (match.isProbableDuplicate) {
      candidates.push({
        receiptId: receipt.id,
        source: receipt.source,
        merchantId: receipt.merchant_id,
        merchantName,
        merchantLabel: receipt.merchant_label,
        occurredOn,
        occurredAt: receipt.occurred_at,
        totalCents,
        currency: receipt.currency,
        match,
      });
    }
  }

  return candidates;
}
