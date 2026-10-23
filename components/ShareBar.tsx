import { useMemo } from 'react';
import {
  type ColorValue,
  StyleSheet,
  View,
} from 'react-native';

import { useColors } from '../contexts/ThemeContext';
import { theme, type Colors } from '../lib/theme';

export type ShareBarSegment = {
  id: string;
  amount: number;
  color: ColorValue;
};

type ShareBarProps = {
  accessibilityLabel: string;
  segments: ShareBarSegment[];
};

export function ShareBar({
  accessibilityLabel,
  segments,
}: ShareBarProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      style={styles.bar}
    >
      {segments.map((segment) => (
        <View
          key={segment.id}
          style={[
            styles.segment,
            {
              backgroundColor: segment.color,
              flexGrow: segment.amount,
            },
          ]}
        />
      ))}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    bar: {
      backgroundColor: c.surface.default,
      borderRadius: theme.radii.round,
      flexDirection: 'row',
      height: theme.spacing.md,
      overflow: 'hidden',
      width: '100%',
    },
    segment: {
      flexBasis: 0,
    },
  });
