import type { Expense } from './db';
import {
  ANCHOR_CURRENCY,
  displayCents,
  sumDisplayCents,
} from './fxDisplay';

export type RateLookup = (dateISO: string) => number | null;

export type HomeDisplayExpense = Pick<
  Expense,
  | 'amountEurCents'
  | 'occurredOn'
  | 'originalAmountCents'
  | 'originalCurrency'
>;

export type DisplayAggregate = {
  cents: number;
  unavailable: number;
};

function normalizedCode(value: string): string {
  return value.trim().toUpperCase();
}

export function displayAmountForExpense(
  expense: HomeDisplayExpense,
  displayCurrency: string,
  rateAt: RateLookup,
): number | null {
  const normalizedDisplayCurrency = normalizedCode(displayCurrency);

  if (normalizedDisplayCurrency === normalizedCode(expense.originalCurrency)) {
    return expense.originalAmountCents;
  }

  if (expense.amountEurCents === null) {
    return null;
  }

  return displayCents(
    {
      originalCents: expense.originalAmountCents,
      originalCurrency: expense.originalCurrency,
      anchorCents: expense.amountEurCents,
    },
    normalizedDisplayCurrency,
    normalizedDisplayCurrency === ANCHOR_CURRENCY
      ? null
      : rateAt(expense.occurredOn),
  );
}

export function sumExpenseDisplayAmounts(
  expenses: readonly HomeDisplayExpense[],
  displayCurrency: string,
  rateAt: RateLookup,
): number | null {
  return sumDisplayCents(
    expenses.map((expense) =>
      displayAmountForExpense(expense, displayCurrency, rateAt),
    ),
  );
}

export function aggregateDisplayAmounts(
  expenses: readonly HomeDisplayExpense[],
  displayCurrency: string,
  rateAt: RateLookup,
): DisplayAggregate {
  let cents = 0;
  let unavailable = 0;

  for (const expense of expenses) {
    const value = displayAmountForExpense(
      expense,
      displayCurrency,
      rateAt,
    );
    if (value === null) {
      unavailable += 1;
    } else {
      // Values are rounded at the row boundary; aggregates only add cents.
      cents += value;
    }
  }

  return { cents, unavailable };
}
