import type { AnalyticsExpense, ExpenseCategoryType } from './db';
import {
  displayAmountForExpense,
  sumExpenseDisplayAmounts,
  type RateLookup,
} from './homeDisplay';

export type DisplayCategory = {
  amount: number | null;
  categoryId: string;
  count: number;
  emoji: string;
  group: string;
  name: string;
};

export type DisplayCategoryBreakdown = {
  categories: DisplayCategory[];
  total: number | null;
};

export type DisplayMerchant = {
  amount: number | null;
  count: number;
  merchantId: string | null;
  name: string | null;
};

export type DisplayMerchantBreakdown = {
  merchants: DisplayMerchant[];
  total: number | null;
};

export type DisplayFixedVariableCategory = {
  amount: number | null;
  categoryId: string;
  count: number;
  emoji: string;
  name: string;
};

export type DisplayFixedVariableBucket = {
  amount: number | null;
  categories: DisplayFixedVariableCategory[];
  count: number;
  type: ExpenseCategoryType;
};

export type DisplayFixedVariableBreakdown = {
  buckets: DisplayFixedVariableBucket[];
  total: number | null;
};

function displaySource(expense: AnalyticsExpense) {
  return {
    amountEurCents: expense.amountEur,
    occurredOn: expense.occurredOn,
    originalAmountCents: expense.originalAmountCents,
    originalCurrency: expense.originalCurrency,
  };
}

export function displayAnalyticsExpenseAmount(
  expense: AnalyticsExpense,
  displayCurrency: string,
  rateAt: RateLookup,
): number | null {
  return displayAmountForExpense(
    displaySource(expense),
    displayCurrency,
    rateAt,
  );
}

export function displayTotal(
  expenses: readonly AnalyticsExpense[],
  displayCurrency: string,
  rateAt: RateLookup,
): number | null {
  return sumExpenseDisplayAmounts(
    expenses.map(displaySource),
    displayCurrency,
    rateAt,
  );
}

export function displayCategoryBreakdown(
  expenses: readonly AnalyticsExpense[],
  displayCurrency: string,
  rateAt: RateLookup,
): DisplayCategoryBreakdown {
  const groups = new Map<
    string,
    { expenses: AnalyticsExpense[]; first: AnalyticsExpense }
  >();

  for (const expense of expenses) {
    const current = groups.get(expense.categoryId);
    if (current) {
      current.expenses.push(expense);
    } else {
      groups.set(expense.categoryId, { expenses: [expense], first: expense });
    }
  }

  return {
    categories: [...groups.values()].map(({ expenses: rows, first }) => ({
      amount: displayTotal(rows, displayCurrency, rateAt),
      categoryId: first.categoryId,
      count: rows.length,
      emoji: first.categoryEmoji,
      group: first.categoryGroup,
      name: first.categoryName,
    })),
    total: displayTotal(expenses, displayCurrency, rateAt),
  };
}

export function displayMerchantBreakdown(
  expenses: readonly AnalyticsExpense[],
  displayCurrency: string,
  rateAt: RateLookup,
): DisplayMerchantBreakdown {
  const groups = new Map<
    string,
    { expenses: AnalyticsExpense[]; first: AnalyticsExpense }
  >();

  for (const expense of expenses) {
    const key = expense.merchantId ?? 'unknown';
    const current = groups.get(key);
    if (current) {
      current.expenses.push(expense);
    } else {
      groups.set(key, { expenses: [expense], first: expense });
    }
  }

  return {
    merchants: [...groups.values()].map(({ expenses: rows, first }) => ({
      amount: displayTotal(rows, displayCurrency, rateAt),
      count: rows.length,
      merchantId: first.merchantId,
      name: first.merchantName,
    })),
    total: displayTotal(expenses, displayCurrency, rateAt),
  };
}

export function displayFixedVariableBreakdown(
  expenses: readonly AnalyticsExpense[],
  displayCurrency: string,
  rateAt: RateLookup,
): DisplayFixedVariableBreakdown {
  const bucketRows: Record<ExpenseCategoryType, AnalyticsExpense[]> = {
    fixed: [],
    variable: [],
  };

  for (const expense of expenses) {
    bucketRows[expense.categoryType].push(expense);
  }

  const buckets = (['fixed', 'variable'] as const).map((type) => {
    const rows = bucketRows[type];
    const categories = displayCategoryBreakdown(rows, displayCurrency, rateAt);
    return {
      amount: displayTotal(rows, displayCurrency, rateAt),
      categories: categories.categories.map((category) => ({
        amount: category.amount,
        categoryId: category.categoryId,
        count: category.count,
        emoji: category.emoji,
        name: category.name,
      })),
      count: rows.length,
      type,
    };
  });

  return {
    buckets,
    total: displayTotal(expenses, displayCurrency, rateAt),
  };
}
