import { describe, expect, it } from '@jest/globals';

import {
  centsToDecimal,
  centsToInput,
  commonCurrencies,
  convertAll,
  decimalToCents,
  distributeCents,
  formatMoney,
  formatRate,
  isCurrency,
  normalizeCurrencyCode,
  parseAmountInput,
} from '../money';

describe('commonCurrencies', () => {
  it('offers every covered currency in the quick selector', () => {
    expect(commonCurrencies).toEqual([
      'RSD',
      'USD',
      'EUR',
      'RUB',
      'KZT',
      'TRY',
      'GBP',
      'CHF',
    ]);
  });
});

describe('isCurrency', () => {
  it('recognizes currencies supported by frozen conversion', () => {
    expect(isCurrency('RSD')).toBe(true);
    expect(isCurrency('USD')).toBe(true);
    expect(isCurrency('EUR')).toBe(true);
    expect(isCurrency('TRY')).toBe(false);
  });
});

describe('parseAmountInput', () => {
  it('accepts comma and dot decimal separators identically', () => {
    expect(parseAmountInput('12,5')).toBe(1250);
    expect(parseAmountInput('12.5')).toBe(1250);
  });

  it('accepts whole values and two decimal places', () => {
    expect(parseAmountInput('25')).toBe(2500);
    expect(parseAmountInput('0,01')).toBe(1);
    expect(parseAmountInput('12.50')).toBe(1250);
  });

  it('rejects invalid input and thousands separators', () => {
    expect(parseAmountInput('')).toBeNull();
    expect(parseAmountInput('12,555')).toBeNull();
    expect(parseAmountInput('1 000')).toBeNull();
    expect(parseAmountInput('-5')).toBeNull();
  });

  it('characterizes grouped separators and boundary input shapes', () => {
    // Contrary to AGENTS.md, grouped Serbian input is currently rejected.
    expect(parseAmountInput('1.234,56')).toBeNull();
    expect(parseAmountInput('1.234')).toBeNull();
    expect(parseAmountInput(' 12,50 ')).toBe(1250);
    expect(parseAmountInput('007')).toBe(700);
    expect(parseAmountInput('.5')).toBeNull();
    expect(parseAmountInput('12,')).toBeNull();
  });
});

describe('normalizeCurrencyCode', () => {
  it('normalizes valid free-form ISO-style codes', () => {
    expect(normalizeCurrencyCode(' tmt ')).toBe('TMT');
    expect(normalizeCurrencyCode('US')).toBeNull();
    expect(normalizeCurrencyCode('12A')).toBeNull();
  });
});

describe('distributeCents', () => {
  it('assigns every cent using deterministic remainder correction', () => {
    const shares = distributeCents(100, [1, 1, 1]);

    expect(shares).toEqual([34, 33, 33]);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(100);
  });

  it('distributes proportionally and keeps the exact requested total', () => {
    const shares = distributeCents(10_001, [10_000, 20_000]);

    expect(shares).toEqual([3_334, 6_667]);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(10_001);
  });

  it('handles zero totals and a single weight', () => {
    expect(distributeCents(0, [])).toEqual([]);
    expect(distributeCents(0, [1, 2])).toEqual([0, 0]);
    expect(distributeCents(10, [1])).toEqual([10]);
  });

  it('rejects missing positive weights and negative totals', () => {
    expect(() => distributeCents(5, [0, 0])).toThrow(
      'At least one positive weight is required.',
    );
    expect(() => distributeCents(-1, [1])).toThrow(
      'Total must be a non-negative integer number of cents.',
    );
  });
});

describe('convertAll', () => {
  it('converts from RSD through the canonical RSD path', () => {
    expect(convertAll(123456, 'RSD', 100, 125)).toEqual({
      rsd: 123456,
      usd: 1235,
      eur: 988,
    });
  });

  it('converts from USD through RSD', () => {
    expect(convertAll(100, 'USD', 117.5, 125)).toEqual({
      rsd: 11750,
      usd: 100,
      eur: 94,
    });
  });

  it('converts from EUR through RSD', () => {
    expect(convertAll(2500, 'EUR', 100, 125)).toEqual({
      rsd: 312500,
      usd: 3125,
      eur: 2500,
    });
  });

  it('rounds half up to whole cents', () => {
    expect(convertAll(1, 'RSD', 2, 2)).toEqual({
      rsd: 1,
      usd: 1,
      eur: 1,
    });
  });

  it('returns zero in every currency for a zero amount', () => {
    expect(convertAll(0, 'RSD', 100, 117)).toEqual({
      rsd: 0,
      usd: 0,
      eur: 0,
    });
  });

  it('rejects negative amounts and non-positive exchange rates', () => {
    expect(() => convertAll(-1, 'RSD', 100, 117)).toThrow(
      'Amount must be a non-negative integer number of cents.',
    );
    expect(() => convertAll(100, 'USD', 0, 117)).toThrow(
      'Exchange rates must be positive.',
    );
  });

  it('rounds values below half a cent down', () => {
    expect(convertAll(1, 'RSD', 4, 4)).toEqual({
      rsd: 1,
      usd: 0,
      eur: 0,
    });
  });
});

describe('formatMoney', () => {
  it('uses spaces and comma decimals', () => {
    expect(formatMoney(123456)).toBe('1 234,56');
    expect(formatMoney(12)).toBe('0,12');
  });

  it('formats zero, small, large, and negative amounts', () => {
    expect(formatMoney(0)).toBe('0,00');
    expect(formatMoney(5)).toBe('0,05');
    expect(formatMoney(100)).toBe('1,00');
    expect(formatMoney(123456789)).toBe('1 234 567,89');
    expect(formatMoney(-2550)).toBe('-25,50');
  });
});

describe('formatRate', () => {
  it('uses adaptive decimal precision with the money decimal separator', () => {
    expect(formatRate(117.42)).toBe('117,42');
    expect(formatRate(1.0858)).toBe('1,0858');
    expect(formatRate(1.2)).toBe('1,20');
    expect(formatRate(0.0085)).toBe('0,0085');
  });

  it('keeps small values out of exponential notation', () => {
    const formatted = formatRate(0.000000123456);

    expect(formatted.toLowerCase()).not.toContain('e');
    expect(formatted).toBe('0,000000123456');
  });
});

describe('centsToInput', () => {
  it('formats cents for editable input', () => {
    expect(centsToInput(100)).toBe('1');
    expect(centsToInput(150)).toBe('1,50');
    expect(centsToInput(5)).toBe('0,05');
    expect(centsToInput(0)).toBe('0');
  });
});

describe('centsToDecimal', () => {
  it('formats cents as a database decimal string', () => {
    expect(centsToDecimal(12345)).toBe('123.45');
    expect(centsToDecimal(5)).toBe('0.05');
    expect(centsToDecimal(-500)).toBe('-5.00');
  });
});

describe('decimalToCents', () => {
  it('converts database decimal values to cents', () => {
    expect(decimalToCents(null)).toBe(0);
    expect(decimalToCents('123.45')).toBe(12345);
    expect(decimalToCents(123.45)).toBe(12345);
    expect(decimalToCents('0')).toBe(0);
    expect(decimalToCents('1.999')).toBe(200);
  });

  it('rejects invalid and non-finite database values', () => {
    expect(() => decimalToCents('abc')).toThrow(
      'Invalid database money value.',
    );
    expect(() => decimalToCents(Infinity)).toThrow();
  });

  it('characterizes the IEEE-754 half-cent boundary', () => {
    // 1.005 * 100 is 100.4999..., so the current half-up helper returns 100.
    expect(decimalToCents(1.005)).toBe(100);
  });
});
