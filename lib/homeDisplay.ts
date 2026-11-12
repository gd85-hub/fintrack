import type { Expense } from './db';
import {
  ANCHOR_CURRENCY,
  displayCents,
  sumDisplayCents,
} from './fxDisplay';

export type RateLookup = (dateISO: string) => number | null;

type HomeDisplayExpense = Pick<
  Expense,
  | 'amountEurCents'
  | 'occurredOn'
  | 'originalAmountCents'
  | 'originalCurrency'
>;

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
