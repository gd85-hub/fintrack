import { supabase } from './supabase';
import { parseLocalISO } from './dates';

export type ReceiptParseError =
  | 'fetch_failed'
  | 'parse_failed'
  | 'timeout'
  | 'total_mismatch'
  | 'unsupported_url';

export type ParsedReceiptItem = {
  name: string;
  rawName?: string | null;
  quantity: number | null;
  unitPriceCents: number | null;
  lineTotalCents: number;
  vatLabel: string | null;
  categoryName?: string | null;
};

export type ParsedReceipt = {
  ok: true;
  merchantName: string;
  merchantTypeSlug?: string | null;
  taxId: string | null;
  occurredAt: string | null;
  occurredOn?: string;
  totalCents: number;
  currency: string;
  paymentType: string | null;
  items: ParsedReceiptItem[];
  source?: 'fiscal_qr' | 'ocr_photo';
  confidence?: 'high' | 'medium' | 'low';
  totalsMismatch?: boolean;
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
const receiptFetchTimeoutMs = 20_000;

type MerchantNameCandidate = {
  aliases: readonly string[];
  name: string;
};

const cyrillicToLatin: Readonly<Record<string, string>> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  ѓ: 'g',
  д: 'd',
  ђ: 'dj',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'i',
  ј: 'j',
  к: 'k',
  ќ: 'k',
  л: 'l',
  љ: 'lj',
  м: 'm',
  н: 'n',
  њ: 'nj',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  ћ: 'c',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'ch',
  џ: 'dz',
  ш: 'sh',
  щ: 'shch',
  ы: 'y',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  ъ: '',
  ь: '',
};
const merchantSuffixes = new Set([
  'ad',
  'doo',
  'ltd',
  'llc',
  'market',
  'shop',
  'store',
]);

function merchantSpelling(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

function withoutMerchantSuffixes(tokens: string[]) {
  while (tokens.length > 0) {
    const last = tokens.at(-1);
    if (last && merchantSuffixes.has(last)) {
      tokens.pop();
      continue;
    }
    if (tokens.slice(-3).join(' ') === 'd o o') {
      tokens.splice(-3);
      continue;
    }
    if (tokens.slice(-2).join(' ') === 'a d') {
      tokens.splice(-2);
      continue;
    }
    break;
  }
  return tokens;
}

export function normalizeMerchantName(value: string) {
  const transliterated = merchantSpelling(value)
    .toLowerCase()
    .replace(/[\p{Script=Cyrillic}]/gu, (character) =>
      cyrillicToLatin[character] ?? character,
    );
  const tokens = transliterated
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/gu)
    .filter(Boolean);
  return withoutMerchantSuffixes(tokens).join(' ');
}

export function findMatchingMerchant<T extends MerchantNameCandidate>(
  merchants: readonly T[],
  incomingName: string,
) {
  const incomingKey = normalizeMerchantName(incomingName);
  if (!incomingKey) {
    return null;
  }
  return (
    merchants.find((merchant) =>
      [merchant.name, ...merchant.aliases].some(
        (spelling) => normalizeMerchantName(spelling) === incomingKey,
      ),
    ) ?? null
  );
}

export function merchantAliasesWithIncoming(
  merchant: MerchantNameCandidate,
  incomingName: string,
) {
  const incoming = merchantSpelling(incomingName);
  if (
    !incoming ||
    [merchant.name, ...merchant.aliases].some(
      (spelling) => merchantSpelling(spelling) === incoming,
    )
  ) {
    return [...merchant.aliases];
  }
  return [...merchant.aliases, incoming];
}

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

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    Reflect.get(error, 'name') === 'AbortError'
  );
}

export async function fetchAndParseReceipt(
  url: string,
  debug = false,
): Promise<ReceiptParseResult> {
  if (!isSupportedReceiptUrl(url)) {
    return { ok: false, error: 'unsupported_url' };
  }

  const sourceUrl = url.trim();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    receiptFetchTimeoutMs,
  );
  let html: string;

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        Accept: 'text/html',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, error: 'fetch_failed' };
    }
    html = await response.text();
  } catch (error: unknown) {
    return {
      ok: false,
      error: isAbortError(error) ? 'timeout' : 'fetch_failed',
    };
  } finally {
    clearTimeout(timeout);
  }

  try {
    const { data, error } = await supabase.functions.invoke<unknown>(
      'parse-receipt',
      { body: { html, sourceUrl, debug } },
    );
    if (error) {
      return { ok: false, error: 'fetch_failed' };
    }
    return validateResult(data);
  } catch {
    return { ok: false, error: 'fetch_failed' };
  }
}

export const parseReceiptUrl = fetchAndParseReceipt;

export function receiptDate(occurredAt: string) {
  const match = occurredAt.match(/^(\d{4}-\d{2}-\d{2})T/u);
  if (!match) {
    throw new Error('Receipt date is invalid.');
  }
  return match[1];
}

export function parsedReceiptDate(receipt: ParsedReceipt) {
  if (receipt.occurredOn && parseLocalISO(receipt.occurredOn)) {
    return receipt.occurredOn;
  }
  if (receipt.occurredAt) {
    return receiptDate(receipt.occurredAt);
  }
  throw new Error('Receipt date is invalid.');
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
