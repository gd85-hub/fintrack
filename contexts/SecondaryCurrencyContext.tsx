import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';

import { isSupportedHomeCurrency } from '../lib/homeCurrency';

type SecondaryCurrencyContextValue = {
  loading: boolean;
  secondaryCurrency: string | null;
  setSecondaryCurrency: (code: string | null) => void;
};

const STORAGE_KEY = 'secondary_currency';
const OFF_SENTINEL = 'OFF';
const SecondaryCurrencyContext = createContext<
  SecondaryCurrencyContextValue | undefined
>(undefined);

export function SecondaryCurrencyProvider({ children }: PropsWithChildren) {
  const [secondaryCurrency, setSecondaryCurrencyState] = useState<
    string | null
  >('EUR');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void AsyncStorage.getItem(STORAGE_KEY)
      .then((storedCurrency) => {
        if (!active) {
          return;
        }

        if (storedCurrency === OFF_SENTINEL || storedCurrency === '') {
          setSecondaryCurrencyState(null);
          return;
        }

        setSecondaryCurrencyState(
          storedCurrency && isSupportedHomeCurrency(storedCurrency)
            ? storedCurrency
            : 'EUR',
        );
      })
      .catch((error: unknown) => {
        console.error('Unable to restore secondary currency:', error);
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

  function setSecondaryCurrency(code: string | null) {
    if (code !== null && !isSupportedHomeCurrency(code)) {
      return;
    }

    setSecondaryCurrencyState(code);
    void AsyncStorage.setItem(
      STORAGE_KEY,
      code ?? OFF_SENTINEL,
    ).catch((error: unknown) => {
      console.error('Unable to persist secondary currency:', error);
    });
  }

  return (
    <SecondaryCurrencyContext.Provider
      value={{ loading, secondaryCurrency, setSecondaryCurrency }}
    >
      {children}
    </SecondaryCurrencyContext.Provider>
  );
}

export function useSecondaryCurrency(): SecondaryCurrencyContextValue {
  const context = useContext(SecondaryCurrencyContext);

  if (!context) {
    throw new Error(
      'useSecondaryCurrency must be used within SecondaryCurrencyProvider.',
    );
  }

  return context;
}
