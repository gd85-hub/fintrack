import { normalizeMerchantName } from './receipts';

type MerchantSearchCandidate = {
  aliases: readonly string[];
  name: string;
  updatedAt: string;
};

function recencyValue(updatedAt: string): number {
  const parsed = Date.parse(updatedAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function compareMerchantOrder<T extends MerchantSearchCandidate>(
  left: T,
  right: T,
): number {
  return (
    recencyValue(right.updatedAt) - recencyValue(left.updatedAt) ||
    left.name.localeCompare(right.name, 'ru')
  );
}

function matchRank(merchant: MerchantSearchCandidate, query: string) {
  let bestRank: number | null = null;

  for (const spelling of [merchant.name, ...merchant.aliases]) {
    const normalized = normalizeMerchantName(spelling);
    if (!normalized) {
      continue;
    }

    const rank =
      normalized === query
        ? 0
        : normalized.startsWith(query)
          ? 1
          : normalized.includes(query)
            ? 2
            : null;
    if (rank !== null && (bestRank === null || rank < bestRank)) {
      bestRank = rank;
    }
  }

  return bestRank;
}

export function filterAndSortMerchants<T extends MerchantSearchCandidate>(
  merchants: readonly T[],
  query: string,
): T[] {
  if (!query.trim()) {
    return [...merchants].sort(compareMerchantOrder);
  }

  const normalizedQuery = normalizeMerchantName(query);
  if (!normalizedQuery) {
    return [];
  }

  return merchants
    .map((merchant) => ({
      merchant,
      rank: matchRank(merchant, normalizedQuery),
    }))
    .filter(
      (
        candidate,
      ): candidate is { merchant: T; rank: number } =>
        candidate.rank !== null,
    )
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        compareMerchantOrder(left.merchant, right.merchant),
    )
    .map(({ merchant }) => merchant);
}
