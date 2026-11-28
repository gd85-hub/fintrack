import type { Expense } from './db';
import {
  buildExpenseSearchIndex,
  searchExpenseIndex,
  type ExpenseSearchIndex,
  type ExpenseSearchOptions,
} from './expenseSearch';
import {
  buildPurchaseUnits,
  groupExpensesByDate,
  type PurchaseUnit,
} from './homePurchaseGrouping';

export type PurchaseSearchResult<T extends Expense = Expense> = Readonly<{
  matchingExpenses: readonly T[];
  purchase: PurchaseUnit<T>;
}>;

export type PurchaseSearchDay<T extends Expense = Expense> = Readonly<{
  date: string;
  results: readonly PurchaseSearchResult<T>[];
}>;

export type PurchaseSearchResults<T extends Expense = Expense> = Readonly<{
  days: readonly PurchaseSearchDay<T>[];
  matchingExpenseCount: number;
  purchaseCount: number;
}>;

export type PurchaseSearchSourceDay<T extends Expense = Expense> = Readonly<{
  date: string;
  purchases: readonly PurchaseUnit<T>[];
}>;

export type PurchaseSearchIndex<T extends Expense = Expense> = Readonly<{
  expenseIndex: ExpenseSearchIndex<T>;
  purchaseDays: readonly PurchaseSearchSourceDay<T>[];
}>;

/**
 * Prepares both lexical matching and Home-compatible purchase/day grouping
 * once for an already-loaded expense dataset. Rebuild when the dataset or
 * trusted labels change; query evaluation performs neither operation again.
 */
export function buildPurchaseSearchIndex<T extends Expense>(
  expenses: readonly T[],
  options: ExpenseSearchOptions<T> = {},
): PurchaseSearchIndex<T> {
  return {
    expenseIndex: buildExpenseSearchIndex(expenses, options),
    purchaseDays: groupExpensesByDate(expenses).map((group) => ({
      date: group.date,
      purchases: buildPurchaseUnits(group.expenses),
    })),
  };
}

/**
 * Lifts matching expense records into complete Home purchase units. Matching
 * IDs select purchases, but result references and ordering always come from
 * the prepared dataset. `purchase.expenses` is never narrowed to the matches.
 *
 * This assembly boundary is independent of the match provider: a future
 * lexical or semantic provider can supply matching persisted Expense records
 * without changing purchase identity, totals, edit/delete keys or grouping.
 */
export function assemblePurchaseSearchResults<T extends Expense>(
  purchaseDays: readonly PurchaseSearchSourceDay<T>[],
  matchingExpenses: readonly Pick<Expense, 'id'>[],
): PurchaseSearchResults<T> {
  const matchingIds = new Set(matchingExpenses.map(({ id }) => id));
  const days: PurchaseSearchDay<T>[] = [];
  let matchingExpenseCount = 0;
  let purchaseCount = 0;

  for (const day of purchaseDays) {
    const results: PurchaseSearchResult<T>[] = [];

    for (const purchase of day.purchases) {
      const purchaseMatches = purchase.expenses.filter((expense) =>
        matchingIds.has(expense.id),
      );
      if (purchaseMatches.length === 0) {
        continue;
      }

      results.push({
        matchingExpenses: purchaseMatches,
        purchase,
      });
      matchingExpenseCount += purchaseMatches.length;
      purchaseCount += 1;
    }

    if (results.length > 0) {
      days.push({ date: day.date, results });
    }
  }

  return { days, matchingExpenseCount, purchaseCount };
}

/**
 * Runs SEARCH-01A matching and assembles complete purchase-level results.
 * Empty queries therefore include every purchase; punctuation-only queries
 * include none, exactly as defined by the expense search engine.
 */
export function searchPurchaseIndex<T extends Expense>(
  index: PurchaseSearchIndex<T>,
  query: string,
): PurchaseSearchResults<T> {
  return assemblePurchaseSearchResults(
    index.purchaseDays,
    searchExpenseIndex(index.expenseIndex, query),
  );
}
