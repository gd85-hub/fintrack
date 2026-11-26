import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeCurrencyCode } from './money';

// Per-account, per-device memory of the currency a user last used for a manual
// expense. Account-scoped so one account's choice never leaks into another on
// the same device. Only a currency code is ever stored — never an amount,
// merchant, category or any other transaction data.
const KEY_PREFIX = 'last_manual_currency:';

function storageKey(accountId: string): string {
  return `${KEY_PREFIX}${accountId}`;
}

// Account-scoped in-memory cache of the currency saved this app session. It is
// module-level, so it survives screen unmount/remount: a freshly opened editor
// (even a new screen instance) sees a just-saved currency before the AsyncStorage
// write lands, closing the reopen-vs-pending-write race. Keyed by account, so it
// honours the same isolation contract as storage.
const latestByAccount = new Map<string, string>();

// One running write promise per account. New writes chain onto it so they run in
// order and an older write can never overwrite a newer persisted value.
const writeChains = new Map<string, Promise<void>>();

// Returns the remembered manual-expense currency for this account, or null when
// none is known, the account is unknown, the stored value is not a valid ISO
// code, or storage cannot be read. The in-session value (newest) wins over
// storage. Custom (any valid ISO) currencies are preserved; a corrupt stored
// value falls back to null.
export async function readLastManualCurrency(
  accountId: string | null | undefined,
): Promise<string | null> {
  if (!accountId) {
    return null;
  }

  // The newest value saved this session is authoritative over storage.
  const cached = latestByAccount.get(accountId);
  if (cached) {
    return cached;
  }

  try {
    const stored = await AsyncStorage.getItem(storageKey(accountId));
    // A save may have landed while this read was in flight; that newer value
    // must win over the possibly-stale stored one.
    const newer = latestByAccount.get(accountId);
    if (newer) {
      return newer;
    }
    return stored ? normalizeCurrencyCode(stored) : null;
  } catch (error: unknown) {
    console.error('Unable to read the last manual currency:', error);
    // A save during the failed read is still authoritative.
    return latestByAccount.get(accountId) ?? null;
  }
}

// Remembers the currency of a just-created manual expense. Non-fatal by design:
// a storage failure is logged and never surfaced, so a successful save is never
// turned into a failure. The code is normalized before storing; an invalid code
// or unknown account is ignored.
export async function rememberLastManualCurrency(
  accountId: string | null | undefined,
  currency: string,
): Promise<void> {
  if (!accountId) {
    return;
  }

  const normalized = normalizeCurrencyCode(currency);
  if (!normalized) {
    return;
  }

  // Synchronous: an immediate reopen — including a new screen instance — sees
  // this before the asynchronous write resolves.
  latestByAccount.set(accountId, normalized);

  // Chain the write after any in-flight write for this account, and persist the
  // current newest value, so overlapping writes can never leave an older value
  // persisted after a newer one.
  const previous = writeChains.get(accountId) ?? Promise.resolve();
  const next = previous.then(async () => {
    const latest = latestByAccount.get(accountId);
    if (!latest) {
      return;
    }
    try {
      await AsyncStorage.setItem(storageKey(accountId), latest);
    } catch (error: unknown) {
      console.error('Unable to persist the last manual currency:', error);
    }
  });
  writeChains.set(accountId, next);
  await next;
}

// Test-only: clears the in-memory cache and pending write chains so each test
// starts from a clean account-scoped state.
export function __resetLastManualCurrencyCacheForTests(): void {
  latestByAccount.clear();
  writeChains.clear();
}
