import { monthBounds, parseLocalISO } from './dates';
import { ratesForExpense, type ResolvedRates } from './fx';
import {
  centsToDecimal,
  convertAll,
  type Currency,
  decimalToCents,
  isCurrency,
} from './money';
import {
  merchantAliasesWithIncoming,
  normalizeMerchantName,
  parsedReceiptDate,
  type ParsedReceipt,
} from './receipts';
import {
  findMerchantRenameCollision,
  merchantUsageCounts,
} from './merchantManagement';
import {
  categoryUsageCounts,
  isCategoryOwnedByUser,
} from './categoryManagement';
import { supabase } from './supabase';

type CategoryQueryRow = {
  id: string;
  slug: string | null;
  emoji: string;
  name: string;
  group: string;
  sort: number;
};

type CategoryManagementQueryRow = CategoryQueryRow & {
  active: boolean;
  is_system: boolean;
  type: ExpenseCategoryType;
  user_id: string | null;
};

type ExpenseCategoryReferenceRow = {
  category_id: string;
};

type CategoryReferenceRow = {
  category_id: string | null;
  id: string;
  user_id: string;
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
  updated_at: string;
};

type MerchantManagementQueryRow = MerchantQueryRow & {
  user_id: string;
};

type ExpenseMerchantReferenceRow = {
  merchant_id: string | null;
};

type MerchantReferenceRow = {
  id: string;
  merchant_id: string | null;
  user_id: string;
};

type ExpenseQueryRow = {
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

type ReceiptForEditQueryRow = {
  id: string;
  merchant_id: string | null;
  merchant_label: string | null;
  total: number | string | null;
  currency: string | null;
  payment_type: string | null;
  raw_json: unknown;
  merchant: {
    name: string;
    type_id: string | null;
  } | null;
};

type ReceiptMutationSnapshotRow = {
  id: string;
  user_id: string;
  source: string;
  merchant_id: string | null;
  merchant_label: string | null;
  tax_id: string | null;
  occurred_at: string | null;
  total: number | string | null;
  currency: string | null;
  payment_type: string | null;
  raw_json: unknown;
  parsed_ok: boolean;
  created_at: string;
};

type ExpenseMutationSnapshotRow = {
  id: string;
  user_id: string;
  occurred_on: string;
  occurred_at: string | null;
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
  source: string;
  receipt_id: string | null;
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
};

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
  typeId: string | null;
  aliases: string[];
  createdAt: string;
  updatedAt: string;
};

export type ManagedMerchant = Merchant & {
  typeEmoji: string;
  typeName: string;
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
  rawName: string;
};

export type FiscalReceiptMerchantInput =
  | { existingId: string }
  | { name: string; typeId: string };

export type SaveFiscalReceiptInput = {
  receipt: ParsedReceipt;
  merchant: FiscalReceiptMerchantInput;
  expenses: FiscalReceiptExpenseInput[];
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
  merchantTypeId: string | null;
  totalCents: number;
  currency: string;
  paymentType: string | null;
};

export type FiscalReceiptEditDraft = {
  receiptId: string;
  merchantId: string | null;
  merchantName: string;
  merchantLabel: string;
  merchantTypeId: string | null;
  occurredOn: string;
  totalCents: number;
  currency: string;
  paymentType: string | null;
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
};

export type UpdateFiscalReceiptResult = {
  deleted: boolean;
};

function mapExpense(row: ExpenseQueryRow): Expense {
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

async function authenticatedUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Требуется вход в аккаунт.');
  }

  return session.user.id;
}

const CATEGORY_MANAGEMENT_SELECT =
  'id,slug,emoji,name,group,type,is_system,user_id,active,sort';

function cleanCategoryInput(input: CategoryInput): CategoryInput {
  const cleaned = {
    emoji: input.emoji.trim(),
    group: input.group.trim(),
    name: input.name.trim(),
    type: input.type,
  };

  if (!cleaned.name || !cleaned.emoji || !cleaned.group) {
    throw new Error('Заполните название, эмодзи и группу категории.');
  }

  return cleaned;
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

export async function listCategoriesForManagement(): Promise<
  ManagedCategory[]
> {
  const userId = await authenticatedUserId();
  const [categoryResult, expenseResult] = await Promise.all([
    supabase
      .from('categories')
      .select(CATEGORY_MANAGEMENT_SELECT)
      .order('sort', { ascending: true }),
    supabase
      .from('expenses')
      .select('category_id')
      .eq('user_id', userId),
  ]);
  if (categoryResult.error) {
    throw categoryResult.error;
  }
  if (expenseResult.error) {
    throw expenseResult.error;
  }

  const rows =
    categoryResult.data as unknown as CategoryManagementQueryRow[];
  const counts = categoryUsageCounts(
    rows.map((category) => category.id),
    (
      expenseResult.data as unknown as ExpenseCategoryReferenceRow[]
    ).map((expense) => expense.category_id),
  );

  return rows.map((row) => ({
    active: row.active,
    emoji: row.emoji,
    group: row.group,
    id: row.id,
    isOwnedByCurrentUser: isCategoryOwnedByUser(
      { isSystem: row.is_system, userId: row.user_id },
      userId,
    ),
    isSystem: row.user_id === null || row.is_system,
    name: row.name,
    slug: row.slug,
    sort: row.sort,
    type: row.type,
    usageCount: counts.get(row.id) ?? 0,
    userId: row.user_id,
  }));
}

export async function createCategory(input: CategoryInput): Promise<void> {
  const userId = await authenticatedUserId();
  const cleaned = cleanCategoryInput(input);
  const { data: sortRows, error: sortError } = await supabase
    .from('categories')
    .select('sort')
    .order('sort', { ascending: false })
    .limit(1);
  if (sortError) {
    throw sortError;
  }
  const currentMaximum = Number(
    (sortRows as unknown as { sort: number }[])[0]?.sort ?? 0,
  );
  const { error } = await supabase.from('categories').insert({
    ...cleaned,
    active: true,
    is_system: false,
    slug: null,
    sort: currentMaximum + 10,
    user_id: userId,
  });
  if (error) {
    throw error;
  }
}

export async function updateCategory(
  categoryId: string,
  input: CategoryInput,
): Promise<void> {
  const userId = await authenticatedUserId();
  const cleaned = cleanCategoryInput(input);
  const { data, error } = await supabase
    .from('categories')
    .select(CATEGORY_MANAGEMENT_SELECT)
    .eq('id', categoryId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  const category = data as unknown as CategoryManagementQueryRow | null;
  if (
    !category ||
    !isCategoryOwnedByUser(
      { isSystem: category.is_system, userId: category.user_id },
      userId,
    )
  ) {
    throw new Error('Системную категорию нельзя изменить.');
  }

  const { error: updateError } = await supabase
    .from('categories')
    .update(cleaned)
    .eq('id', categoryId)
    .eq('user_id', userId)
    .eq('is_system', false);
  if (updateError) {
    throw updateError;
  }
}

type CategoryReferenceTable =
  | 'expenses'
  | 'item_category_rules'
  | 'subscriptions';

const categoryReferenceTables: readonly CategoryReferenceTable[] = [
  'expenses',
  'subscriptions',
  'item_category_rules',
];

async function loadCategoryReferences(
  table: CategoryReferenceTable,
  sourceIds: readonly string[],
  userId: string,
): Promise<CategoryReferenceRow[]> {
  const { data, error } = await supabase
    .from(table)
    .select('id,category_id,user_id')
    .in('category_id', [...sourceIds])
    .eq('user_id', userId);
  if (error) {
    throw error;
  }
  return data as unknown as CategoryReferenceRow[];
}

async function restoreCategoryReferences(
  table: CategoryReferenceTable,
  references: readonly CategoryReferenceRow[],
  userId: string,
): Promise<void> {
  const idsByCategory = new Map<string, string[]>();
  for (const reference of references) {
    if (!reference.category_id) {
      continue;
    }
    const ids = idsByCategory.get(reference.category_id) ?? [];
    ids.push(reference.id);
    idsByCategory.set(reference.category_id, ids);
  }

  for (const [categoryId, referenceIds] of idsByCategory) {
    const { error } = await supabase
      .from(table)
      .update({ category_id: categoryId })
      .in('id', referenceIds)
      .eq('user_id', userId);
    if (error) {
      console.error(
        `Unable to restore ${table} after category change:`,
        error,
      );
    }
  }
}

async function moveCategoryReferencesAndDelete(
  targetId: string,
  sourceIds: readonly string[],
  userId: string,
): Promise<CategoryMoveResult> {
  const loadedReferences = await Promise.all(
    categoryReferenceTables.map((table) =>
      loadCategoryReferences(table, sourceIds, userId),
    ),
  );
  const referencesByTable = new Map(
    categoryReferenceTables.map((table, index) => [
      table,
      loadedReferences[index] ?? [],
    ]),
  );
  const updatedTables: CategoryReferenceTable[] = [];

  try {
    for (const table of categoryReferenceTables) {
      const { error } = await supabase
        .from(table)
        .update({ category_id: targetId })
        .in('category_id', [...sourceIds])
        .eq('user_id', userId);
      if (error) {
        throw error;
      }
      updatedTables.push(table);
    }

    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .in('id', [...sourceIds])
      .eq('user_id', userId)
      .eq('is_system', false);
    if (deleteError) {
      throw deleteError;
    }

    return {
      affectedExpenses:
        referencesByTable.get('expenses')?.length ?? 0,
    };
  } catch (moveError: unknown) {
    for (const table of [...updatedTables].reverse()) {
      await restoreCategoryReferences(
        table,
        referencesByTable.get(table) ?? [],
        userId,
      );
    }
    throw moveError;
  }
}

export async function mergeCategories(
  targetId: string,
  sourceUserCategoryIds: readonly string[],
): Promise<CategoryMoveResult> {
  const uniqueSourceIds = [...new Set(sourceUserCategoryIds)].filter(
    (sourceId) => sourceId !== targetId,
  );
  if (!targetId || uniqueSourceIds.length === 0) {
    throw new Error(
      'Выберите целевую категорию и хотя бы одну свою категорию.',
    );
  }

  const userId = await authenticatedUserId();
  const categoryIds = [targetId, ...uniqueSourceIds];
  const { data, error } = await supabase
    .from('categories')
    .select(CATEGORY_MANAGEMENT_SELECT)
    .in('id', categoryIds);
  if (error) {
    throw error;
  }
  const categories =
    data as unknown as CategoryManagementQueryRow[];
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const target = categoryById.get(targetId);
  if (
    !target ||
    (target.user_id !== null && target.user_id !== userId)
  ) {
    throw new Error('Целевая категория не найдена.');
  }
  const sources = uniqueSourceIds.map((sourceId) =>
    categoryById.get(sourceId),
  );
  if (
    sources.some(
      (source) =>
        !source ||
        !isCategoryOwnedByUser(
          {
            isSystem: source.is_system,
            userId: source.user_id,
          },
          userId,
        ),
    )
  ) {
    throw new Error(
      'Системную категорию нельзя удалить при объединении.',
    );
  }

  return moveCategoryReferencesAndDelete(
    targetId,
    uniqueSourceIds,
    userId,
  );
}

export async function deleteCategory(
  categoryId: string,
): Promise<CategoryMoveResult> {
  const userId = await authenticatedUserId();
  const [sourceResult, uncategorizedResult] = await Promise.all([
    supabase
      .from('categories')
      .select(CATEGORY_MANAGEMENT_SELECT)
      .eq('id', categoryId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('categories')
      .select(CATEGORY_MANAGEMENT_SELECT)
      .eq('slug', 'uncategorized')
      .is('user_id', null)
      .single(),
  ]);
  if (sourceResult.error) {
    throw sourceResult.error;
  }
  if (uncategorizedResult.error) {
    throw uncategorizedResult.error;
  }

  const source =
    sourceResult.data as unknown as CategoryManagementQueryRow | null;
  if (
    !source ||
    !isCategoryOwnedByUser(
      { isSystem: source.is_system, userId: source.user_id },
      userId,
    )
  ) {
    throw new Error('Системную категорию нельзя удалить.');
  }
  const uncategorized =
    uncategorizedResult.data as unknown as CategoryManagementQueryRow;

  return moveCategoryReferencesAndDelete(
    uncategorized.id,
    [source.id],
    userId,
  );
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
    .select('id,name,type_id,aliases,created_at,updated_at')
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
    updatedAt: row.updated_at,
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
    .select('id,name,type_id,aliases,created_at,updated_at')
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
    updatedAt: row.updated_at,
  };
}

export async function listMerchantsForManagement(): Promise<
  ManagedMerchant[]
> {
  const [merchants, merchantTypes, expenseResult] = await Promise.all([
    listMerchants(),
    listMerchantTypes(),
    supabase
      .from('expenses')
      .select('merchant_id')
      .not('merchant_id', 'is', null),
  ]);
  if (expenseResult.error) {
    throw expenseResult.error;
  }

  const typeById = new Map(
    merchantTypes.map((merchantType) => [merchantType.id, merchantType]),
  );
  const counts = merchantUsageCounts(
    merchants.map((merchant) => merchant.id),
    (expenseResult.data as unknown as ExpenseMerchantReferenceRow[]).map(
      (expense) => expense.merchant_id,
    ),
  );

  return merchants.map((merchant) => {
    const merchantType = merchant.typeId
      ? typeById.get(merchant.typeId)
      : null;
    return {
      ...merchant,
      typeEmoji: merchantType?.emoji ?? '📍',
      typeName: merchantType?.name ?? 'Тип не указан',
      usageCount: counts.get(merchant.id) ?? 0,
    };
  });
}

export async function renameMerchant(
  merchantId: string,
  nextName: string,
): Promise<RenameMerchantResult> {
  const trimmedName = nextName.trim();
  if (!trimmedName) {
    throw new Error('Укажите название места.');
  }

  const userId = await authenticatedUserId();
  const { data, error } = await supabase
    .from('merchants')
    .select(
      'id,user_id,name,type_id,aliases,created_at,updated_at',
    )
    .eq('user_id', userId);
  if (error) {
    throw error;
  }

  const merchants = data as unknown as MerchantManagementQueryRow[];
  const current = merchants.find(
    (merchant) => merchant.id === merchantId,
  );
  if (!current) {
    throw new Error('Место не найдено.');
  }
  const collision = findMerchantRenameCollision(
    merchants,
    merchantId,
    trimmedName,
  );
  if (collision) {
    return {
      kind: 'collision',
      merchantId: collision.id,
      merchantName: collision.name,
    };
  }

  const aliases = merchantAliasesWithIncoming(
    { aliases: current.aliases, name: trimmedName },
    current.name,
  );
  const { error: updateError } = await supabase
    .from('merchants')
    .update({ aliases, name: trimmedName })
    .eq('id', merchantId)
    .eq('user_id', userId);
  if (updateError) {
    throw updateError;
  }

  return { kind: 'renamed' };
}

export async function deleteMerchant(merchantId: string): Promise<void> {
  const userId = await authenticatedUserId();
  const { error } = await supabase
    .from('merchants')
    .delete()
    .eq('id', merchantId)
    .eq('user_id', userId);
  if (error) {
    throw error;
  }
}

type MerchantReferenceTable =
  | 'expenses'
  | 'receipts'
  | 'subscriptions';

const merchantReferenceTables: readonly MerchantReferenceTable[] = [
  'expenses',
  'receipts',
  'subscriptions',
];

async function loadMerchantReferences(
  table: MerchantReferenceTable,
  sourceIds: readonly string[],
  userId: string,
): Promise<MerchantReferenceRow[]> {
  const { data, error } = await supabase
    .from(table)
    .select('id,merchant_id,user_id')
    .in('merchant_id', [...sourceIds])
    .eq('user_id', userId);
  if (error) {
    throw error;
  }
  return data as unknown as MerchantReferenceRow[];
}

async function restoreMerchantReferences(
  table: MerchantReferenceTable,
  references: readonly MerchantReferenceRow[],
  userId: string,
): Promise<void> {
  const idsByMerchant = new Map<string, string[]>();
  for (const reference of references) {
    if (!reference.merchant_id) {
      continue;
    }
    const ids = idsByMerchant.get(reference.merchant_id) ?? [];
    ids.push(reference.id);
    idsByMerchant.set(reference.merchant_id, ids);
  }

  for (const [merchantId, referenceIds] of idsByMerchant) {
    const { error } = await supabase
      .from(table)
      .update({ merchant_id: merchantId })
      .in('id', referenceIds)
      .eq('user_id', userId);
    if (error) {
      console.error(
        `Unable to restore ${table} after merchant merge:`,
        error,
      );
    }
  }
}

function aliasesAfterMerchantMerge(
  target: MerchantManagementQueryRow,
  sources: readonly MerchantManagementQueryRow[],
): string[] {
  let aliases = [...target.aliases];

  for (const source of sources) {
    for (const spelling of [source.name, ...source.aliases]) {
      aliases = merchantAliasesWithIncoming(
        { aliases, name: target.name },
        spelling,
      );
    }
  }

  return aliases;
}

export async function mergeMerchants(
  targetId: string,
  sourceIds: readonly string[],
): Promise<MergeMerchantsResult> {
  const uniqueSourceIds = [...new Set(sourceIds)].filter(
    (sourceId) => sourceId !== targetId,
  );
  if (!targetId || uniqueSourceIds.length === 0) {
    throw new Error('Выберите целевое место и хотя бы один дубликат.');
  }

  const userId = await authenticatedUserId();
  const merchantIds = [targetId, ...uniqueSourceIds];
  const { data, error } = await supabase
    .from('merchants')
    .select(
      'id,user_id,name,type_id,aliases,created_at,updated_at',
    )
    .in('id', merchantIds)
    .eq('user_id', userId);
  if (error) {
    throw error;
  }

  const merchants = data as unknown as MerchantManagementQueryRow[];
  if (
    merchants.length !== merchantIds.length ||
    new Set(merchants.map((merchant) => merchant.id)).size !==
      merchantIds.length
  ) {
    throw new Error('Одно из выбранных мест не найдено.');
  }
  const target = merchants.find((merchant) => merchant.id === targetId);
  const merchantById = new Map(
    merchants.map((merchant) => [merchant.id, merchant]),
  );
  const sources = uniqueSourceIds.map((sourceId) =>
    merchantById.get(sourceId),
  );
  if (!target || sources.some((source) => source === undefined)) {
    throw new Error('Одно из выбранных мест не найдено.');
  }
  const sourceMerchants = sources as MerchantManagementQueryRow[];
  const mergedAliases = aliasesAfterMerchantMerge(
    target,
    sourceMerchants,
  );
  const [expenseReferences, receiptReferences, subscriptionReferences] =
    await Promise.all([
      loadMerchantReferences('expenses', uniqueSourceIds, userId),
      loadMerchantReferences('receipts', uniqueSourceIds, userId),
      loadMerchantReferences('subscriptions', uniqueSourceIds, userId),
    ]);
  const referencesByTable: Record<
    MerchantReferenceTable,
    MerchantReferenceRow[]
  > = {
    expenses: expenseReferences,
    receipts: receiptReferences,
    subscriptions: subscriptionReferences,
  };
  const updatedTables: MerchantReferenceTable[] = [];
  let aliasesUpdated = false;

  try {
    for (const table of merchantReferenceTables) {
      const { error: referenceError } = await supabase
        .from(table)
        .update({ merchant_id: targetId })
        .in('merchant_id', uniqueSourceIds)
        .eq('user_id', userId);
      if (referenceError) {
        throw referenceError;
      }
      updatedTables.push(table);
    }

    const { error: aliasError } = await supabase
      .from('merchants')
      .update({ aliases: mergedAliases })
      .eq('id', targetId)
      .eq('user_id', userId);
    if (aliasError) {
      throw aliasError;
    }
    aliasesUpdated = true;

    const { error: deleteError } = await supabase
      .from('merchants')
      .delete()
      .in('id', uniqueSourceIds)
      .eq('user_id', userId);
    if (deleteError) {
      throw deleteError;
    }

    return { affectedExpenses: expenseReferences.length };
  } catch (mergeError: unknown) {
    if (aliasesUpdated) {
      const { error: aliasRestoreError } = await supabase
        .from('merchants')
        .update({ aliases: target.aliases })
        .eq('id', targetId)
        .eq('user_id', userId);
      if (aliasRestoreError) {
        console.error(
          'Unable to restore target aliases after merchant merge:',
          aliasRestoreError,
        );
      }
    }

    for (const table of [...updatedTables].reverse()) {
      await restoreMerchantReferences(
        table,
        referencesByTable[table],
        userId,
      );
    }
    throw mergeError;
  }
}

const EXPENSE_SELECT =
  'id,receipt_id,occurred_on,description,raw_name,category_id,merchant_id,original_amount,original_currency,amount_rsd,amount_usd,amount_eur,fx_rate_date,note,created_at,category:categories!expenses_category_id_fkey(emoji,name,slug),merchant:merchants!expenses_merchant_id_fkey(name),receipt:receipts!expenses_receipt_id_fkey(merchant_label)';

export function buildFiscalReceiptEditDraft(
  receipt: FiscalReceiptEditReceipt,
  expenses: readonly Expense[],
): FiscalReceiptEditDraft {
  const firstExpense = expenses[0];
  if (!firstExpense) {
    throw new Error('В покупке нет позиций для редактирования.');
  }
  if (!parseLocalISO(firstExpense.occurredOn)) {
    throw new Error('Дата покупки некорректна.');
  }
  if (
    expenses.some(
      (expense) =>
        expense.receiptId !== receipt.id ||
        expense.occurredOn !== firstExpense.occurredOn,
    )
  ) {
    throw new Error('Позиции покупки содержат несогласованные данные.');
  }

  return {
    receiptId: receipt.id,
    merchantId: receipt.merchantId,
    merchantName: receipt.merchantName,
    merchantLabel: receipt.merchantLabel,
    merchantTypeId: receipt.merchantTypeId,
    occurredOn: firstExpense.occurredOn,
    totalCents: receipt.totalCents,
    currency: receipt.currency || firstExpense.originalCurrency,
    paymentType: receipt.paymentType,
    items: expenses.map((expense) => ({
      id: expense.id,
      amountCents: expense.originalAmountCents,
      categoryId: expense.categoryId,
      description: expense.description,
      rawName: expense.rawName?.trim() || expense.description,
    })),
  };
}

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

export async function getFiscalReceiptForEdit(
  receiptId: string,
): Promise<FiscalReceiptEditDraft | null> {
  const { data: receiptData, error: receiptError } = await supabase
    .from('receipts')
    .select(
      'id,merchant_id,merchant_label,total,currency,payment_type,raw_json,merchant:merchants!receipts_merchant_id_fkey(name,type_id)',
    )
    .eq('id', receiptId)
    .maybeSingle();

  if (receiptError) {
    throw receiptError;
  }
  if (!receiptData) {
    return null;
  }

  const { data: expenseData, error: expensesError } = await supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('receipt_id', receiptId)
    .order('created_at', { ascending: true });

  if (expensesError) {
    throw expensesError;
  }

  const expenses = (expenseData as unknown as ExpenseQueryRow[]).map(
    mapExpense,
  );
  if (expenses.length === 0) {
    return null;
  }

  const receipt = receiptData as unknown as ReceiptForEditQueryRow;
  const merchantLabel =
    receipt.merchant_label?.trim() ||
    rawReceiptMerchantLabel(receipt.raw_json) ||
    receipt.merchant?.name ||
    '';
  return buildFiscalReceiptEditDraft(
    {
      id: receipt.id,
      merchantId: receipt.merchant_id,
      merchantName: receipt.merchant?.name ?? '',
      merchantLabel,
      merchantTypeId: receipt.merchant?.type_id ?? null,
      totalCents:
        receipt.total === null
          ? expenses.reduce(
              (total, expense) => total + expense.originalAmountCents,
              0,
            )
          : decimalToCents(receipt.total),
      currency: receipt.currency ?? '',
      paymentType: receipt.payment_type,
    },
    expenses,
  );
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

async function bumpMerchantUsage(merchantId: string | null): Promise<void> {
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

  await bumpMerchantUsage(input.merchantId);
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

async function learnedAliasesForMerchant(
  merchantId: string,
  incomingName: string,
) {
  const { data, error } = await supabase
    .from('merchants')
    .select('name,aliases')
    .eq('id', merchantId)
    .single();
  if (error) {
    throw error;
  }
  const merchant = data as unknown as {
    aliases: string[];
    name: string;
  };
  const learnedAliases = merchantAliasesWithIncoming(
    merchant,
    incomingName,
  );
  return learnedAliases.length === merchant.aliases.length
    ? null
    : learnedAliases;
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
  let learnedAliases: string[] | null = null;

  if ('existingId' in input.merchant) {
    merchantId = input.merchant.existingId;
    learnedAliases = await learnedAliasesForMerchant(
      merchantId,
      input.receipt.merchantName,
    );
  } else {
    const merchantName = input.merchant.name.trim();
    if (!merchantName || !input.merchant.typeId) {
      throw new Error('Укажите название и тип места.');
    }
    const aliases =
      learnedAliasesWithNormalizedIncoming(
        { aliases: [], name: merchantName },
        input.receipt.merchantName,
      ) ?? [];
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
  const merchantLabel =
    input.receipt.merchantLabel?.trim() ||
    input.receipt.merchantName.trim();
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
        merchant_label: merchantLabel || null,
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
        raw_name: expense.rawName.trim() || null,
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
    if (learnedAliases) {
      const { error: aliasError } = await supabase
        .from('merchants')
        .update({ aliases: learnedAliases })
        .eq('id', merchantId);
      if (aliasError) {
        throw aliasError;
      }
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

  if ('existingId' in input.merchant && !learnedAliases) {
    await bumpMerchantUsage(merchantId);
  }
}

const RECEIPT_MUTATION_SELECT =
  'id,user_id,source,merchant_id,merchant_label,tax_id,occurred_at,total,currency,payment_type,raw_json,parsed_ok,created_at';
const EXPENSE_MUTATION_SELECT =
  'id,user_id,occurred_on,occurred_at,description,raw_name,category_id,merchant_id,original_amount,original_currency,amount_rsd,amount_usd,amount_eur,fx_rate_date,note,source,receipt_id,is_recurring,created_at,updated_at';

type FiscalReceiptMutationSnapshot = {
  receipt: ReceiptMutationSnapshotRow;
  expenses: ExpenseMutationSnapshotRow[];
};

type ResolvedReceiptEditMerchant = {
  created: boolean;
  id: string;
  learnedAliases: string[] | null;
  originalAliases: string[] | null;
};

async function loadFiscalReceiptMutationSnapshot(
  receiptId: string,
  userId: string,
): Promise<FiscalReceiptMutationSnapshot> {
  const { data: receiptData, error: receiptError } = await supabase
    .from('receipts')
    .select(RECEIPT_MUTATION_SELECT)
    .eq('id', receiptId)
    .maybeSingle();
  if (receiptError) {
    throw receiptError;
  }
  if (!receiptData) {
    throw new Error('Покупка не найдена.');
  }

  const receipt = receiptData as unknown as ReceiptMutationSnapshotRow;
  if (receipt.user_id !== userId) {
    throw new Error('Покупка не найдена.');
  }

  const { data: expenseData, error: expensesError } = await supabase
    .from('expenses')
    .select(EXPENSE_MUTATION_SELECT)
    .eq('receipt_id', receiptId)
    .order('created_at', { ascending: true });
  if (expensesError) {
    throw expensesError;
  }

  const expenses = expenseData as unknown as ExpenseMutationSnapshotRow[];
  if (
    expenses.length === 0 ||
    expenses.some(
      (expense) =>
        expense.user_id !== userId || expense.receipt_id !== receiptId,
    )
  ) {
    throw new Error('Позиции покупки не найдены.');
  }

  return { receipt, expenses };
}

function rawReceiptMerchantName(rawJson: unknown): string {
  if (typeof rawJson !== 'object' || rawJson === null) {
    return '';
  }

  const merchantName = (rawJson as Record<string, unknown>).merchantName;
  return typeof merchantName === 'string' ? merchantName.trim() : '';
}

function rawReceiptMerchantLabel(rawJson: unknown): string {
  if (typeof rawJson !== 'object' || rawJson === null) {
    return '';
  }

  const receipt = rawJson as Record<string, unknown>;
  const merchantLabel = receipt.merchantLabel;
  if (typeof merchantLabel === 'string' && merchantLabel.trim()) {
    return merchantLabel.trim();
  }
  const merchantName = receipt.merchantName;
  return typeof merchantName === 'string' ? merchantName.trim() : '';
}

function learnedAliasesWithNormalizedIncoming(
  merchant: { aliases: readonly string[]; name: string },
  incomingName: string,
): string[] | null {
  const incomingKey = normalizeMerchantName(incomingName);
  if (
    !incomingKey ||
    [merchant.name, ...merchant.aliases].some(
      (name) => normalizeMerchantName(name) === incomingKey,
    )
  ) {
    return null;
  }

  const aliases = merchantAliasesWithIncoming(merchant, incomingName);
  return aliases.length === merchant.aliases.length ? null : aliases;
}

async function resolveReceiptEditMerchant(
  merchant: FiscalReceiptMerchantInput,
  incomingName: string,
  userId: string,
): Promise<ResolvedReceiptEditMerchant> {
  if ('existingId' in merchant) {
    const { data, error } = await supabase
      .from('merchants')
      .select('name,aliases')
      .eq('id', merchant.existingId)
      .single();
    if (error) {
      throw error;
    }

    const existing = data as unknown as {
      aliases: string[];
      name: string;
    };
    return {
      created: false,
      id: merchant.existingId,
      learnedAliases: learnedAliasesWithNormalizedIncoming(
        existing,
        incomingName,
      ),
      originalAliases: [...existing.aliases],
    };
  }

  const merchantName = merchant.name.trim();
  if (!merchantName || !merchant.typeId) {
    throw new Error('Укажите название и тип места.');
  }
  const learnedAliases =
    learnedAliasesWithNormalizedIncoming(
      { aliases: [], name: merchantName },
      incomingName,
    ) ?? [];
  const { data, error } = await supabase
    .from('merchants')
    .insert({
      user_id: userId,
      name: merchantName,
      type_id: merchant.typeId,
      aliases: learnedAliases,
    })
    .select('id')
    .single();
  if (error) {
    throw error;
  }

  return {
    created: true,
    id: (data as unknown as { id: string }).id,
    learnedAliases: null,
    originalAliases: null,
  };
}

function receiptTimestampForDate(
  occurredAt: string | null,
  occurredOn: string,
): string | null {
  if (!occurredAt) {
    return null;
  }
  return occurredAt.replace(/^\d{4}-\d{2}-\d{2}(?=T)/u, occurredOn);
}

function validateReceiptEditExpenses(
  snapshot: FiscalReceiptMutationSnapshot,
  input: UpdateFiscalReceiptInput,
): UpdateFiscalReceiptExpenseInput[] {
  if (!parseLocalISO(input.occurredOn)) {
    throw new Error('Дата покупки некорректна.');
  }
  if (input.expenses.length !== snapshot.expenses.length) {
    throw new Error('Состав покупки изменился. Обновите экран и повторите.');
  }

  const existingIds = new Set(
    snapshot.expenses.map((expense) => expense.id),
  );
  const seenIds = new Set<string>();
  for (const expense of input.expenses) {
    if (!existingIds.has(expense.id) || seenIds.has(expense.id)) {
      throw new Error('Состав покупки изменился. Обновите экран и повторите.');
    }
    seenIds.add(expense.id);
    if (
      expense.included &&
      (expense.amountCents === null ||
        !Number.isSafeInteger(expense.amountCents) ||
        expense.amountCents <= 0)
    ) {
      throw new Error('Исправьте суммы включённых позиций.');
    }
  }

  return input.expenses.filter((expense) => expense.included);
}

function receiptEditTotal(
  expenses: readonly UpdateFiscalReceiptExpenseInput[],
): number {
  let total = 0;
  for (const expense of expenses) {
    if (expense.amountCents === null) {
      throw new Error('Исправьте суммы включённых позиций.');
    }
    total += expense.amountCents;
    if (!Number.isSafeInteger(total)) {
      throw new Error('Итоговая сумма покупки слишком велика.');
    }
  }
  return total;
}

async function restoreFiscalReceiptSnapshot(
  snapshot: FiscalReceiptMutationSnapshot,
): Promise<void> {
  const { error: receiptError } = await supabase
    .from('receipts')
    .upsert(snapshot.receipt);
  if (receiptError) {
    console.error(
      'Unable to restore receipt after an edit failure:',
      receiptError.message,
    );
  }

  const { error: expensesError } = await supabase
    .from('expenses')
    .upsert(snapshot.expenses);
  if (expensesError) {
    console.error(
      'Unable to restore receipt expenses after an edit failure:',
      expensesError.message,
    );
  }
}

async function deleteFiscalReceiptForEdit(
  receiptId: string,
  snapshot: FiscalReceiptMutationSnapshot,
): Promise<UpdateFiscalReceiptResult> {
  try {
    const { error: expensesError } = await supabase
      .from('expenses')
      .delete()
      .eq('receipt_id', receiptId);
    if (expensesError) {
      throw expensesError;
    }

    const { error: receiptError } = await supabase
      .from('receipts')
      .delete()
      .eq('id', receiptId);
    if (receiptError) {
      throw receiptError;
    }
    return { deleted: true };
  } catch (error: unknown) {
    await restoreFiscalReceiptSnapshot(snapshot);
    throw error;
  }
}

export async function updateFiscalReceipt(
  receiptId: string,
  input: UpdateFiscalReceiptInput,
): Promise<UpdateFiscalReceiptResult> {
  const userId = await authenticatedUserId();
  const snapshot = await loadFiscalReceiptMutationSnapshot(
    receiptId,
    userId,
  );
  const keptExpenses = validateReceiptEditExpenses(snapshot, input);
  if (keptExpenses.length === 0) {
    return deleteFiscalReceiptForEdit(receiptId, snapshot);
  }
  if (!input.merchant) {
    throw new Error('Выберите место покупки.');
  }

  const snapshotById = new Map(
    snapshot.expenses.map((expense) => [expense.id, expense]),
  );
  const dateChanged = snapshot.expenses.some(
    (expense) => expense.occurred_on !== input.occurredOn,
  );
  const amountChanged = keptExpenses.some((expense) => {
    const existing = snapshotById.get(expense.id);
    return (
      existing !== undefined &&
      expense.amountCents !== null &&
      decimalToCents(existing.original_amount) !== expense.amountCents
    );
  });
  const currency =
    snapshot.receipt.currency ?? snapshot.expenses[0]?.original_currency;
  if (!currency) {
    throw new Error('Валюта покупки не найдена.');
  }
  const rates =
    (dateChanged || amountChanged) && isCurrency(currency)
      ? await ratesForExpense(input.occurredOn)
      : null;
  const incomingMerchantName = rawReceiptMerchantName(
    snapshot.receipt.raw_json,
  );
  let resolvedMerchant: ResolvedReceiptEditMerchant | null = null;
  let aliasUpdateAttempted = false;

  try {
    resolvedMerchant = await resolveReceiptEditMerchant(
      input.merchant,
      incomingMerchantName,
      userId,
    );

    for (const expense of keptExpenses) {
      const existing = snapshotById.get(expense.id);
      if (!existing || expense.amountCents === null) {
        throw new Error(
          'Состав покупки изменился. Обновите экран и повторите.',
        );
      }
      const itemAmountChanged =
        decimalToCents(existing.original_amount) !== expense.amountCents;
      const converted =
        dateChanged || itemAmountChanged
          ? receiptExpenseAmounts(expense.amountCents, currency, rates)
          : {};
      const { error } = await supabase
        .from('expenses')
        .update({
          occurred_on: input.occurredOn,
          ...(dateChanged
            ? {
                occurred_at: receiptTimestampForDate(
                  existing.occurred_at,
                  input.occurredOn,
                ),
              }
            : {}),
          description: expense.description.trim() || expense.rawName.trim(),
          raw_name: expense.rawName.trim() || null,
          category_id: expense.categoryId,
          merchant_id: resolvedMerchant.id,
          original_amount: centsToDecimal(expense.amountCents),
          ...converted,
        })
        .eq('id', expense.id)
        .eq('receipt_id', receiptId);
      if (error) {
        throw error;
      }
    }

    for (const expense of input.expenses) {
      if (expense.included) {
        continue;
      }
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expense.id)
        .eq('receipt_id', receiptId);
      if (error) {
        throw error;
      }
    }

    const totalCents = receiptEditTotal(keptExpenses);
    const { error: receiptError } = await supabase
      .from('receipts')
      .update({
        merchant_id: resolvedMerchant.id,
        merchant_label: input.merchantLabel.trim() || null,
        ...(dateChanged
          ? {
              occurred_at: receiptTimestampForDate(
                snapshot.receipt.occurred_at,
                input.occurredOn,
              ),
            }
          : {}),
        total: centsToDecimal(totalCents),
      })
      .eq('id', receiptId);
    if (receiptError) {
      throw receiptError;
    }

    if (resolvedMerchant.learnedAliases) {
      aliasUpdateAttempted = true;
      const { error: aliasError } = await supabase
        .from('merchants')
        .update({ aliases: resolvedMerchant.learnedAliases })
        .eq('id', resolvedMerchant.id);
      if (aliasError) {
        throw aliasError;
      }
    }

    if (!resolvedMerchant.created && !resolvedMerchant.learnedAliases) {
      await bumpMerchantUsage(resolvedMerchant.id);
    }

    return { deleted: false };
  } catch (error: unknown) {
    await restoreFiscalReceiptSnapshot(snapshot);

    if (
      resolvedMerchant &&
      !resolvedMerchant.created &&
      aliasUpdateAttempted &&
      resolvedMerchant.originalAliases
    ) {
      const { error: aliasRestoreError } = await supabase
        .from('merchants')
        .update({ aliases: resolvedMerchant.originalAliases })
        .eq('id', resolvedMerchant.id);
      if (aliasRestoreError) {
        console.error(
          'Unable to restore merchant aliases after an edit failure:',
          aliasRestoreError.message,
        );
      }
    }

    if (resolvedMerchant?.created) {
      const { error: merchantCleanupError } = await supabase
        .from('merchants')
        .delete()
        .eq('id', resolvedMerchant.id);
      if (merchantCleanupError) {
        console.error(
          'Unable to clean up a merchant after an edit failure:',
          merchantCleanupError.message,
        );
      }
    }
    throw error;
  }
}
