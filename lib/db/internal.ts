import type { ResolvedRates } from '../fx';
import {
  centsToDecimal,
  convertAll,
  decimalToCents,
  isCurrency,
} from '../money';
import { supabase } from '../supabase';
import type { Expense } from './types';

export type ExpenseQueryRow = {
  id: string;
  receipt_id: string | null;
  occurred_on: string;
  description: string;
  raw_name: string | null;
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
  receipt: { merchant_label: string | null } | null;
};


export function mapExpense(row: ExpenseQueryRow): Expense {
  return {
    id: row.id,
    receiptId: row.receipt_id,
    occurredOn: row.occurred_on,
    description: row.description,
    rawName: row.raw_name,
    categoryId: row.category_id,
    categoryEmoji: row.category?.emoji ?? '',
    categoryName: row.category?.name ?? '',
    categorySlug: row.category?.slug ?? null,
    merchantId: row.merchant_id,
    merchantName: row.merchant?.name ?? null,
    merchantLabel: row.receipt?.merchant_label ?? null,
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

export async function authenticatedUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Требуется вход в аккаунт.');
  }

  return session.user.id;
}
export const EXPENSE_SELECT =
  'id,receipt_id,occurred_on,description,raw_name,category_id,merchant_id,original_amount,original_currency,amount_rsd,amount_usd,amount_eur,fx_rate_date,note,created_at,category:categories!expenses_category_id_fkey(emoji,name,slug),merchant:merchants!expenses_merchant_id_fkey(name),receipt:receipts!expenses_receipt_id_fkey(merchant_label)';


export async function bumpMerchantUsage(merchantId: string | null): Promise<void> {
  if (!merchantId) {
    return;
  }

  try {
    const { error } = await supabase
      .from('merchants')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', merchantId);
    if (error) {
      throw error;
    }
  } catch (error: unknown) {
    console.error('Unable to update merchant recency:', error);
  }
}


export function receiptExpenseAmounts(
  amountCents: number,
  currency: string,
  rates: ResolvedRates | null,
  manualRsdCents: number | null = null,
) {
  if (!isCurrency(currency)) {
    return {
      amount_rsd:
        manualRsdCents === null
          ? null
          : centsToDecimal(manualRsdCents),
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
