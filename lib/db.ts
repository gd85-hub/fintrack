import { monthBounds } from './dates';
import { ratesForExpense, type ResolvedRates } from './fx';
import {
  centsToDecimal,
  convertAll,
  type Currency,
  decimalToCents,
  isCurrency,
} from './money';
import { parsedReceiptDate, type ParsedReceipt } from './receipts';
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
  original_currency: string;
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

type MerchantBreakdownQueryRow = {
  merchant_id: string | null;
  amount_rsd: number | string | null;
  amount_usd: number | string | null;
  amount_eur: number | string | null;
  merchant: {
    name: string;
    type_id: string | null;
    type: {
      emoji: string;
      name: string;
      sort: number;
    } | null;
  } | null;
};

type AnalyticsExpenseQueryRow = {
  id: string;
  occurred_on: string;
  created_at: string;
  description: string;
  category_id: string;
  merchant_id: string | null;
  amount_rsd: number | string | null;
  amount_usd: number | string | null;
  amount_eur: number | string | null;
  category: {
    emoji: string;
    name: string;
    type: ExpenseCategoryType;
  };
  merchant: { name: string } | null;
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
  originalCurrency: string;
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

export type MerchantBreakdown = {
  merchantId: string | null;
  name: string;
  totalRsd: number;
  totalUsd: number;
  totalEur: number;
  count: number;
};

export type MerchantTypeBreakdown = {
  typeId: string | null;
  emoji: string;
  typeName: string;
  totalRsd: number;
  totalUsd: number;
  totalEur: number;
  count: number;
  merchants: MerchantBreakdown[];
};

export type MonthlyMerchantBreakdown = {
  types: MerchantTypeBreakdown[];
  totalRsd: number;
  totalUsd: number;
  totalEur: number;
};

export type ExpenseCategoryType = 'fixed' | 'variable';

export type AnalyticsExpense = {
  id: string;
  occurredOn: string;
  createdAt: string;
  description: string;
  categoryId: string;
  categoryEmoji: string;
  categoryName: string;
  categoryType: ExpenseCategoryType;
  merchantId: string | null;
  merchantName: string | null;
  amountRsd: number;
  amountUsd: number;
  amountEur: number;
};

export type FixedVariableCategoryBreakdown = {
  categoryId: string;
  emoji: string;
  name: string;
  totalRsd: number;
  totalUsd: number;
  totalEur: number;
  count: number;
};

export type FixedVariableBucketBreakdown = {
  type: ExpenseCategoryType;
  categories: FixedVariableCategoryBreakdown[];
  totalRsd: number;
  totalUsd: number;
  totalEur: number;
  count: number;
};

export type MonthlyFixedVariableBreakdown = {
  buckets: FixedVariableBucketBreakdown[];
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

export async function merchantBreakdownByMonth(
  yyyyMm: string,
): Promise<MonthlyMerchantBreakdown> {
  const { first, last } = monthBounds(yyyyMm);
  const { data, error } = await supabase
    .from('expenses')
    .select(
      'merchant_id,amount_rsd,amount_usd,amount_eur,merchant:merchants!expenses_merchant_id_fkey(name,type_id,type:merchant_types!merchants_type_id_fkey(emoji,name,sort))',
    )
    .gte('occurred_on', first)
    .lte('occurred_on', last);

  if (error) {
    throw error;
  }

  type MutableTypeBreakdown = Omit<
    MerchantTypeBreakdown,
    'merchants'
  > & {
    merchants: Map<string, MerchantBreakdown>;
  };

  const types = new Map<string, MutableTypeBreakdown>();
  let totalRsd = 0;
  let totalUsd = 0;
  let totalEur = 0;

  for (const row of data as unknown as MerchantBreakdownQueryRow[]) {
    const amountRsd = decimalToCents(row.amount_rsd);
    const amountUsd = decimalToCents(row.amount_usd);
    const amountEur = decimalToCents(row.amount_eur);
    totalRsd += amountRsd;
    totalUsd += amountUsd;
    totalEur += amountEur;

    const typeId = row.merchant?.type_id ?? null;
    const typeKey = typeId ?? 'unknown';
    const merchantId = row.merchant_id;
    const merchantKey = merchantId ?? 'unknown';
    let type = types.get(typeKey);

    if (!type) {
      type = {
        typeId,
        emoji: row.merchant?.type?.emoji ?? '📍',
        typeName: row.merchant?.type?.name ?? 'Место не определено',
        totalRsd: 0,
        totalUsd: 0,
        totalEur: 0,
        count: 0,
        merchants: new Map<string, MerchantBreakdown>(),
      };
      types.set(typeKey, type);
    }

    type.totalRsd += amountRsd;
    type.totalUsd += amountUsd;
    type.totalEur += amountEur;
    type.count += 1;

    const merchant = type.merchants.get(merchantKey);
    if (merchant) {
      merchant.totalRsd += amountRsd;
      merchant.totalUsd += amountUsd;
      merchant.totalEur += amountEur;
      merchant.count += 1;
      continue;
    }

    type.merchants.set(merchantKey, {
      merchantId,
      name: row.merchant?.name ?? 'Без места',
      totalRsd: amountRsd,
      totalUsd: amountUsd,
      totalEur: amountEur,
      count: 1,
    });
  }

  return {
    types: [...types.values()].map(({ merchants, ...type }) => ({
      ...type,
      merchants: [...merchants.values()],
    })),
    totalRsd,
    totalUsd,
    totalEur,
  };
}

export function buildFixedVariableBreakdown(
  expenses: readonly AnalyticsExpense[],
): MonthlyFixedVariableBreakdown {
  const buckets: Record<
    ExpenseCategoryType,
    FixedVariableBucketBreakdown
  > = {
    fixed: {
      type: 'fixed',
      categories: [],
      totalRsd: 0,
      totalUsd: 0,
      totalEur: 0,
      count: 0,
    },
    variable: {
      type: 'variable',
      categories: [],
      totalRsd: 0,
      totalUsd: 0,
      totalEur: 0,
      count: 0,
    },
  };
  const categories: Record<
    ExpenseCategoryType,
    Map<string, FixedVariableCategoryBreakdown>
  > = {
    fixed: new Map(),
    variable: new Map(),
  };
  let totalRsd = 0;
  let totalUsd = 0;
  let totalEur = 0;

  for (const expense of expenses) {
    const bucket = buckets[expense.categoryType];
    bucket.totalRsd += expense.amountRsd;
    bucket.totalUsd += expense.amountUsd;
    bucket.totalEur += expense.amountEur;
    bucket.count += 1;
    totalRsd += expense.amountRsd;
    totalUsd += expense.amountUsd;
    totalEur += expense.amountEur;

    const current = categories[expense.categoryType].get(
      expense.categoryId,
    );
    if (current) {
      current.totalRsd += expense.amountRsd;
      current.totalUsd += expense.amountUsd;
      current.totalEur += expense.amountEur;
      current.count += 1;
      continue;
    }

    categories[expense.categoryType].set(expense.categoryId, {
      categoryId: expense.categoryId,
      emoji: expense.categoryEmoji,
      name: expense.categoryName,
      totalRsd: expense.amountRsd,
      totalUsd: expense.amountUsd,
      totalEur: expense.amountEur,
      count: 1,
    });
  }

  buckets.fixed.categories = [...categories.fixed.values()];
  buckets.variable.categories = [...categories.variable.values()];

  return {
    buckets: [buckets.fixed, buckets.variable],
    totalRsd,
    totalUsd,
    totalEur,
  };
}

export async function listExpensesForAnalytics(
  yyyyMm: string,
): Promise<AnalyticsExpense[]> {
  const { first, last } = monthBounds(yyyyMm);
  const { data, error } = await supabase
    .from('expenses')
    .select(
      'id,occurred_on,created_at,description,category_id,merchant_id,amount_rsd,amount_usd,amount_eur,category:categories!expenses_category_id_fkey(emoji,name,type),merchant:merchants!expenses_merchant_id_fkey(name)',
    )
    .gte('occurred_on', first)
    .lte('occurred_on', last)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data as unknown as AnalyticsExpenseQueryRow[]).map((row) => ({
    id: row.id,
    occurredOn: row.occurred_on,
    createdAt: row.created_at,
    description: row.description,
    categoryId: row.category_id,
    categoryEmoji: row.category.emoji,
    categoryName: row.category.name,
    categoryType: row.category.type,
    merchantId: row.merchant_id,
    merchantName: row.merchant?.name ?? null,
    amountRsd: decimalToCents(row.amount_rsd),
    amountUsd: decimalToCents(row.amount_usd),
    amountEur: decimalToCents(row.amount_eur),
  }));
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
  const { raw: _raw, ...payload } = receipt;
  return payload;
}

export function receiptExpenseAmounts(
  amountCents: number,
  currency: string,
  rates: ResolvedRates | null,
) {
  if (!isCurrency(currency)) {
    return {
      amount_rsd: null,
      amount_usd: null,
      amount_eur: null,
      fx_rate_date: null,
    };
  }
  if (!rates) {
    throw new Error('Rates are required for a supported currency.');
  }
  const converted = convertAll(
    amountCents,
    currency,
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

export async function saveFiscalReceipt(
  input: SaveFiscalReceiptInput,
): Promise<void> {
  if (input.expenses.length === 0) {
    throw new Error('Выберите хотя бы одну позицию чека.');
  }

  const occurredOn = parsedReceiptDate(input.receipt);
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
      !originalName ||
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

  const source = input.receipt.source ?? 'fiscal_qr';
  const currency = input.receipt.currency;
  const rates = isCurrency(currency)
    ? await ratesForExpense(occurredOn)
    : null;
  let receiptId: string | null = null;

  try {
    const { data, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        user_id: userId,
        source,
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
      const converted = receiptExpenseAmounts(
        expense.amountCents,
        currency,
        rates,
      );
      return {
        user_id: userId,
        occurred_on: occurredOn,
        occurred_at: input.receipt.occurredAt,
        description: expense.description.trim(),
        category_id: expense.categoryId,
        merchant_id: merchantId,
        original_amount: centsToDecimal(expense.amountCents),
        original_currency: currency,
        ...converted,
        note: null,
        source,
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
