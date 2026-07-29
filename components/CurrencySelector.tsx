import { Pressable, StyleSheet, Text, View } from 'react-native';

import { currencies, type Currency } from '../lib/money';
import { theme } from '../lib/theme';

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

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
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
    backgroundColor: theme.colors.background,
  },
  optionText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: theme.colors.text,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
});
