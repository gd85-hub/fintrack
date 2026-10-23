import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useColors } from '../contexts/ThemeContext';
import { theme, type Colors } from '../lib/theme';

type LoadingScreenProps = {
  compact?: boolean;
};

export function LoadingScreen({ compact = false }: LoadingScreenProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);

  return (
    <View style={compact ? styles.compact : styles.container}>
      <ActivityIndicator color={colors.icon.action} size="large" />
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    compact: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.xl,
    },
    container: {
      alignItems: 'center',
      backgroundColor: c.bg.base,
      flex: 1,
      justifyContent: 'center',
    },
  });
