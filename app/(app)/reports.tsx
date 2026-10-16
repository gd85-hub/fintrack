import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '../../components/ScreenHeader';
import { theme } from '../../lib/theme';

export default function ReportsScreen() {
  return (
    <View style={styles.screen}>
      <ScreenHeader title="Reports" />
      <View style={styles.emptyState}>
        <Feather
          color={theme.color.icon.secondary}
          name="bar-chart-2"
          size={theme.spacing.xl}
        />
        <Text style={styles.title}>Reports coming soon</Text>
        <Text style={styles.description}>
          Spending reports and exports will live here.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  description: {
    color: theme.color.text.secondary,
    fontSize: theme.fontSizes.body,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.sm,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  screen: {
    backgroundColor: theme.color.bg.base,
    flex: 1,
  },
  title: {
    color: theme.color.text.primary,
    fontSize: theme.fontSizes.title,
    fontWeight: '700',
    textAlign: 'center',
  },
});
