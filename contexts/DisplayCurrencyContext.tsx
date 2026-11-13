import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';

import { ANCHOR_DISPLAY } from '../lib/features';
import {
  deviceDefaultHomeCurrency,
  isSupportedHomeCurrency,
} from '../lib/homeCurrency';
import { isCurrency } from '../lib/money';

type DisplayCurrencyContextValue = {
  currency: string;
  loading: boolean;
  setCurrency: (currency: string) => void;
};

const STORAGE_KEY = 'display_currency';
const HOME_CURRENCY_STORAGE_KEY = 'home_currency';
const DisplayCurrencyContext = createContext<
  DisplayCurrencyContextValue | undefined
>(undefined);

function isAllowedDisplayCurrency(value: string | null): value is string {
  return (
    value !== null &&
    (ANCHOR_DISPLAY
      ? isSupportedHomeCurrency(value)
      : isCurrency(value))
  );
}

export function DisplayCurrencyProvider({ children }: PropsWithChildren) {
  const [currency, setCurrencyState] = useState(() =>
    ANCHOR_DISPLAY ? deviceDefaultHomeCurrency() : 'RSD',
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(HOME_CURRENCY_STORAGE_KEY),
    ])
      .then(([storedCurrency, storedHomeCurrency]) => {
        if (!active) {
          return;
        }

        if (isAllowedDisplayCurrency(storedCurrency)) {
          setCurrencyState(storedCurrency);
          return;
        }

        if (ANCHOR_DISPLAY) {
          setCurrencyState(
            storedHomeCurrency && isSupportedHomeCurrency(storedHomeCurrency)
              ? storedHomeCurrency
              : deviceDefaultHomeCurrency(),
          );
        }
      })
      .catch((error: unknown) => {
        console.error('Unable to restore display currency:', error);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  function setCurrency(nextCurrency: string) {
    if (!isAllowedDisplayCurrency(nextCurrency)) {
      return;
    }

    setCurrencyState(nextCurrency);
    void AsyncStorage.setItem(STORAGE_KEY, nextCurrency).catch(
      (error: unknown) => {
        console.error('Unable to persist display currency:', error);
      },
    );
  }

  return (
    <DisplayCurrencyContext.Provider
      value={{ currency, loading, setCurrency }}
    >
      {children}
    </DisplayCurrencyContext.Provider>
  );
}

export function useDisplayCurrency(): DisplayCurrencyContextValue {
  const context = useContext(DisplayCurrencyContext);

  if (!context) {
    throw new Error(
      'useDisplayCurrency must be used within DisplayCurrencyProvider.',
    );
  }

  return context;
}
