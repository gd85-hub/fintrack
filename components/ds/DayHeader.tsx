import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '../../contexts/ThemeContext';
import { theme, type Colors } from '../../lib/theme';

// Fixed minimum height from the Day Header DS master; no scale token exists.
const DAY_HEADER_MIN_HEIGHT = 34;

export type DayHeaderProps = {
  date: string;
  total?: string;
  showTotal?: boolean;
};

export function DayHeader({
  date,
  total,
  showTotal = true,
}: DayHeaderProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const trimmedDate = date.trim();
  const trimmedTotal = total?.trim() ?? '';
  const visibleTotal = showTotal && trimmedTotal ? total : undefined;
  const accessibilityLabel = visibleTotal
    ? [trimmedDate, trimmedTotal].filter(Boolean).join(', ')
    : trimmedDate;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="header"
      style={styles.header}
    >
      <Text
        ellipsizeMode="tail"
        numberOfLines={1}
        style={styles.date}
      >
        {date}
      </Text>
      {visibleTotal ? (
        <Text numberOfLines={1} style={styles.total}>
          {visibleTotal}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    date: {
      ...theme.type.microLabel,
      color: c.text.tertiary,
      flex: 1,
      textTransform: 'uppercase',
    },
    header: {
      alignItems: 'center',
      alignSelf: 'stretch',
      backgroundColor: c.surface.default,
      flexDirection: 'row',
      gap: theme.scale.space[3],
      minHeight: DAY_HEADER_MIN_HEIGHT,
      paddingHorizontal: theme.scale.space[4],
      paddingVertical: theme.scale.space[2],
    },
    total: {
      ...theme.type.amountSecondary,
      color: c.text.secondary,
      flexShrink: 0,
      fontVariant: [...theme.type.amountSecondary.fontVariant],
      textAlign: 'right',
    },
  });
