import {
  manipulateAsync,
  SaveFormat,
  type Action,
} from 'expo-image-manipulator';

import type { Category, MerchantType } from './db';
import { parseLocalISO } from './dates';
import type { ParsedReceipt } from './receipts';
import { supabase } from './supabase';

export const maximumReceiptImages = 5;
export const maximumReceiptImageBytes = 5 * 1024 * 1024;
const maximumImageLongEdge = 1600;
const receiptImageQuality = 0.7;

export type ReceiptImageSource = {
  height: number;
  uri: string;
  width: number;
};

export type ReceiptImageAnalysisError =
  | 'bad_input'
  | 'openai_error'
  | 'parse_failed'
  | 'unreadable';

export type ReceiptImageAnalysisItem = {
  name: string;
  rawName?: string | null;
  quantity: number | null;
  unitPriceCents: number | null;
  lineTotalCents: number;
  categoryName: string | null;
};

export type ReceiptImageAnalysisSuccess = {
  ok: true;
  merchantName: string | null;
  merchantTypeSlug: string | null;
  occurredOn: string | null;
  currency: string | null;
  totalCents: number | null;
  items: ReceiptImageAnalysisItem[];
  confidence: 'high' | 'medium' | 'low';
  totalsMismatch?: boolean;
  raw?: string;
};

export type ReceiptImageAnalysisFailure = {
  ok: false;
  error: ReceiptImageAnalysisError;
};

export type ReceiptImageAnalysisResult =
  | ReceiptImageAnalysisSuccess
  | ReceiptImageAnalysisFailure;

const knownErrors = new Set<ReceiptImageAnalysisError>([
  'bad_input',
  'openai_error',
  'parse_failed',
  'unreadable',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function nullablePositiveNumber(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  return undefined;
}

function nullableCents(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  return isSafeNonNegativeInteger(value) ? value : undefined;
}

function validateAnalysisItem(
  value: unknown,
): ReceiptImageAnalysisItem | null {
  if (!isObject(value)) {
    return null;
  }
  const quantity = nullablePositiveNumber(value.quantity);
  const unitPriceCents = nullableCents(value.unitPriceCents);
  const rawName =
    value.rawName === undefined
      ? undefined
      : value.rawName === null
        ? null
        : typeof value.rawName === 'string'
          ? value.rawName.trim() || null
          : undefined;
  if (
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    quantity === undefined ||
    unitPriceCents === undefined ||
    !isSafeNonNegativeInteger(value.lineTotalCents) ||
    (value.rawName !== undefined && rawName === undefined) ||
    (value.categoryName !== null &&
      typeof value.categoryName !== 'string')
  ) {
    return null;
  }
  return {
    name: value.name.trim(),
    ...(rawName !== undefined ? { rawName } : {}),
    quantity,
    unitPriceCents,
    lineTotalCents: value.lineTotalCents,
    categoryName:
      typeof value.categoryName === 'string'
        ? value.categoryName.trim() || null
        : null,
  };
}

export function validateReceiptImageAnalysis(
  value: unknown,
): ReceiptImageAnalysisResult {
  if (!isObject(value) || typeof value.ok !== 'boolean') {
    return { ok: false, error: 'parse_failed' };
  }
  if (!value.ok) {
    return {
      ok: false,
      error:
        typeof value.error === 'string' &&
        knownErrors.has(value.error as ReceiptImageAnalysisError)
          ? (value.error as ReceiptImageAnalysisError)
          : 'parse_failed',
    };
  }

  const items = Array.isArray(value.items)
    ? value.items
        .map(validateAnalysisItem)
        .filter((item) => item !== null)
    : [];
  const occurredOn =
    value.occurredOn === null ||
    (typeof value.occurredOn === 'string' &&
      parseLocalISO(value.occurredOn))
      ? value.occurredOn
      : undefined;
  const currency =
    value.currency === null ||
    (typeof value.currency === 'string' &&
      /^[A-Z]{3}$/u.test(value.currency))
      ? value.currency
      : undefined;
  const totalCents = nullableCents(value.totalCents);
  if (
    (value.merchantName !== null &&
      typeof value.merchantName !== 'string') ||
    (value.merchantTypeSlug !== null &&
      typeof value.merchantTypeSlug !== 'string') ||
    occurredOn === undefined ||
    currency === undefined ||
    totalCents === undefined ||
    !['high', 'medium', 'low'].includes(String(value.confidence)) ||
    items.length === 0
  ) {
    return { ok: false, error: 'parse_failed' };
  }

  return {
    ok: true,
    merchantName:
      typeof value.merchantName === 'string'
        ? value.merchantName.trim() || null
        : null,
    merchantTypeSlug:
      typeof value.merchantTypeSlug === 'string'
        ? value.merchantTypeSlug.trim() || null
        : null,
    occurredOn,
    currency,
    totalCents,
    items,
    confidence: value.confidence as 'high' | 'medium' | 'low',
    ...(value.totalsMismatch === true ? { totalsMismatch: true } : {}),
    ...(typeof value.raw === 'string' ? { raw: value.raw } : {}),
  };
}

function approximateBase64Bytes(value: string) {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

export async function compressReceiptImages(
  sources: readonly ReceiptImageSource[],
) {
  if (sources.length === 0 || sources.length > maximumReceiptImages) {
    throw new Error('bad_input');
  }

  return Promise.all(
    sources.map(async (source) => {
      if (
        !source.uri ||
        !Number.isFinite(source.width) ||
        !Number.isFinite(source.height) ||
        source.width <= 0 ||
        source.height <= 0
      ) {
        throw new Error('bad_input');
      }
      const longEdge = Math.max(source.width, source.height);
      const actions: Action[] =
        longEdge > maximumImageLongEdge
          ? [
              {
                resize:
                  source.width >= source.height
                    ? { width: maximumImageLongEdge }
                    : { height: maximumImageLongEdge },
              },
            ]
          : [];
      const result = await manipulateAsync(source.uri, actions, {
        base64: true,
        compress: receiptImageQuality,
        format: SaveFormat.JPEG,
      });
      if (
        !result.base64 ||
        approximateBase64Bytes(result.base64) > maximumReceiptImageBytes
      ) {
        throw new Error('bad_input');
      }
      return result.base64;
    }),
  );
}

export async function analyzeReceiptImages(
  images: readonly string[],
  categories: readonly Category[],
  merchantTypes: readonly MerchantType[],
): Promise<ReceiptImageAnalysisResult> {
  if (images.length === 0 || images.length > maximumReceiptImages) {
    return { ok: false, error: 'bad_input' };
  }
  try {
    const { data, error } = await supabase.functions.invoke<unknown>(
      'analyze-receipt-image',
      {
        body: {
          images,
          categories: categories.map(({ id, name }) => ({ id, name })),
          merchantTypes: merchantTypes.map(({ slug, name }) => ({
            slug,
            name,
          })),
        },
      },
    );
    if (error) {
      return { ok: false, error: 'openai_error' };
    }
    return validateReceiptImageAnalysis(data);
  } catch {
    return { ok: false, error: 'openai_error' };
  }
}

export function receiptFromImageAnalysis(
  analysis: ReceiptImageAnalysisSuccess,
): ParsedReceipt | null {
  if (!analysis.occurredOn || !analysis.currency) {
    return null;
  }
  return {
    ok: true,
    source: 'ocr_photo',
    merchantName: analysis.merchantName ?? '',
    merchantTypeSlug: analysis.merchantTypeSlug,
    taxId: null,
    occurredAt: null,
    occurredOn: analysis.occurredOn,
    totalCents:
      analysis.totalCents ??
      analysis.items.reduce((sum, item) => sum + item.lineTotalCents, 0),
    currency: analysis.currency,
    paymentType: null,
    items: analysis.items.map((item) => ({
      ...item,
      vatLabel: null,
    })),
    confidence: analysis.confidence,
    ...(analysis.totalsMismatch ? { totalsMismatch: true } : {}),
    ...(analysis.raw ? { raw: analysis.raw } : {}),
  };
}

export function receiptImageErrorMessage(error: ReceiptImageAnalysisError) {
  const messages: Record<ReceiptImageAnalysisError, string> = {
    bad_input:
      'Выберите от одного до пяти изображений JPG или PNG размером до 5 МБ.',
    openai_error:
      'Не удалось распознать чек. Проверьте соединение и попробуйте ещё раз.',
    parse_failed: 'Не удалось прочитать ответ распознавания.',
    unreadable:
      'На изображении не удалось уверенно прочитать позиции чека.',
  };
  return messages[error];
}
