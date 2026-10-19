import { StyleSheet, View } from 'react-native';

import { theme } from '../../lib/theme';

export type DividerProps = {
  variant?: 'full' | 'inset';
};

export function Divider({ variant = 'full' }: DividerProps) {
  return (
    <View
      accessibilityElementsHidden={true}
      importantForAccessibility="no"
      style={[styles.divider, variant === 'inset' && styles.inset]}
    />
  );
}

const styles = StyleSheet.create({
  divider: {
    alignSelf: 'stretch',
    backgroundColor: theme.color.border.subtle,
    height: theme.scale.stroke.hairline,
  },
  inset: {
    backgroundColor: theme.color.separatorInset,
    marginLeft: theme.scale.space[4],
  },
});
