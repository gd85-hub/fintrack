import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  commonCurrencies,
  normalizeCurrencyCode,
} from '../lib/money';
import { theme } from '../lib/theme';

type ReceiptCurrencySelectorProps = {
  disabled?: boolean;
  onChange: (currency: string) => void;
  value: string;
};

function isCommonCurrency(value: string) {
  return commonCurrencies.some((currency) => currency === value);
}

export function ReceiptCurrencySelector({
  disabled = false,
  onChange,
  value,
}: ReceiptCurrencySelectorProps) {
  const [visible, setVisible] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const customCurrency = normalizeCurrencyCode(customInput);

  function open() {
    setCustomInput(isCommonCurrency(value) ? '' : value);
    setVisible(true);
  }

  function select(currency: string) {
    onChange(currency);
    setVisible(false);
  }

  return (
    <>
      <Pressable
        accessibilityLabel="Валюта чека"
        accessibilityRole="button"
        disabled={disabled}
        onPress={open}
        style={({ pressed }) => [
          styles.selector,
          disabled && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        transparent
        visible={visible}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <Text style={styles.title}>Валюта чека</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setVisible(false)}
              >
                <Text style={styles.close}>Закрыть</Text>
              </Pressable>
            </View>

            <View accessibilityRole="radiogroup" style={styles.list}>
              {commonCurrencies.map((currency) => {
                const selected = currency === value;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    key={currency}
                    onPress={() => select(currency)}
                    style={({ pressed }) => [
                      styles.row,
                      selected && styles.rowSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.rowText}>{currency}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.customSection}>
              <Text style={styles.label}>Другая</Text>
              <TextInput
                accessibilityLabel="Трёхбуквенный код валюты"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={3}
                onChangeText={(text) =>
                  setCustomInput(
                    text.replace(/[^A-Za-z]/gu, '').toUpperCase(),
                  )
                }
                placeholder="TMT"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                value={customInput}
              />
              <Pressable
                accessibilityRole="button"
                disabled={!customCurrency}
                onPress={() => {
                  if (customCurrency) {
                    select(customCurrency);
                  }
                }}
                style={({ pressed }) => [
                  styles.applyButton,
                  !customCurrency && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.applyButtonText}>Выбрать</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  applyButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.button,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
  },
  applyButtonText: {
    color: theme.colors.white,
    fontSize: theme.fontSizes.button,
    fontWeight: '700',
  },
  chevron: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.title,
  },
  close: {
    color: theme.colors.accent,
    fontSize: theme.fontSizes.body,
  },
  customSection: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  input: {
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.md,
    textTransform: 'uppercase',
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  modal: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.modal,
    maxWidth: theme.sizes.maxContentWidth,
    padding: theme.spacing.lg,
    width: theme.sizes.modalWidth,
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: theme.colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  row: {
    alignItems: 'center',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.chip,
    borderWidth: theme.sizes.border,
    justifyContent: 'center',
    minHeight: theme.sizes.iconButton,
    paddingHorizontal: theme.spacing.md,
  },
  rowSelected: {
    backgroundColor: theme.colors.accentMuted,
    borderColor: theme.colors.accent,
  },
  rowText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  selector: {
    alignItems: 'center',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    flexDirection: 'row',
    gap: theme.spacing.xs,
    minHeight: theme.sizes.iconButton,
    paddingHorizontal: theme.spacing.sm,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.title,
    fontWeight: '700',
  },
  value: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
});
