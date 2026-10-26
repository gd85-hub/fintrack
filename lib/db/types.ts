import type { ParsedReceipt } from '../receipts';

export type Category = {
  id: string;
  slug: string | null;
  emoji: string;
  name: string;
  group: string;
  sort: number;
};
export type ManagedCategory = Category & {
  active: boolean;
  isOwnedByCurrentUser: boolean;
  isSystem: boolean;
  type: ExpenseCategoryType;
  usageCount: number;
  userId: string | null;
};

export type CategoryInput = {
  emoji: string;
  group: string;
  name: string;
  type: ExpenseCategoryType;
};

export type CategoryMoveResult = {
  affectedExpenses: number;
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
  aliases: string[];
  createdAt: string;
  updatedAt: string;
};

export type ManagedMerchant = Merchant & {
  usageCount: number;
};

export type RenameMerchantResult =
  | { kind: 'renamed' }
  | {
      kind: 'collision';
      merchantId: string;
      merchantName: string;
    };

export type MergeMerchantsResult = {
  affectedExpenses: number;
};

export type Expense = {
  id: string;
  receiptId: string | null;
  occurredOn: string;
  description: string;
  rawName: string | null;
  categoryId: string;
  categoryEmoji: string;
  categoryName: string;
  categorySlug: string | null;
  merchantId: string | null;
  merchantName: string | null;
  merchantLabel: string | null;
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
  name: string | null;
  totalRsd: number;
  totalUsd: number;
  totalEur: number;
  count: number;
};

export type MonthlyMerchantBreakdown = {
  merchants: MerchantBreakdown[];
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
  currency: string;
  categoryId: string;
  merchantId: string | null;
  occurredOn: string;
  description: string;
  note: string;
  manualRsdCents?: number | null;
};

export type FiscalReceiptExpenseInput = {
  amountCents: number;
  categoryId: string;
  description: string;
  rawName: string;
};

export type FiscalReceiptMerchantInput =
  | { existingId: string }
  | { name: string };

export type SaveFiscalReceiptInput = {
  receipt: ParsedReceipt;
  merchant: FiscalReceiptMerchantInput;
  expenses: FiscalReceiptExpenseInput[];
  manualRsdTotalCents?: number | null;
};

export type FiscalReceiptEditItem = {
  id: string;
  amountCents: number;
  categoryId: string;
  description: string;
  rawName: string;
};

export type FiscalReceiptEditReceipt = {
  id: string;
  merchantId: string | null;
  merchantName: string;
  merchantLabel: string;
  totalCents: number;
  currency: string;
  paymentType: string | null;
};

export type FiscalReceiptEditDraft = {
  receiptId: string;
  merchantId: string | null;
  merchantName: string;
  merchantLabel: string;
  occurredOn: string;
  totalCents: number;
  currency: string;
  paymentType: string | null;
  manualRsdTotalCents?: number | null;
  items: FiscalReceiptEditItem[];
};

export type UpdateFiscalReceiptExpenseInput = {
  id: string;
  amountCents: number | null;
  categoryId: string;
  description: string;
  rawName: string;
  included: boolean;
};

export type UpdateFiscalReceiptInput = {
  merchant: FiscalReceiptMerchantInput | null;
  merchantLabel: string;
  occurredOn: string;
  expenses: UpdateFiscalReceiptExpenseInput[];
  currency?: string;
  manualRsdTotalCents?: number | null;
};

export type UpdateFiscalReceiptResult = {
  deleted: boolean;
};
