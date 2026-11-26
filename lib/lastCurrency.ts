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

// Returns the remembered manual-expense currency for this account, or null when
// none is stored, the account is unknown, the stored value is not a valid ISO
// code, or storage cannot be read. The value passes through
// normalizeCurrencyCode, so custom (any valid ISO) currencies are preserved and
// a corrupt value falls back to null rather than being used.
export async function readLastManualCurrency(
  accountId: string | null | undefined,
): Promise<string | null> {
  if (!accountId) {
    return null;
  }

  try {
    const stored = await AsyncStorage.getItem(storageKey(accountId));
    return stored ? normalizeCurrencyCode(stored) : null;
  } catch (error: unknown) {
    console.error('Unable to read the last manual currency:', error);
    return null;
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

  try {
    await AsyncStorage.setItem(storageKey(accountId), normalized);
  } catch (error: unknown) {
    console.error('Unable to persist the last manual currency:', error);
  }
}
