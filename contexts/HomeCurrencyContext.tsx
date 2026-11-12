import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  deviceDefaultHomeCurrency,
  isSupportedHomeCurrency,
} from '../lib/homeCurrency';

type HomeCurrencyContextValue = {
  homeCurrency: string;
  loading: boolean;
  setHomeCurrency: (code: string) => void;
};

const STORAGE_KEY = 'home_currency';
const HomeCurrencyContext = createContext<
  HomeCurrencyContextValue | undefined
>(undefined);

export function HomeCurrencyProvider({ children }: PropsWithChildren) {
  const [homeCurrency, setHomeCurrencyState] = useState(
    deviceDefaultHomeCurrency,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void AsyncStorage.getItem(STORAGE_KEY)
      .then((storedCurrency) => {
        if (!active) {
          return;
        }

        setHomeCurrencyState(
          storedCurrency && isSupportedHomeCurrency(storedCurrency)
            ? storedCurrency
            : deviceDefaultHomeCurrency(),
        );
      })
      .catch((error: unknown) => {
        console.error('Unable to restore home currency:', error);
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

  function setHomeCurrency(code: string) {
    if (!isSupportedHomeCurrency(code)) {
      return;
    }

    setHomeCurrencyState(code);
    void AsyncStorage.setItem(STORAGE_KEY, code).catch(
      (error: unknown) => {
        console.error('Unable to persist home currency:', error);
      },
    );
  }

  return (
    <HomeCurrencyContext.Provider
      value={{ homeCurrency, loading, setHomeCurrency }}
    >
      {children}
    </HomeCurrencyContext.Provider>
  );
}

export function useHomeCurrency(): HomeCurrencyContextValue {
  const context = useContext(HomeCurrencyContext);

  if (!context) {
    throw new Error(
      'useHomeCurrency must be used within HomeCurrencyProvider.',
    );
  }

  return context;
}
