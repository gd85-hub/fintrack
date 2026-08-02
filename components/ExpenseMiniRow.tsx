import { StyleSheet, Text, View } from 'react-native';

import { formatDayHeader } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { theme } from '../lib/theme';

type ExpenseMiniRowProps = {
  amountCents: number;
  categoryLabel?: string;
  currency: string;
  date: string;
  description: string;
  merchantName: string | null;
};

export function ExpenseMiniRow({
  amountCents,
  categoryLabel,
  currency,
  date,
  description,
  merchantName,
}: ExpenseMiniRowProps) {
  const dayAndMonth = formatDayHeader(date).split(',')[0];

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.date}>{dayAndMonth}</Text>
        <Text numberOfLines={2} style={styles.description}>
          {description}
        </Text>
        {merchantName ? (
          <Text numberOfLines={1} style={styles.merchant}>
            {merchantName}
          </Text>
        ) : null}
        {categoryLabel ? (
          <Text numberOfLines={1} style={styles.category}>
            {categoryLabel}
          </Text>
        ) : null}
      </View>
      <Text style={styles.amount}>
        {formatMoney(amountCents)} {currency}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  amount: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
    textAlign: 'right',
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  date: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.small,
  },
  description: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.label,
  },
  merchant: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.small,
  },
  category: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.small,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    minHeight: theme.sizes.floatingButton,
    paddingVertical: theme.spacing.xs,
  },
});
