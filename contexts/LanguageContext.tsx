import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  i18n,
  setI18nLocale,
  type ActiveLocale,
  type Translate,
} from '../lib/i18n';

export type Language = 'system' | ActiveLocale;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translate;
};

const STORAGE_KEY = 'language';
const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined,
);

function isLanguage(value: string | null): value is Language {
  return value === 'system' || value === 'ru' || value === 'en';
}

function resolveActiveLocale(language: Language): ActiveLocale {
  if (language !== 'system') {
    return language;
  }

  const deviceLanguage = getLocales()[0]?.languageCode?.toLowerCase();
  return deviceLanguage === 'en' ? 'en' : 'ru';
}

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<Language>('system');
  const [loading, setLoading] = useState(true);
  const activeLocale = resolveActiveLocale(language);

  useEffect(() => {
    let active = true;

    void AsyncStorage.getItem(STORAGE_KEY)
      .then((storedLanguage) => {
        if (active && isLanguage(storedLanguage)) {
          setLanguageState(storedLanguage);
        }
      })
      .catch((error: unknown) => {
        console.error('Unable to restore language:', error);
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

  useEffect(() => {
    setI18nLocale(activeLocale);
  }, [activeLocale]);

  const t = useCallback<Translate>(
    (key, options) =>
      i18n.t(
        key,
        options
          ? { ...options, locale: activeLocale }
          : { locale: activeLocale },
      ),
    [activeLocale],
  );

  function setLanguage(nextLanguage: Language) {
    setLanguageState(nextLanguage);
    setI18nLocale(resolveActiveLocale(nextLanguage));
    void AsyncStorage.setItem(STORAGE_KEY, nextLanguage).catch(
      (error: unknown) => {
        console.error('Unable to persist language:', error);
      },
    );
  }

  if (loading) {
    return null;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider.');
  }

  return context;
}
