import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { theme } from '../lib/theme';

type LoadingScreenProps = {
  compact?: boolean;
};

export function LoadingScreen({ compact = false }: LoadingScreenProps) {
  return (
    <View style={compact ? styles.compact : styles.container}>
      <ActivityIndicator color={theme.colors.accent} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  compact: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
  },
  container: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    flex: 1,
    justifyContent: 'center',
  },
});
