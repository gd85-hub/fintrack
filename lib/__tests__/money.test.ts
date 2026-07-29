import { describe, expect, it } from '@jest/globals';

import {
  convertAll,
  formatMoney,
  parseAmountInput,
} from '../money';

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
});

describe('formatMoney', () => {
  it('uses spaces and comma decimals', () => {
    expect(formatMoney(123456)).toBe('1 234,56');
    expect(formatMoney(12)).toBe('0,12');
  });
});
