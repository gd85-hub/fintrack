import { roundHalfUp } from './money';

export const ANCHOR_CURRENCY = 'EUR';

export type DisplayableAmount = {
  originalCents: number;
  originalCurrency: string;
  anchorCents: number;
};

function assertValidCents(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer number of cents.`);
  }
}

function normalizedCode(value: string): string {
  return value.trim().toUpperCase();
}

export function displayCents(
  amount: DisplayableAmount,
  displayCurrency: string,
  ratePerEur: number | null,
): number | null {
  assertValidCents(amount.originalCents, 'Original amount');
  assertValidCents(amount.anchorCents, 'Anchor amount');

  const originalCurrency = normalizedCode(amount.originalCurrency);
  const normalizedDisplayCurrency = normalizedCode(displayCurrency);

  if (normalizedDisplayCurrency === originalCurrency) {
    return amount.originalCents;
  }

  if (normalizedDisplayCurrency === ANCHOR_CURRENCY) {
    return amount.anchorCents;
  }

  if (
    ratePerEur === null ||
    !Number.isFinite(ratePerEur) ||
    ratePerEur <= 0
  ) {
    return null;
  }

  return roundHalfUp(amount.anchorCents * ratePerEur);
}

export function sumDisplayCents(
  values: ReadonlyArray<number | null>,
): number | null {
  let total = 0;

  for (const value of values) {
    if (value === null) {
      return null;
    }
    total += value;
  }

  return total;
}
