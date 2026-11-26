import { normalizeMerchantName } from './receipts';

// Single source of truth for a merchant's name on write. Both createMerchant
// and renameMerchant pass user input through here, so the repository can never
// persist an empty or whitespace-only name even if a future UI path skips its
// own validation. Returns the trimmed name; throws the existing user-facing
// message when nothing is left after trimming.
export function requireMerchantName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Укажите название места.');
  }
  return trimmed;
}

type MerchantNameCandidate = {
  id: string;
  name: string;
};

export function findMerchantRenameCollision<
  T extends MerchantNameCandidate,
>(
  merchants: readonly T[],
  merchantId: string,
  nextName: string,
): T | null {
  const nextKey = normalizeMerchantName(nextName);
  if (!nextKey) {
    return null;
  }

  return (
    merchants.find(
      (merchant) =>
        merchant.id !== merchantId &&
        normalizeMerchantName(merchant.name) === nextKey,
    ) ?? null
  );
}

export function merchantUsageCounts(
  merchantIds: readonly string[],
  expenseMerchantIds: readonly (string | null)[],
): Map<string, number> {
  const counts = new Map(
    merchantIds.map((merchantId) => [merchantId, 0]),
  );

  for (const merchantId of expenseMerchantIds) {
    if (merchantId && counts.has(merchantId)) {
      counts.set(merchantId, (counts.get(merchantId) ?? 0) + 1);
    }
  }

  return counts;
}
