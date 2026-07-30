import {
  type ColorValue,
  StyleSheet,
  View,
} from 'react-native';

import { theme } from '../lib/theme';

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

const styles = StyleSheet.create({
  bar: {
    backgroundColor: theme.colors.surface,
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
