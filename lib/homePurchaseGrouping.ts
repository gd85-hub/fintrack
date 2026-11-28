import type { Expense } from './db';

export type ExpenseGroup<T extends Expense = Expense> = {
  date: string;
  expenses: T[];
};

export type PurchaseUnit<T extends Expense = Expense> = {
  expenses: T[];
  key: string;
  receiptId: string | null;
};

export function groupExpensesByDate<T extends Expense>(
  expenses: readonly T[],
): ExpenseGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const expense of expenses) {
    const group = groups.get(expense.occurredOn) ?? [];
    group.push(expense);
    groups.set(expense.occurredOn, group);
  }

  return [...groups.entries()].map(([date, groupedExpenses]) => ({
    date,
    expenses: groupedExpenses,
  }));
}

export function buildPurchaseUnits<T extends Expense>(
  expenses: readonly T[],
): PurchaseUnit<T>[] {
  const units: PurchaseUnit<T>[] = [];
  const receiptUnitIndexes = new Map<string, number>();

  for (const expense of expenses) {
    if (expense.receiptId === null) {
      units.push({
        expenses: [expense],
        key: `expense:${expense.id}`,
        receiptId: null,
      });
      continue;
    }

    const existingIndex = receiptUnitIndexes.get(expense.receiptId);
    if (existingIndex !== undefined) {
      units[existingIndex]?.expenses.push(expense);
      continue;
    }

    receiptUnitIndexes.set(expense.receiptId, units.length);
    units.push({
      expenses: [expense],
      key: `receipt:${expense.receiptId}`,
      receiptId: expense.receiptId,
    });
  }

  return units;
}
