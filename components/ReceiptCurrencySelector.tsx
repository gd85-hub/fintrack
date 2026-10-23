import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useLanguage } from '../contexts/LanguageContext';
import { useColors } from '../contexts/ThemeContext';
import {
  commonCurrencies,
  normalizeCurrencyCode,
} from '../lib/money';
import { theme, type Colors } from '../lib/theme';

type ReceiptCurrencySelectorProps = {
  disabled?: boolean;
  label?: string;
  onChange: (currency: string) => void;
  value: string;
};

function isCommonCurrency(value: string) {
  return commonCurrencies.some((currency) => currency === value);
}

export function ReceiptCurrencySelector({
  disabled = false,
  label,
  onChange,
  value,
}: ReceiptCurrencySelectorProps) {
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const resolvedLabel = label ?? t('currency.receiptLabel');
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
        accessibilityLabel={resolvedLabel}
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
              <Text style={styles.title}>{resolvedLabel}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setVisible(false)}
              >
                <Text style={styles.close}>{t('common.close')}</Text>
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
              <Text style={styles.label}>{t('currency.other')}</Text>
              <TextInput
                accessibilityLabel={t('currency.codeA11y')}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={3}
                onChangeText={(text) =>
                  setCustomInput(
                    text.replace(/[^A-Za-z]/gu, '').toUpperCase(),
                  )
                }
                placeholder="TMT"
                placeholderTextColor={colors.text.secondary}
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
                <Text style={styles.applyButtonText}>{t('common.select')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  applyButton: {
    alignItems: 'center',
    backgroundColor: c.action.primary.fill,
    borderRadius: theme.radii.button,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
  },
  applyButtonText: {
    color: c.action.primary.content,
    fontSize: theme.fontSizes.button,
    fontWeight: '700',
  },
  chevron: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.title,
  },
  close: {
    color: c.action.link.rest,
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
    borderColor: c.field.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.md,
    textTransform: 'uppercase',
  },
  label: {
    color: c.text.primary,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  modal: {
    backgroundColor: c.surface.overlay,
    borderRadius: theme.radii.modal,
    maxWidth: theme.sizes.maxContentWidth,
    padding: theme.spacing.lg,
    width: theme.sizes.modalWidth,
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: c.overlay.scrim,
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  row: {
    alignItems: 'center',
    borderColor: c.border.default,
    borderRadius: theme.radii.chip,
    borderWidth: theme.sizes.border,
    justifyContent: 'center',
    minHeight: theme.sizes.iconButton,
    paddingHorizontal: theme.spacing.md,
  },
  rowSelected: {
    backgroundColor: c.action.container,
    borderColor: c.icon.action,
  },
  rowText: {
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  selector: {
    alignItems: 'center',
    borderColor: c.field.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    flexDirection: 'row',
    gap: theme.spacing.xs,
    minHeight: theme.sizes.iconButton,
    paddingHorizontal: theme.spacing.sm,
  },
  title: {
    color: c.text.primary,
    fontSize: theme.fontSizes.title,
    fontWeight: '700',
  },
  value: {
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
});
