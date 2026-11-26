import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

import {
  __resetLastManualCurrencyCacheForTests,
  readLastManualCurrency,
  rememberLastManualCurrency,
} from '../lastCurrency';

const mockGetItem = jest.fn<(key: string) => Promise<string | null>>();
const mockSetItem = jest.fn<(key: string, value: string) => Promise<void>>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (key: string) => mockGetItem(key),
  setItem: (key: string, value: string) => mockSetItem(key, value),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

describe('readLastManualCurrency', () => {
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    mockGetItem.mockReset();
    mockSetItem.mockReset();
    __resetLastManualCurrencyCacheForTests();
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
    __resetLastManualCurrencyCacheForTests();
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

describe('account-scoped currency cache', () => {
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    mockGetItem.mockReset();
    mockSetItem.mockReset();
    mockSetItem.mockResolvedValue(undefined);
    __resetLastManualCurrencyCacheForTests();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  test('one account never inherits another account cached currency', async () => {
    await rememberLastManualCurrency('account-a', 'USD');
    mockGetItem.mockResolvedValue(null);

    await expect(readLastManualCurrency('account-a')).resolves.toBe('USD');
    await expect(readLastManualCurrency('account-b')).resolves.toBeNull();
    // account-b is read from storage (its own key), not from account-a's cache.
    expect(mockGetItem).toHaveBeenCalledWith('last_manual_currency:account-b');
  });

  test('the in-session value is preferred over storage without reading it', async () => {
    await rememberLastManualCurrency('user-1', 'USD');
    mockGetItem.mockResolvedValue('EUR');

    await expect(readLastManualCurrency('user-1')).resolves.toBe('USD');
    expect(mockGetItem).not.toHaveBeenCalled();
  });

  test('a read in flight before a newer save returns the newer value', async () => {
    const pendingRead = deferred<string | null>();
    mockGetItem.mockReturnValue(pendingRead.promise);

    const readPromise = readLastManualCurrency('user-1');
    // A save lands while the read is still awaiting storage.
    await rememberLastManualCurrency('user-1', 'EUR');
    // Storage finally returns the older value; the newer save must win.
    pendingRead.resolve('USD');

    await expect(readPromise).resolves.toBe('EUR');
  });

  test('overlapping saves never persist an older value after a newer one', async () => {
    const firstWrite = deferred<void>();
    mockSetItem.mockReturnValueOnce(firstWrite.promise);
    mockSetItem.mockResolvedValue(undefined);

    const firstSave = rememberLastManualCurrency('user-1', 'USD');
    const secondSave = rememberLastManualCurrency('user-1', 'EUR');

    // The in-session value is already the newest.
    await expect(readLastManualCurrency('user-1')).resolves.toBe('EUR');

    firstWrite.resolve();
    await Promise.all([firstSave, secondSave]);

    // Every persisted value is the newest; the older USD is never written.
    for (const call of mockSetItem.mock.calls) {
      expect(call[1]).toBe('EUR');
    }
    expect(mockSetItem).not.toHaveBeenCalledWith(
      'last_manual_currency:user-1',
      'USD',
    );
  });

  test('a reopen during a pending write still reads the saved currency', async () => {
    const pendingWrite = deferred<void>();
    mockSetItem.mockReturnValue(pendingWrite.promise);

    // Do not await: the write is still pending.
    void rememberLastManualCurrency('user-1', 'USD');

    // A newly mounted screen reads the same account before the write lands.
    await expect(readLastManualCurrency('user-1')).resolves.toBe('USD');
    expect(mockGetItem).not.toHaveBeenCalled();

    pendingWrite.resolve();
  });

  test('writes are scoped to each account key', async () => {
    await rememberLastManualCurrency('account-a', 'USD');
    await rememberLastManualCurrency('account-b', 'EUR');

    expect(mockSetItem).toHaveBeenCalledWith(
      'last_manual_currency:account-a',
      'USD',
    );
    expect(mockSetItem).toHaveBeenCalledWith(
      'last_manual_currency:account-b',
      'EUR',
    );
  });

  test('a custom currency is cached and preferred over storage', async () => {
    await rememberLastManualCurrency('user-1', ' thb ');
    mockGetItem.mockResolvedValue('USD');

    await expect(readLastManualCurrency('user-1')).resolves.toBe('THB');
    expect(mockGetItem).not.toHaveBeenCalled();
  });
});
