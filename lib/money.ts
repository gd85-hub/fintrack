import { SUPPORTED_HOME_CURRENCIES } from './homeCurrency';

export const currencies = ['RSD', 'USD', 'EUR'] as const;
export const commonCurrencies = [
  'RSD',
  'USD',
  'EUR',
  ...SUPPORTED_HOME_CURRENCIES.filter(
    (currency) =>
      currency !== 'RSD' &&
      currency !== 'USD' &&
      currency !== 'EUR',
  ),
] as readonly string[];

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

// No grouping: a plain integer, optionally followed by a 1–2 digit decimal
// using either separator (`1234`, `1234,56`, `1234.56`, `12,5`).
const UNGROUPED_PATTERN = /^\d+(?:[.,]\d{1,2})?$/;

// Serbian dot grouping: a 1–3 digit lead group then one or more exact 3-digit
// groups (`1.234`, `12.345`, `1.234.567`); the decimal separator, when present,
// must be a comma (`1.234,56`).
const DOT_GROUPED_PATTERN = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/;

// Space grouping, including NBSP/narrow NBSP already normalised to a plain
// space (`1 234`, `1 234 567`); the decimal separator may be a comma or a dot
// (`1 234,56`, `1 234.56`).
const SPACE_GROUPED_PATTERN = /^\d{1,3}(?: \d{3})+(?:[.,]\d{1,2})?$/;

// Unicode thousands separators a user may paste from formatted text.
const GROUPING_SPACES = /[  ]/g;

export function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

// Parses a user-entered amount into integer cents, or null when the input is
// not an unambiguously valid unsigned amount. Accepted shapes: ungrouped
// values, Serbian dot grouping (comma decimal), and space grouping (comma or
// dot decimal). Comma thousands separators (`1,234.56`), negatives, and
// malformed grouping are rejected. See BUG-6 and lib/__tests__/money.test.ts.
export function parseAmountInput(text: string): number | null {
  const trimmed = text.trim();

  if (trimmed === '') {
    return null;
  }

  const normalized = trimmed.replace(GROUPING_SPACES, ' ');

  let canonical: string;
  if (UNGROUPED_PATTERN.test(normalized)) {
    canonical = normalized.replace(',', '.');
  } else if (DOT_GROUPED_PATTERN.test(normalized)) {
    canonical = normalized.replace(/\./g, '').replace(',', '.');
  } else if (SPACE_GROUPED_PATTERN.test(normalized)) {
    canonical = normalized.replace(/ /g, '').replace(',', '.');
  } else {
    return null;
  }

  const [whole, fraction = ''] = canonical.split('.');
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

export function formatRate(value: number): string {
  const options: Intl.NumberFormatOptions =
    value >= 100
      ? {
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
          useGrouping: false,
        }
      : value >= 1
        ? {
            maximumFractionDigits: 4,
            minimumFractionDigits: 2,
            useGrouping: false,
          }
        : {
            maximumSignificantDigits: 6,
            useGrouping: false,
          };

  return new Intl.NumberFormat('ru-RU', options).format(value);
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
