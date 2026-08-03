import { normalizeMerchantName } from './receipts';

type CategoryOwnershipCandidate = {
  isSystem: boolean;
  userId: string | null;
};

type CategorySearchCandidate = {
  emoji: string;
  group: string;
  name: string;
  sort: number;
  type: 'fixed' | 'variable';
};

export function isCategoryOwnedByUser(
  category: CategoryOwnershipCandidate,
  userId: string,
): boolean {
  return (
    Boolean(userId) &&
    category.userId === userId &&
    !category.isSystem
  );
}

export function categoryUsageCounts(
  categoryIds: readonly string[],
  expenseCategoryIds: readonly string[],
): Map<string, number> {
  const counts = new Map(
    categoryIds.map((categoryId) => [categoryId, 0]),
  );

  for (const categoryId of expenseCategoryIds) {
    if (counts.has(categoryId)) {
      counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
    }
  }

  return counts;
}

function compareCategoryOrder<T extends CategorySearchCandidate>(
  left: T,
  right: T,
): number {
  return (
    left.sort - right.sort ||
    left.group.localeCompare(right.group, 'ru') ||
    left.name.localeCompare(right.name, 'ru')
  );
}

export function filterAndSortCategories<T extends CategorySearchCandidate>(
  categories: readonly T[],
  query: string,
): T[] {
  if (!query.trim()) {
    return [...categories].sort(compareCategoryOrder);
  }

  const normalizedQuery = normalizeMerchantName(query);
  if (!normalizedQuery) {
    return [];
  }

  return categories
    .filter((category) =>
      normalizeMerchantName(
        `${category.emoji} ${category.name} ${category.group} ${category.type}`,
      ).includes(normalizedQuery),
    )
    .sort(compareCategoryOrder);
}
