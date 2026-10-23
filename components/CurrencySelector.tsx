import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '../contexts/ThemeContext';
import { currencies, type Currency } from '../lib/money';
import { theme, type Colors } from '../lib/theme';

type CurrencySelectorProps = {
  value: Currency;
  onChange: (currency: Currency) => void;
  accessibilityLabel: string;
};

export function CurrencySelector({
  value,
  onChange,
  accessibilityLabel,
}: CurrencySelectorProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radiogroup"
      style={styles.container}
    >
      {currencies.map((currency) => {
        const selected = currency === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            key={currency}
            onPress={() => onChange(currency)}
            style={({ pressed }) => [
              styles.option,
              selected && styles.optionSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[styles.optionText, selected && styles.optionTextSelected]}
            >
              {currency}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: {
    backgroundColor: c.surface.default,
    borderRadius: theme.radii.button,
    flexDirection: 'row',
    padding: theme.spacing.xxs,
  },
  option: {
    alignItems: 'center',
    borderRadius: theme.radii.button,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.sizes.iconButton,
    paddingHorizontal: theme.spacing.sm,
  },
  optionSelected: {
    backgroundColor: c.bg.base,
  },
  optionText: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: c.text.primary,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
});
