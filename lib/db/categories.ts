import {
  categoryUsageCounts,
  isCategoryOwnedByUser,
} from '../categoryManagement';
import { supabase } from '../supabase';
import { authenticatedUserId } from './internal';
import type {
  Category,
  CategoryInput,
  CategoryMoveResult,
  ExpenseCategoryType,
  ManagedCategory,
} from './types';

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

// Removed in Stage 2 together with the Edge Function merchant-type contract.
