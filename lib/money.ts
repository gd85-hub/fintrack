export const currencies = ['RSD', 'USD', 'EUR'] as const;

export type Currency = (typeof currencies)[number];

export function isCurrency(value: string): value is Currency {
  return currencies.some((currency) => currency === value);
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
