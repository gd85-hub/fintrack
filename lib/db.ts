import { monthBounds } from './dates';
import { ratesForExpense } from './fx';
import {
  centsToDecimal,
  convertAll,
  type Currency,
  decimalToCents,
} from './money';
import { receiptDate, type ParsedReceipt } from './receipts';
import { supabase } from './supabase';

type CategoryQueryRow = {
  id: string;
  slug: string | null;
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
  aliases: string[];
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
  category: { emoji: string; name: string; slug: string | null } | null;
  merchant: { name: string } | null;
};

type CategoryBreakdownQueryRow = {
  category_id: string;
  amount_rsd: number | string | null;
  amount_usd: number | string | null;
  amount_eur: number | string | null;
  category: {
    emoji: string;
    name: string;
    group: string;
  };
};

type ExistingExpenseRow = {
  original_amount: number | string;
  original_currency: Currency;
  occurred_on: string;
};

export type Category = {
  id: string;
  slug: string | null;
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
  aliases: string[];
  createdAt: string;
};

export type Expense = {
  id: string;
  occurredOn: string;
  description: string;
  categoryId: string;
  categoryEmoji: string;
  categoryName: string;
  categorySlug: string | null;
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

export type CategoryBreakdown = {
  categoryId: string;
  emoji: string;
  name: string;
  group: string;
  totalRsd: number;
  totalUsd: number;
  totalEur: number;
  count: number;
};

export type MonthlyCategoryBreakdown = {
  categories: CategoryBreakdown[];
  totalRsd: number;
  totalUsd: number;
  totalEur: number;
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

export type FiscalReceiptExpenseInput = {
  amountCents: number;
  categoryId: string;
  description: string;
};

export type FiscalReceiptMerchantInput =
  | { existingId: string }
  | { name: string; typeId: string };

export type SaveFiscalReceiptInput = {
  receipt: ParsedReceipt;
  merchant: FiscalReceiptMerchantInput;
  expenses: FiscalReceiptExpenseInput[];
};

function mapExpense(row: ExpenseQueryRow): Expense {
  return {
    id: row.id,
    occurredOn: row.occurred_on,
    description: row.description,
    categoryId: row.category_id,
    categoryEmoji: row.category?.emoji ?? '',
    categoryName: row.category?.name ?? '',
    categorySlug: row.category?.slug ?? null,
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
    .select('id,slug,emoji,name,group,sort')
    .eq('active', true)
    .order('sort', { ascending: true });

  if (error) {
    throw error;
  }

  return (data as unknown as CategoryQueryRow[]).map((row) => ({
    id: row.id,
    slug: row.slug,
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
    .select('id,name,type_id,aliases,created_at')
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data as unknown as MerchantQueryRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    typeId: row.type_id,
    aliases: row.aliases,
    createdAt: row.created_at,
  }));
}

export async function createMerchant(
  name: string,
  typeId: string,
  aliases: string[] = [],
): Promise<Merchant> {
  const userId = await authenticatedUserId();
  const { data, error } = await supabase
    .from('merchants')
    .insert({
      user_id: userId,
      name: name.trim(),
      type_id: typeId,
      aliases,
    })
    .select('id,name,type_id,aliases,created_at')
    .single();

  if (error) {
    throw error;
  }

  const row = data as unknown as MerchantQueryRow;
  return {
    id: row.id,
    name: row.name,
    typeId: row.type_id,
    aliases: row.aliases,
    createdAt: row.created_at,
  };
}

const EXPENSE_SELECT =
  'id,occurred_on,description,category_id,merchant_id,original_amount,original_currency,amount_rsd,amount_usd,amount_eur,fx_rate_date,note,created_at,category:categories!expenses_category_id_fkey(emoji,name,slug),merchant:merchants!expenses_merchant_id_fkey(name)';

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

export async function categoryBreakdownByMonth(
  yyyyMm: string,
): Promise<MonthlyCategoryBreakdown> {
  const { first, last } = monthBounds(yyyyMm);
  const { data, error } = await supabase
    .from('expenses')
    .select(
      'category_id,amount_rsd,amount_usd,amount_eur,category:categories!expenses_category_id_fkey(emoji,name,group)',
    )
    .gte('occurred_on', first)
    .lte('occurred_on', last);

  if (error) {
    throw error;
  }

  const categories = new Map<string, CategoryBreakdown>();
  let totalRsd = 0;
  let totalUsd = 0;
  let totalEur = 0;

  for (const row of data as unknown as CategoryBreakdownQueryRow[]) {
    const amountRsd = decimalToCents(row.amount_rsd);
    const amountUsd = decimalToCents(row.amount_usd);
    const amountEur = decimalToCents(row.amount_eur);
    totalRsd += amountRsd;
    totalUsd += amountUsd;
    totalEur += amountEur;

    const current = categories.get(row.category_id);
    if (current) {
      current.totalRsd += amountRsd;
      current.totalUsd += amountUsd;
      current.totalEur += amountEur;
      current.count += 1;
      continue;
    }

    categories.set(row.category_id, {
      categoryId: row.category_id,
      emoji: row.category.emoji,
      name: row.category.name,
      group: row.category.group,
      totalRsd: amountRsd,
      totalUsd: amountUsd,
      totalEur: amountEur,
      count: 1,
    });
  }

  return {
    categories: [...categories.values()],
    totalRsd,
    totalUsd,
    totalEur,
  };
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

function receiptPayloadWithoutRaw(receipt: ParsedReceipt) {
  const {
    raw: _raw,
    merchantName,
    taxId,
    occurredAt,
    totalCents,
    currency,
    paymentType,
    items,
  } = receipt;
  return {
    ok: true,
    merchantName,
    taxId,
    occurredAt,
    totalCents,
    currency,
    paymentType,
    items,
  };
}

export async function saveFiscalReceipt(
  input: SaveFiscalReceiptInput,
): Promise<void> {
  if (input.expenses.length === 0) {
    throw new Error('Выберите хотя бы одну позицию чека.');
  }

  const occurredOn = receiptDate(input.receipt.occurredAt);
  const userId = await authenticatedUserId();
  let merchantId: string;

  if ('existingId' in input.merchant) {
    merchantId = input.merchant.existingId;
  } else {
    const merchantName = input.merchant.name.trim();
    if (!merchantName || !input.merchant.typeId) {
      throw new Error('Укажите название и тип места.');
    }
    const originalName = input.receipt.merchantName.trim();
    const aliases =
      originalName.localeCompare(merchantName, undefined, {
        sensitivity: 'accent',
      }) === 0
        ? []
        : [originalName];
    const { data, error } = await supabase
      .from('merchants')
      .insert({
        user_id: userId,
        name: merchantName,
        type_id: input.merchant.typeId,
        aliases,
      })
      .select('id')
      .single();
    if (error) {
      throw error;
    }
    const row = data as unknown as { id: string };
    merchantId = row.id;
  }

  const rates = await ratesForExpense(occurredOn);
  let receiptId: string | null = null;

  try {
    const { data, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        user_id: userId,
        source: 'fiscal_qr',
        merchant_id: merchantId,
        tax_id: input.receipt.taxId,
        occurred_at: input.receipt.occurredAt,
        total: centsToDecimal(input.receipt.totalCents),
        currency: input.receipt.currency,
        payment_type: input.receipt.paymentType,
        raw_json: receiptPayloadWithoutRaw(input.receipt),
        parsed_ok: true,
      })
      .select('id')
      .single();
    if (receiptError) {
      throw receiptError;
    }
    const receiptRow = data as unknown as { id: string };
    receiptId = receiptRow.id;

    const expenseRows = input.expenses.map((expense) => {
      const converted = convertAll(
        expense.amountCents,
        'RSD',
        rates.usdRsd,
        rates.eurRsd,
      );
      return {
        user_id: userId,
        occurred_on: occurredOn,
        occurred_at: input.receipt.occurredAt,
        description: expense.description.trim(),
        category_id: expense.categoryId,
        merchant_id: merchantId,
        original_amount: centsToDecimal(expense.amountCents),
        original_currency: 'RSD',
        amount_rsd: centsToDecimal(converted.rsd),
        amount_usd: centsToDecimal(converted.usd),
        amount_eur: centsToDecimal(converted.eur),
        fx_rate_date: rates.date,
        note: null,
        source: 'fiscal_qr',
        receipt_id: receiptId,
      };
    });
    const { error: expensesError } = await supabase
      .from('expenses')
      .insert(expenseRows);
    if (expensesError) {
      throw expensesError;
    }
  } catch (error: unknown) {
    if (receiptId) {
      const { error: cleanupExpensesError } = await supabase
        .from('expenses')
        .delete()
        .eq('receipt_id', receiptId);
      if (cleanupExpensesError) {
        console.error(
          'Unable to clean up receipt expenses:',
          cleanupExpensesError.message,
        );
      }
      const { error: cleanupReceiptError } = await supabase
        .from('receipts')
        .delete()
        .eq('id', receiptId);
      if (cleanupReceiptError) {
        console.error(
          'Unable to clean up receipt:',
          cleanupReceiptError.message,
        );
      }
    }
    throw error;
  }
}
