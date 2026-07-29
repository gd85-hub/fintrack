import { monthBounds } from './dates';
import { ratesForExpense } from './fx';
import {
  centsToDecimal,
  convertAll,
  type Currency,
  decimalToCents,
} from './money';
import { supabase } from './supabase';

type CategoryQueryRow = {
  id: string;
  emoji: string;
  name: string;
  group: string;
  sort: number;
};

type MerchantTypeQueryRow = {
  id: string;
  emoji: string;
  name: string;
  slug: string;
  sort: number;
};

type MerchantQueryRow = {
  id: string;
  name: string;
  type_id: string | null;
  created_at: string;
};

type ExpenseQueryRow = {
  id: string;
  occurred_on: string;
  description: string;
  category_id: string;
  merchant_id: string | null;
  original_amount: number | string;
  original_currency: Currency;
  amount_rsd: number | string | null;
  amount_usd: number | string | null;
  amount_eur: number | string | null;
  fx_rate_date: string | null;
  note: string | null;
  created_at: string;
  category: { emoji: string; name: string } | null;
  merchant: { name: string } | null;
};

type ExistingExpenseRow = {
  original_amount: number | string;
  original_currency: Currency;
  occurred_on: string;
};

export type Category = {
  id: string;
  emoji: string;
  name: string;
  group: string;
  sort: number;
};

export type MerchantType = {
  id: string;
  emoji: string;
  name: string;
  slug: string;
  sort: number;
};

export type Merchant = {
  id: string;
  name: string;
  typeId: string | null;
  createdAt: string;
};

export type Expense = {
  id: string;
  occurredOn: string;
  description: string;
  categoryId: string;
  categoryEmoji: string;
  categoryName: string;
  merchantId: string | null;
  merchantName: string | null;
  originalAmountCents: number;
  originalCurrency: Currency;
  amountRsdCents: number;
  amountUsdCents: number;
  amountEurCents: number;
  fxRateDate: string | null;
  note: string;
  createdAt: string;
};

export type ExpenseInput = {
  amountCents: number;
  currency: Currency;
  categoryId: string;
  merchantId: string | null;
  occurredOn: string;
  description: string;
  note: string;
};

function mapExpense(row: ExpenseQueryRow): Expense {
  return {
    id: row.id,
    occurredOn: row.occurred_on,
    description: row.description,
    categoryId: row.category_id,
    categoryEmoji: row.category?.emoji ?? '',
    categoryName: row.category?.name ?? '',
    merchantId: row.merchant_id,
    merchantName: row.merchant?.name ?? null,
    originalAmountCents: decimalToCents(row.original_amount),
    originalCurrency: row.original_currency,
    amountRsdCents: decimalToCents(row.amount_rsd),
    amountUsdCents: decimalToCents(row.amount_usd),
    amountEurCents: decimalToCents(row.amount_eur),
    fxRateDate: row.fx_rate_date,
    note: row.note ?? '',
    createdAt: row.created_at,
  };
}

async function authenticatedUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Требуется вход в аккаунт.');
  }

  return session.user.id;
}

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id,emoji,name,group,sort')
    .eq('active', true)
    .order('sort', { ascending: true });

  if (error) {
    throw error;
  }

  return (data as unknown as CategoryQueryRow[]).map((row) => ({
    id: row.id,
    emoji: row.emoji,
    name: row.name,
    group: row.group,
    sort: row.sort,
  }));
}

export async function listMerchantTypes(): Promise<MerchantType[]> {
  const { data, error } = await supabase
    .from('merchant_types')
    .select('id,emoji,name,slug,sort')
    .eq('active', true)
    .order('sort', { ascending: true });

  if (error) {
    throw error;
  }

  return (data as unknown as MerchantTypeQueryRow[]).map((row) => ({
    id: row.id,
    emoji: row.emoji,
    name: row.name,
    slug: row.slug,
    sort: row.sort,
  }));
}

export async function listMerchants(): Promise<Merchant[]> {
  const { data, error } = await supabase
    .from('merchants')
    .select('id,name,type_id,created_at')
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data as unknown as MerchantQueryRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    typeId: row.type_id,
    createdAt: row.created_at,
  }));
}

export async function createMerchant(
  name: string,
  typeId: string,
): Promise<Merchant> {
  const userId = await authenticatedUserId();
  const { data, error } = await supabase
    .from('merchants')
    .insert({
      user_id: userId,
      name: name.trim(),
      type_id: typeId,
    })
    .select('id,name,type_id,created_at')
    .single();

  if (error) {
    throw error;
  }

  const row = data as unknown as MerchantQueryRow;
  return {
    id: row.id,
    name: row.name,
    typeId: row.type_id,
    createdAt: row.created_at,
  };
}

const EXPENSE_SELECT =
  'id,occurred_on,description,category_id,merchant_id,original_amount,original_currency,amount_rsd,amount_usd,amount_eur,fx_rate_date,note,created_at,category:categories!expenses_category_id_fkey(emoji,name),merchant:merchants!expenses_merchant_id_fkey(name)';

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

async function conversionPayload(input: ExpenseInput) {
  const rates = await ratesForExpense(input.occurredOn);
  const converted = convertAll(
    input.amountCents,
    input.currency,
    rates.usdRsd,
    rates.eurRsd,
  );

  return {
    amount_rsd: centsToDecimal(converted.rsd),
    amount_usd: centsToDecimal(converted.usd),
    amount_eur: centsToDecimal(converted.eur),
    fx_rate_date: rates.date,
  };
}

export async function insertExpense(input: ExpenseInput): Promise<void> {
  const [userId, converted] = await Promise.all([
    authenticatedUserId(),
    conversionPayload(input),
  ]);

  const { error } = await supabase.from('expenses').insert({
    user_id: userId,
    occurred_on: input.occurredOn,
    description: input.description.trim(),
    category_id: input.categoryId,
    merchant_id: input.merchantId,
    original_amount: centsToDecimal(input.amountCents),
    original_currency: input.currency,
    ...converted,
    note: input.note.trim() || null,
    source: 'manual',
  });

  if (error) {
    throw error;
  }
}

export async function updateExpense(
  id: string,
  input: ExpenseInput,
): Promise<void> {
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
    existing.original_currency !== input.currency ||
    existing.occurred_on !== input.occurredOn;

  const converted = conversionChanged ? await conversionPayload(input) : {};
  const { error } = await supabase
    .from('expenses')
    .update({
      occurred_on: input.occurredOn,
      description: input.description.trim(),
      category_id: input.categoryId,
      merchant_id: input.merchantId,
      original_amount: centsToDecimal(input.amountCents),
      original_currency: input.currency,
      ...converted,
      note: input.note.trim() || null,
      source: 'manual',
    })
    .eq('id', id);

  if (error) {
    throw error;
  }
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id);

  if (error) {
    throw error;
  }
}
