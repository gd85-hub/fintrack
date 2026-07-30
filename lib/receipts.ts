import { supabase } from './supabase';

export type ReceiptParseError =
  | 'fetch_failed'
  | 'parse_failed'
  | 'timeout'
  | 'total_mismatch'
  | 'unsupported_url';

export type ParsedReceiptItem = {
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  vatLabel: string | null;
};

export type ParsedReceipt = {
  ok: true;
  merchantName: string;
  taxId: string | null;
  occurredAt: string;
  totalCents: number;
  currency: 'RSD';
  paymentType: string | null;
  items: ParsedReceiptItem[];
  raw?: string;
};

export type ReceiptParseFailure = {
  ok: false;
  error: ReceiptParseError;
  raw?: string;
};

export type ReceiptParseResult = ParsedReceipt | ReceiptParseFailure;

const allowedHosts = new Set([
  'suf.purs.gov.rs',
  'sandbox.suf.purs.gov.rs',
  'tap.suf.purs.gov.rs',
  'tap.sandbox.suf.purs.gov.rs',
]);

const knownErrors = new Set<ReceiptParseError>([
  'fetch_failed',
  'parse_failed',
  'timeout',
  'total_mismatch',
  'unsupported_url',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseItem(value: unknown): ParsedReceiptItem | null {
  if (!isObject(value)) {
    return null;
  }
  const { name, quantity, unitPriceCents, lineTotalCents, vatLabel } = value;
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    !isFiniteNumber(quantity) ||
    quantity <= 0 ||
    !isFiniteNumber(unitPriceCents) ||
    !Number.isInteger(unitPriceCents) ||
    !isFiniteNumber(lineTotalCents) ||
    !Number.isInteger(lineTotalCents) ||
    (vatLabel !== null && typeof vatLabel !== 'string')
  ) {
    return null;
  }
  return {
    name: name.trim(),
    quantity,
    unitPriceCents,
    lineTotalCents,
    vatLabel,
  };
}

function validateResult(value: unknown): ReceiptParseResult {
  if (!isObject(value) || typeof value.ok !== 'boolean') {
    return { ok: false, error: 'parse_failed' };
  }

  const raw = typeof value.raw === 'string' ? value.raw : undefined;
  if (!value.ok) {
    const error =
      typeof value.error === 'string' &&
      knownErrors.has(value.error as ReceiptParseError)
        ? (value.error as ReceiptParseError)
        : 'parse_failed';
    return { ok: false, error, ...(raw ? { raw } : {}) };
  }

  const items = Array.isArray(value.items)
    ? value.items.map(parseItem).filter((item) => item !== null)
    : [];
  if (
    typeof value.merchantName !== 'string' ||
    !value.merchantName.trim() ||
    (value.taxId !== null && typeof value.taxId !== 'string') ||
    typeof value.occurredAt !== 'string' ||
    !value.occurredAt.trim() ||
    !isFiniteNumber(value.totalCents) ||
    !Number.isInteger(value.totalCents) ||
    value.currency !== 'RSD' ||
    (value.paymentType !== null && typeof value.paymentType !== 'string') ||
    items.length === 0
  ) {
    return { ok: false, error: 'parse_failed', ...(raw ? { raw } : {}) };
  }

  return {
    ok: true,
    merchantName: value.merchantName.trim(),
    taxId: value.taxId,
    occurredAt: value.occurredAt,
    totalCents: value.totalCents,
    currency: 'RSD',
    paymentType: value.paymentType,
    items,
    ...(raw ? { raw } : {}),
  };
}

export function isSupportedReceiptUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return (
      url.protocol === 'https:' &&
      allowedHosts.has(url.hostname.toLowerCase()) &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname === '/v/' &&
      Boolean(url.searchParams.get('vl')?.trim())
    );
  } catch {
    return false;
  }
}

export async function parseReceiptUrl(
  url: string,
  debug = false,
): Promise<ReceiptParseResult> {
  if (!isSupportedReceiptUrl(url)) {
    return { ok: false, error: 'unsupported_url' };
  }

  const { data, error } = await supabase.functions.invoke<unknown>(
    'parse-receipt',
    { body: { url: url.trim(), debug } },
  );
  if (error) {
    return { ok: false, error: 'fetch_failed' };
  }
  return validateResult(data);
}

export function receiptDate(occurredAt: string) {
  const match = occurredAt.match(/^(\d{4}-\d{2}-\d{2})T/u);
  if (!match) {
    throw new Error('Receipt date is invalid.');
  }
  return match[1];
}

export function receiptParseErrorMessage(error: ReceiptParseError) {
  const messages: Record<ReceiptParseError, string> = {
    fetch_failed: 'Не удалось загрузить чек. Попробуйте ещё раз.',
    parse_failed: 'Не удалось распознать данные чека.',
    timeout: 'Сервис проверки слишком долго отвечает. Попробуйте ещё раз.',
    total_mismatch: 'Сумма позиций не совпадает с итогом чека.',
    unsupported_url: 'Это не ссылка на фискальный чек SUF.',
  };
  return messages[error];
}
