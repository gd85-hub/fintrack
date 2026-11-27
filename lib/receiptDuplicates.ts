import { parseLocalISO } from './dates';
import { isPositiveCents, normalizeCurrencyCode } from './money';
import { normalizeMerchantName } from './receipts';

// Deterministic, conservative detection of a probable duplicate receipt — the
// case where the same physical purchase is added twice (e.g. once by fiscal QR
// and once by photo OCR). This module is pure matching logic only: candidate
// retrieval, the save-flow preflight and the user-facing warning are DUP-02.
//
// It never converts currency, never guesses missing metadata, and never treats
// a null field as a positive match. A match requires the fields that identify a
// purchase to agree; extra timestamp/tax-id evidence can only strengthen or
// block a match, never create one on its own.

// Minimal shape both an incoming receipt and an existing candidate are mapped
// into. Only fields that are available or realistically derivable from the
// current receipt contract are used; a stable fiscal receipt number is not part
// of that contract and is deliberately absent.
export type ReceiptDuplicateInput = {
  // Original receipt total in integer cents.
  totalCents: number | null;
  // Original receipt currency (any valid ISO code, including custom ones).
  currency: string | null;
  // Local calendar purchase date, 'YYYY-MM-DD'. May be null for an OCR draft.
  occurredOn: string | null;
  // Exact purchase timestamp (ISO 8601 with offset), when available — fiscal QR
  // provides it; photo OCR usually does not.
  occurredAt?: string | null;
  // Stored merchant id, when the receipt is already linked to one.
  merchantId?: string | null;
  // Merchant display name and/or the original printed receipt label, compared
  // through the shared merchant-name normalization.
  merchantName?: string | null;
  merchantLabel?: string | null;
  // Fiscal tax id, when printed/read.
  taxId?: string | null;
};

export type ReceiptDuplicateEvidence = {
  // Required signals (all must be true for any match).
  total: boolean;
  currency: boolean;
  date: boolean;
  // Merchant identity matched by stored id and/or normalized name.
  merchantId: boolean;
  merchantName: boolean;
  // Strengthening signals.
  timestamp: boolean;
  taxId: boolean;
  // Blocking signals: known values that disagree.
  taxIdConflict: boolean;
  timestampConflict: boolean;
};

export type ReceiptDuplicateConfidence = 'confirmed' | 'probable' | 'none';

export type ReceiptDuplicateMatch = {
  isProbableDuplicate: boolean;
  confidence: ReceiptDuplicateConfidence;
  evidence: ReceiptDuplicateEvidence;
};

// Same physical receipt carries the same timestamp to the second, so comparison
// is on the parsed instant. A narrow 60-second window only absorbs sub-minute
// formatting/rounding differences between two representations of the same
// instant; two genuinely distinct purchases at the same merchant for the exact
// same total would realistically be minutes apart, so this never merges them.
const TIMESTAMP_TOLERANCE_MS = 60_000;

function matchingPositiveCents(
  a: number | null,
  b: number | null,
): boolean {
  return (
    a !== null &&
    b !== null &&
    isPositiveCents(a) &&
    isPositiveCents(b) &&
    a === b
  );
}

function matchingCurrency(
  a: string | null,
  b: string | null,
): boolean {
  if (a === null || b === null) {
    return false;
  }
  const normalizedA = normalizeCurrencyCode(a);
  const normalizedB = normalizeCurrencyCode(b);
  return normalizedA !== null && normalizedA === normalizedB;
}

// Resolves the local calendar date without any UTC shift: the already-local
// `occurredOn` when valid, otherwise the literal date prefix of the offset-
// carrying timestamp (never `new Date(iso).toISOString()`).
function resolveLocalDate(input: ReceiptDuplicateInput): string | null {
  if (input.occurredOn && parseLocalISO(input.occurredOn)) {
    return input.occurredOn;
  }
  if (input.occurredAt) {
    const match = /^(\d{4}-\d{2}-\d{2})T/u.exec(input.occurredAt);
    if (match && parseLocalISO(match[1])) {
      return match[1];
    }
  }
  return null;
}

function normalizedMerchant(input: ReceiptDuplicateInput): string | null {
  const source = input.merchantName ?? input.merchantLabel ?? '';
  const key = normalizeMerchantName(source);
  return key ? key : null;
}

function nonEmptyEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const trimmedA = a?.trim();
  const trimmedB = b?.trim();
  return Boolean(trimmedA) && trimmedA === trimmedB;
}

function normalizeTaxId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseInstant(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

// Compares two receipts and reports whether they are a probable duplicate.
// Symmetric: the order of the arguments does not change the result, so it works
// regardless of whether the QR or the OCR receipt was saved first.
export function matchReceiptDuplicate(
  incoming: ReceiptDuplicateInput,
  candidate: ReceiptDuplicateInput,
): ReceiptDuplicateMatch {
  const total = matchingPositiveCents(
    incoming.totalCents,
    candidate.totalCents,
  );
  const currency = matchingCurrency(incoming.currency, candidate.currency);

  const incomingDate = resolveLocalDate(incoming);
  const candidateDate = resolveLocalDate(candidate);
  const date = incomingDate !== null && incomingDate === candidateDate;

  const merchantId = nonEmptyEqual(incoming.merchantId, candidate.merchantId);
  const incomingMerchant = normalizedMerchant(incoming);
  const merchantName =
    incomingMerchant !== null &&
    incomingMerchant === normalizedMerchant(candidate);
  const merchant = merchantId || merchantName;

  const incomingTaxId = normalizeTaxId(incoming.taxId);
  const candidateTaxId = normalizeTaxId(candidate.taxId);
  const taxId = incomingTaxId !== null && incomingTaxId === candidateTaxId;
  const taxIdConflict =
    incomingTaxId !== null &&
    candidateTaxId !== null &&
    incomingTaxId !== candidateTaxId;

  const incomingInstant = parseInstant(incoming.occurredAt);
  const candidateInstant = parseInstant(candidate.occurredAt);
  const bothInstants =
    incomingInstant !== null && candidateInstant !== null;
  const timestamp =
    bothInstants &&
    Math.abs((incomingInstant as number) - (candidateInstant as number)) <=
      TIMESTAMP_TOLERANCE_MS;
  const timestampConflict = bothInstants && !timestamp;

  const evidence: ReceiptDuplicateEvidence = {
    total,
    currency,
    date,
    merchantId,
    merchantName,
    timestamp,
    taxId,
    taxIdConflict,
    timestampConflict,
  };

  const requiredMet = total && currency && date && merchant;
  const blocked = taxIdConflict || timestampConflict;

  if (!requiredMet || blocked) {
    return { isProbableDuplicate: false, confidence: 'none', evidence };
  }

  // A matching exact timestamp is the strongest deterministic identity signal
  // available (there is no fiscal receipt number in the contract). Without it —
  // e.g. a date-only OCR receipt matched against a QR one — the match is only
  // probable, never confirmed.
  return {
    isProbableDuplicate: true,
    confidence: timestamp ? 'confirmed' : 'probable',
    evidence,
  };
}
