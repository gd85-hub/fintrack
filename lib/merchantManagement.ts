import { normalizeMerchantName } from './receipts';

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
