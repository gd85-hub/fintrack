import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '../../contexts/ThemeContext';
import { theme, type Colors } from '../../lib/theme';

export type PanelProps = {
  title: string;
  amount: string;
  currencyCode?: string;
  equivalent1?: string;
  equivalent2?: string;
  showSecondCurrency?: boolean;
};

export function Panel({
  title,
  amount,
  currencyCode,
  equivalent1,
  equivalent2,
  showSecondCurrency = true,
}: PanelProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const visibleCurrencyCode = currencyCode?.trim() ?? '';
  const visibleEquivalent1 = equivalent1?.trim() ?? '';
  const visibleEquivalent2 =
    visibleEquivalent1 && showSecondCurrency
      ? equivalent2?.trim() ?? ''
      : '';
  const amountWithCurrency = [amount.trim(), visibleCurrencyCode]
    .filter(Boolean)
    .join(' ');
  const accessibilityLabel = [
    title.trim(),
    amountWithCurrency,
    visibleEquivalent1,
    visibleEquivalent2,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessible={true}
      style={styles.panel}
    >
      <Text style={styles.title}>{title}</Text>
      <Text numberOfLines={1} style={styles.amount}>
        {amount}
        {visibleCurrencyCode ? (
          <Text style={styles.currencyCode}> {visibleCurrencyCode}</Text>
        ) : null}
      </Text>
      {visibleEquivalent1 ? (
        <View style={styles.equivalents}>
          <Text numberOfLines={1} style={styles.equivalent}>
            {visibleEquivalent1}
          </Text>
          {visibleEquivalent2 ? (
            <>
              <Text style={styles.separator}>·</Text>
              <Text numberOfLines={1} style={styles.equivalent}>
                {visibleEquivalent2}
              </Text>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    amount: {
      ...theme.type.displayHeroSmall,
      color: c.text.primary,
    },
    currencyCode: {
      color: c.text.tertiary,
    },
    equivalent: {
      ...theme.type.amountSecondary,
      color: c.text.secondary,
      fontVariant: [...theme.type.amountSecondary.fontVariant],
    },
    equivalents: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.scale.space[2],
    },
    panel: {
      alignSelf: 'stretch',
      backgroundColor: c.surface.raised,
      borderRadius: theme.scale.radius.lg,
      gap: theme.scale.space[1],
      padding: theme.scale.space[4],
    },
    separator: {
      ...theme.type.amountSecondary,
      color: c.text.tertiary,
      fontVariant: [...theme.type.amountSecondary.fontVariant],
    },
    title: {
      ...theme.type.captionDefault,
      color: c.text.secondary,
    },
  });
