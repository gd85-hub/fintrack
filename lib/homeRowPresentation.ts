type PurchaseItemCandidate = {
  categoryName?: string;
  description: string;
  merchantName?: string | null;
  originalAmountCents: number;
  originalCurrency: string;
  quantity?: number | null;
  unitPriceCents?: number | null;
};

export type CollapsedPurchaseItem<T extends PurchaseItemCandidate> = {
  count: number;
  displayName: string;
  expenses: T[];
  firstExpense: T;
  originalAmountCents: number;
  unitPriceCents: number;
};

export type HomeRowPresentation = {
  expandable: true;
  kind: 'expense' | 'purchase';
};

function purchaseItemDisplayName(item: PurchaseItemCandidate): string {
  return item.description.trim() || item.categoryName?.trim() || '';
}

export function resolveHomeRowHeader(
  items: readonly PurchaseItemCandidate[],
): string {
  const merchantName = items
    .find((item) => item.merchantName?.trim())
    ?.merchantName?.trim();
  if (merchantName) {
    return merchantName;
  }

  const firstItem = items[0];
  return firstItem ? purchaseItemDisplayName(firstItem) : '';
}

function purchaseItemUnitPrice(item: PurchaseItemCandidate): number {
  if (item.unitPriceCents !== null && item.unitPriceCents !== undefined) {
    return item.unitPriceCents;
  }

  if (
    item.quantity !== null &&
    item.quantity !== undefined &&
    item.quantity > 0 &&
    item.quantity !== 1
  ) {
    return Math.round(item.originalAmountCents / item.quantity);
  }

  return item.originalAmountCents;
}

export function collapseIdenticalPurchaseItems<
  T extends PurchaseItemCandidate,
>(items: readonly T[]): CollapsedPurchaseItem<T>[] {
  const groups: CollapsedPurchaseItem<T>[] = [];
  const groupIndexes = new Map<string, number>();

  for (const item of items) {
    const displayName = purchaseItemDisplayName(item);
    const unitPriceCents = purchaseItemUnitPrice(item);
    const key = JSON.stringify([
      displayName,
      item.originalCurrency,
      unitPriceCents,
    ]);
    const existingIndex = groupIndexes.get(key);

    if (existingIndex !== undefined) {
      const group = groups[existingIndex];
      if (group) {
        group.count += 1;
        group.expenses.push(item);
        group.originalAmountCents += item.originalAmountCents;
      }
      continue;
    }

    groupIndexes.set(key, groups.length);
    groups.push({
      count: 1,
      displayName,
      expenses: [item],
      firstExpense: item,
      originalAmountCents: item.originalAmountCents,
      unitPriceCents,
    });
  }

  return groups;
}

export function decideHomeRowPresentation(
  itemCount: number,
): HomeRowPresentation {
  return {
    expandable: true,
    kind: itemCount >= 2 ? 'purchase' : 'expense',
  };
}
