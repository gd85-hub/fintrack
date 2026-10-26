import { monthBounds } from '../dates';
import { ratesForExpense } from '../fx';
import {
  centsToDecimal,
  decimalToCents,
  isCurrency,
  normalizeCurrencyCode,
} from '../money';
import { supabase } from '../supabase';
import {
  authenticatedUserId,
  bumpMerchantUsage,
  EXPENSE_SELECT,
  mapExpense,
  receiptExpenseAmounts,
  type ExpenseQueryRow,
} from './internal';
import type { Expense, ExpenseInput } from './types';

type ExistingExpenseRow = {
  original_amount: number | string;
  original_currency: string;
  occurred_on: string;
};


export async function listExpensesByMonth(
  yyyyMm: string,
): Promise<Expense[]> {
  const { first, last } = monthBounds(yyyyMm);
  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .gte('occurred_on', first)
    .lte('occurred_on', last)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data as unknown as ExpenseQueryRow[]).map(mapExpense);
}

export async function getExpense(id: string): Promise<Expense | null> {
  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapExpense(data as unknown as ExpenseQueryRow) : null;
}

async function conversionPayload(
  input: ExpenseInput,
  currency: string,
) {
  if (!isCurrency(currency)) {
    const manualRsdCents = input.manualRsdCents ?? null;
    if (
      manualRsdCents !== null &&
      (!Number.isSafeInteger(manualRsdCents) || manualRsdCents <= 0)
    ) {
      throw new Error('Сумма в RSD должна быть больше нуля.');
    }
    return receiptExpenseAmounts(
      input.amountCents,
      currency,
      null,
      manualRsdCents,
    );
  }

  const rates = await ratesForExpense(input.occurredOn);
  return receiptExpenseAmounts(
    input.amountCents,
    currency,
    rates,
  );
}

export async function insertExpense(input: ExpenseInput): Promise<void> {
  const currency = normalizeCurrencyCode(input.currency);
  if (!currency) {
    throw new Error('Укажите трёхбуквенный код валюты.');
  }
  const [userId, converted] = await Promise.all([
    authenticatedUserId(),
    conversionPayload(input, currency),
  ]);

  const { error } = await supabase.from('expenses').insert({
    user_id: userId,
    occurred_on: input.occurredOn,
    description: input.description.trim(),
    category_id: input.categoryId,
    merchant_id: input.merchantId,
    original_amount: centsToDecimal(input.amountCents),
    original_currency: currency,
    ...converted,
    note: input.note.trim() || null,
    source: 'manual',
  });

  if (error) {
    throw error;
  }

  await bumpMerchantUsage(input.merchantId);
}

export async function updateExpense(
  id: string,
  input: ExpenseInput,
): Promise<void> {
  const currency = normalizeCurrencyCode(input.currency);
  if (!currency) {
    throw new Error('Укажите трёхбуквенный код валюты.');
  }
  const { data, error: fetchError } = await supabase
    .from('expenses')
    .select('original_amount,original_currency,occurred_on')
    .eq('id', id)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  const existing = data as unknown as ExistingExpenseRow;
  const conversionChanged =
    decimalToCents(existing.original_amount) !== input.amountCents ||
    existing.original_currency !== currency ||
    existing.occurred_on !== input.occurredOn ||
    !isCurrency(currency);

  const converted = conversionChanged
    ? await conversionPayload(input, currency)
    : {};
  const { error } = await supabase
    .from('expenses')
    .update({
      occurred_on: input.occurredOn,
      description: input.description.trim(),
      category_id: input.categoryId,
      merchant_id: input.merchantId,
      original_amount: centsToDecimal(input.amountCents),
      original_currency: currency,
      ...converted,
      note: input.note.trim() || null,
      source: 'manual',
    })
    .eq('id', id);

  if (error) {
    throw error;
  }

  await bumpMerchantUsage(input.merchantId);
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id);

  if (error) {
    throw error;
  }
}

export async function deleteReceipt(id: string): Promise<void> {
  const { error } = await supabase.from('receipts').delete().eq('id', id);

  if (error) {
    throw error;
  }
}
