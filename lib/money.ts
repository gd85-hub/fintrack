export const currencies = ['RSD', 'USD', 'EUR'] as const;
export const commonCurrencies = [
  'RSD',
  'USD',
  'EUR',
  'KZT',
  'RUB',
  'TRY',
] as const;

export type Currency = (typeof currencies)[number];

export function isCurrency(value: string): value is Currency {
  return currencies.some((currency) => currency === value);
}

export function normalizeCurrencyCode(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3}$/u.test(normalized) ? normalized : null;
}

export function distributeCents(
  totalCents: number,
  weights: readonly number[],
): number[] {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) {
    throw new Error('Total must be a non-negative integer number of cents.');
  }
  if (
    weights.some(
      (weight) => !Number.isSafeInteger(weight) || weight < 0,
    )
  ) {
    throw new Error('Weights must be non-negative integer numbers.');
  }
  if (weights.length === 0) {
    if (totalCents === 0) {
      return [];
    }
    throw new Error('At least one positive weight is required.');
  }

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (!Number.isSafeInteger(totalWeight) || totalWeight <= 0) {
    if (totalCents === 0 && totalWeight === 0) {
      return weights.map(() => 0);
    }
    throw new Error('At least one positive weight is required.');
  }

  const denominator = BigInt(totalWeight);
  const shares = weights.map((weight) =>
    Number((BigInt(totalCents) * BigInt(weight)) / denominator),
  );
  const remainders = weights.map((weight, index) => ({
    index,
    remainder:
      (BigInt(totalCents) * BigInt(weight)) % denominator,
  }));
  remainders.sort((left, right) => {
    if (left.remainder === right.remainder) {
      return left.index - right.index;
    }
    return left.remainder > right.remainder ? -1 : 1;
  });

  const unassigned =
    totalCents - shares.reduce((sum, share) => sum + share, 0);
  for (let index = 0; index < unassigned; index += 1) {
    const remainder = remainders[index];
    if (!remainder) {
      throw new Error('Unable to distribute the total exactly.');
    }
    shares[remainder.index] += 1;
  }

  return shares;
}

export type ConvertedAmounts = {
  rsd: number;
  usd: number;
  eur: number;
};

const AMOUNT_PATTERN = /^\d+(?:[.,]\d{1,2})?$/;

function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

export function parseAmountInput(text: string): number | null {
  const normalized = text.trim();

  if (!AMOUNT_PATTERN.test(normalized)) {
    return null;
  }

  const [whole, fraction = ''] = normalized.replace(',', '.').split('.');
  const paddedFraction = fraction.padEnd(2, '0');
  const cents = Number(whole) * 100 + Number(paddedFraction);

  return Number.isSafeInteger(cents) ? cents : null;
}

export function convertAll(
  cents: number,
  currency: Currency,
  usdRsd: number,
  eurRsd: number,
): ConvertedAmounts {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error('Amount must be a non-negative integer number of cents.');
  }

  if (usdRsd <= 0 || eurRsd <= 0) {
    throw new Error('Exchange rates must be positive.');
  }

  if (currency === 'RSD') {
    return {
      rsd: cents,
      usd: roundHalfUp(cents / usdRsd),
      eur: roundHalfUp(cents / eurRsd),
    };
  }

  if (currency === 'USD') {
    const rsd = roundHalfUp(cents * usdRsd);
    return {
      rsd,
      usd: cents,
      eur: roundHalfUp(rsd / eurRsd),
    };
  }

  const rsd = roundHalfUp(cents * eurRsd);
  return {
    rsd,
    usd: roundHalfUp(rsd / usdRsd),
    eur: cents,
  };
}

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absoluteCents = Math.abs(cents);
  const whole = Math.floor(absoluteCents / 100);
  const fraction = String(absoluteCents % 100).padStart(2, '0');
  const groupedWhole = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  return `${sign}${groupedWhole},${fraction}`;
}

export function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absoluteCents = Math.abs(cents);
  const whole = Math.floor(absoluteCents / 100);
  const fraction = String(absoluteCents % 100).padStart(2, '0');
  return `${sign}${whole}.${fraction}`;
}

export function decimalToCents(value: number | string | null): number {
  if (value === null) {
    return 0;
  }

  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    throw new Error('Invalid database money value.');
  }

  return roundHalfUp(numericValue * 100);
}

export function centsToInput(cents: number): string {
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  return fraction === 0
    ? String(whole)
    : `${whole},${String(fraction).padStart(2, '0')}`;
}
