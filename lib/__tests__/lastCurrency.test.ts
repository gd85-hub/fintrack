import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import {
  readLastManualCurrency,
  rememberLastManualCurrency,
} from '../lastCurrency';

const mockGetItem = jest.fn<(key: string) => Promise<string | null>>();
const mockSetItem = jest.fn<(key: string, value: string) => Promise<void>>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (key: string) => mockGetItem(key),
  setItem: (key: string, value: string) => mockSetItem(key, value),
}));

describe('readLastManualCurrency', () => {
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    mockGetItem.mockReset();
    mockSetItem.mockReset();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns null and reads nothing without an account', async () => {
    await expect(readLastManualCurrency(null)).resolves.toBeNull();
    await expect(readLastManualCurrency(undefined)).resolves.toBeNull();
    expect(mockGetItem).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test('returns null when nothing is stored', async () => {
    mockGetItem.mockResolvedValue(null);
    await expect(readLastManualCurrency('user-1')).resolves.toBeNull();
    expect(mockGetItem).toHaveBeenCalledWith('last_manual_currency:user-1');
    errorSpy.mockRestore();
  });

  test('restores and normalizes a valid stored value', async () => {
    mockGetItem.mockResolvedValue(' eur ');
    await expect(readLastManualCurrency('user-1')).resolves.toBe('EUR');
    errorSpy.mockRestore();
  });

  test('restores a valid custom currency outside the home-currency set', async () => {
    mockGetItem.mockResolvedValue('THB');
    await expect(readLastManualCurrency('user-1')).resolves.toBe('THB');
    errorSpy.mockRestore();
  });

  test('falls back to null for an invalid stored value', async () => {
    mockGetItem.mockResolvedValue('not-a-currency');
    await expect(readLastManualCurrency('user-1')).resolves.toBeNull();
    errorSpy.mockRestore();
  });

  test('scopes the key to the account', async () => {
    mockGetItem.mockResolvedValue('USD');
    await readLastManualCurrency('account-a');
    await readLastManualCurrency('account-b');
    expect(mockGetItem).toHaveBeenNthCalledWith(
      1,
      'last_manual_currency:account-a',
    );
    expect(mockGetItem).toHaveBeenNthCalledWith(
      2,
      'last_manual_currency:account-b',
    );
    errorSpy.mockRestore();
  });

  test('returns null when storage read fails', async () => {
    mockGetItem.mockRejectedValue(new Error('disk error'));
    await expect(readLastManualCurrency('user-1')).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('rememberLastManualCurrency', () => {
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    mockGetItem.mockReset();
    mockSetItem.mockReset();
    mockSetItem.mockResolvedValue(undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('writes the normalized currency to the account-scoped key', async () => {
    await rememberLastManualCurrency('user-1', ' eur ');
    expect(mockSetItem).toHaveBeenCalledWith(
      'last_manual_currency:user-1',
      'EUR',
    );
    errorSpy.mockRestore();
  });

  test('keeps a custom currency', async () => {
    await rememberLastManualCurrency('user-1', 'THB');
    expect(mockSetItem).toHaveBeenCalledWith(
      'last_manual_currency:user-1',
      'THB',
    );
    errorSpy.mockRestore();
  });

  test('writes nothing without an account or for an invalid code', async () => {
    await rememberLastManualCurrency(null, 'EUR');
    await rememberLastManualCurrency('user-1', 'EU');
    expect(mockSetItem).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test('never throws when the write fails', async () => {
    mockSetItem.mockRejectedValue(new Error('disk full'));
    await expect(
      rememberLastManualCurrency('user-1', 'USD'),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
