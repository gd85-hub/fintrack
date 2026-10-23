import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

import {
  darkColor,
  lightColor,
  type ColorScheme,
} from '../lib/theme';

export type ThemePreference = 'system' | ColorScheme;

type ThemeContextValue = {
  colors: typeof lightColor | typeof darkColor;
  scheme: ColorScheme;
  setTheme: (theme: ThemePreference) => void;
  theme: ThemePreference;
};

const STORAGE_KEY = 'theme';
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemePreference>('system');
  const [loading, setLoading] = useState(true);
  const scheme: ColorScheme =
    theme === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : theme;
  const colors = scheme === 'dark' ? darkColor : lightColor;

  useEffect(() => {
    let active = true;

    void AsyncStorage.getItem(STORAGE_KEY)
      .then((storedTheme) => {
        if (active && isThemePreference(storedTheme)) {
          setThemeState(storedTheme);
        }
      })
      .catch((error: unknown) => {
        console.error('Unable to restore theme:', error);
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

  function setTheme(nextTheme: ThemePreference) {
    setThemeState(nextTheme);
    void AsyncStorage.setItem(STORAGE_KEY, nextTheme).catch(
      (error: unknown) => {
        console.error('Unable to persist theme:', error);
      },
    );
  }

  if (loading) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ colors, scheme, setTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('Theme hooks must be used within ThemeProvider.');
  }

  return context;
}

export function useColors(): ThemeContextValue['colors'] {
  return useThemeContext().colors;
}

export function useTheme(): Omit<ThemeContextValue, 'colors'> {
  const { scheme, setTheme, theme } = useThemeContext();
  return { scheme, setTheme, theme };
}
