import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';

import { currencies, type Currency } from '../lib/money';

type DisplayCurrencyContextValue = {
  currency: Currency;
  loading: boolean;
  setCurrency: (currency: Currency) => void;
};

const STORAGE_KEY = 'display_currency';
const DisplayCurrencyContext = createContext<
  DisplayCurrencyContextValue | undefined
>(undefined);

function isCurrency(value: string | null): value is Currency {
  return currencies.some((currency) => currency === value);
}

export function DisplayCurrencyProvider({ children }: PropsWithChildren) {
  const [currency, setCurrencyState] = useState<Currency>('RSD');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void AsyncStorage.getItem(STORAGE_KEY)
      .then((storedCurrency) => {
        if (active && isCurrency(storedCurrency)) {
          setCurrencyState(storedCurrency);
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

  function setCurrency(nextCurrency: Currency) {
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
