import { monthBounds } from '../dates';
import { decimalToCents } from '../money';
import { supabase } from '../supabase';
import type {
  AnalyticsExpense,
  CategoryBreakdown,
  ExpenseCategoryType,
  FixedVariableBucketBreakdown,
  FixedVariableCategoryBreakdown,
  MerchantBreakdown,
  MonthlyCategoryBreakdown,
  MonthlyFixedVariableBreakdown,
  MonthlyMerchantBreakdown,
} from './types';

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


async function categoryBreakdownBetween(
  firstISO: string,
  lastISO: string,
): Promise<MonthlyCategoryBreakdown> {
  const { data, error } = await supabase
    .from('expenses')
    .select(
      'category_id,amount_rsd,amount_usd,amount_eur,category:categories!expenses_category_id_fkey(emoji,name,group)',
    )
    .gte('occurred_on', firstISO)
    .lte('occurred_on', lastISO);

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

export async function categoryBreakdownByMonth(
  yyyyMm: string,
): Promise<MonthlyCategoryBreakdown> {
  const { first, last } = monthBounds(yyyyMm);
  return categoryBreakdownBetween(first, last);
}

export async function categoryBreakdownByRange(
  fromISO: string,
  toISO: string,
): Promise<MonthlyCategoryBreakdown> {
  return categoryBreakdownBetween(fromISO, toISO);
}

async function merchantBreakdownBetween(
  firstISO: string,
  lastISO: string,
): Promise<MonthlyMerchantBreakdown> {
  const { data, error } = await supabase
    .from('expenses')
    .select(
      'merchant_id,amount_rsd,amount_usd,amount_eur,merchant:merchants!expenses_merchant_id_fkey(name)',
    )
    .gte('occurred_on', firstISO)
    .lte('occurred_on', lastISO);

  if (error) {
    throw error;
  }

  const merchants = new Map<string, MerchantBreakdown>();
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

    const merchantId = row.merchant_id;
    const merchantKey = merchantId ?? 'unknown';
    const merchant = merchants.get(merchantKey);
    if (merchant) {
      merchant.totalRsd += amountRsd;
      merchant.totalUsd += amountUsd;
      merchant.totalEur += amountEur;
      merchant.count += 1;
      continue;
    }

    merchants.set(merchantKey, {
      merchantId,
      name: row.merchant?.name ?? null,
      totalRsd: amountRsd,
      totalUsd: amountUsd,
      totalEur: amountEur,
      count: 1,
    });
  }

  return {
    merchants: [...merchants.values()],
    totalRsd,
    totalUsd,
    totalEur,
  };
}

export async function merchantBreakdownByMonth(
  yyyyMm: string,
): Promise<MonthlyMerchantBreakdown> {
  const { first, last } = monthBounds(yyyyMm);
  return merchantBreakdownBetween(first, last);
}

export async function merchantBreakdownByRange(
  fromISO: string,
  toISO: string,
): Promise<MonthlyMerchantBreakdown> {
  return merchantBreakdownBetween(fromISO, toISO);
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

async function listExpensesBetween(
  firstISO: string,
  lastISO: string,
): Promise<AnalyticsExpense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select(
      'id,occurred_on,created_at,description,category_id,merchant_id,amount_rsd,amount_usd,amount_eur,category:categories!expenses_category_id_fkey(emoji,name,type),merchant:merchants!expenses_merchant_id_fkey(name)',
    )
    .gte('occurred_on', firstISO)
    .lte('occurred_on', lastISO)
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

export async function listExpensesForAnalytics(
  yyyyMm: string,
): Promise<AnalyticsExpense[]> {
  const { first, last } = monthBounds(yyyyMm);
  return listExpensesBetween(first, last);
}

export async function listExpensesForRange(
  fromISO: string,
  toISO: string,
): Promise<AnalyticsExpense[]> {
  return listExpensesBetween(fromISO, toISO);
}
