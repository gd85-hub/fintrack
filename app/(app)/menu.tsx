import { type Href, useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { theme } from '../../lib/theme';

type MenuItem = {
  disabled?: boolean;
  icon?: string;
  label: string;
  route?: Href;
};

const menuItems = [
  {
    icon: '📊',
    label: 'Аналитика',
    route: '/(app)/analytics',
  },
  {
    icon: '📍',
    label: 'Управление местами',
    route: '/(app)/merchants',
  },
  {
    disabled: true,
    icon: '🏷️',
    label: 'Управление категориями',
  },
  {
    disabled: true,
    icon: '💱',
    label: 'Управление валютами',
  },
] satisfies readonly MenuItem[];

export default function MenuScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Меню</Text>
        <Pressable
          accessibilityLabel="Закрыть меню"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.closeText}>Закрыть</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.list}>
          {menuItems.map((item) => {
            const disabled = item.disabled || !item.route;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                disabled={disabled}
                key={item.label}
                onPress={() => {
                  if (item.route) {
                    router.push(item.route);
                  }
                }}
                style={({ pressed }) => [
                  styles.row,
                  disabled && styles.rowDisabled,
                  pressed && styles.pressed,
                ]}
              >
                {item.icon ? (
                  <Text style={styles.icon}>{item.icon}</Text>
                ) : null}
                <Text
                  style={[
                    styles.label,
                    disabled && styles.labelDisabled,
                  ]}
                >
                  {item.label}
                </Text>
                {disabled ? (
                  <View style={styles.soonTag}>
                    <Text style={styles.soonText}>Скоро</Text>
                  </View>
                ) : (
                  <Text style={styles.chevron}>›</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  chevron: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.title,
  },
  closeButton: {
    justifyContent: 'center',
    minHeight: theme.sizes.iconButton,
    paddingHorizontal: theme.spacing.xs,
  },
  closeText: {
    color: theme.colors.accent,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  content: {
    alignSelf: 'center',
    maxWidth: theme.sizes.maxContentWidth,
    padding: theme.spacing.lg,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    borderBottomColor: theme.colors.border,
    borderBottomWidth: theme.sizes.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: theme.sizes.floatingButton,
    paddingHorizontal: theme.spacing.lg,
  },
  icon: {
    fontSize: theme.fontSizes.body,
  },
  label: {
    color: theme.colors.text,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  labelDisabled: {
    color: theme.colors.textMuted,
  },
  list: {
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    borderWidth: theme.sizes.border,
    overflow: 'hidden',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: theme.colors.border,
    borderBottomWidth: theme.sizes.border,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    minHeight: theme.sizes.floatingButton,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  rowDisabled: {
    backgroundColor: theme.colors.surface,
  },
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  soonTag: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.chip,
    borderWidth: theme.sizes.border,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
  },
  soonText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.small,
    fontWeight: '600',
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
});
