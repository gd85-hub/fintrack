import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useColors } from '../../contexts/ThemeContext';
import { theme, type Colors } from '../../lib/theme';

export type DividerProps = {
  variant?: 'full' | 'inset';
};

export function Divider({ variant = 'full' }: DividerProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);

  return (
    <View
      accessibilityElementsHidden={true}
      importantForAccessibility="no"
      style={[styles.divider, variant === 'inset' && styles.inset]}
    />
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    divider: {
      alignSelf: 'stretch',
      backgroundColor: c.border.subtle,
      height: theme.scale.stroke.hairline,
    },
    inset: {
      backgroundColor: c.separatorInset,
      marginLeft: theme.scale.space[4],
    },
  });
