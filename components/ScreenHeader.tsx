import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../lib/theme';

type ScreenHeaderProps = {
  backAccessibilityLabel?: string;
  onBack?: () => void;
  rightAction?: ReactNode;
  title: string;
};

export function ScreenHeader({
  backAccessibilityLabel = 'Back',
  onBack,
  rightAction,
  title,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <View style={styles.sideSlot}>
          {onBack ? (
            <Pressable
              accessibilityLabel={backAccessibilityLabel}
              accessibilityRole="button"
              onPress={onBack}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
            >
              <Feather
                color={theme.color.icon.primary}
                name="chevron-left"
                size={theme.spacing.lg}
              />
            </Pressable>
          ) : null}
        </View>

        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>

        <View style={[styles.sideSlot, styles.rightSlot]}>
          {rightAction}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    borderRadius: theme.radii.round,
    height: theme.sizes.buttonHeight,
    justifyContent: 'center',
    width: theme.sizes.buttonHeight,
  },
  header: {
    backgroundColor: theme.color.surface.default,
    borderBottomColor: theme.color.border.subtle,
    borderBottomWidth: theme.sizes.border,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: theme.sizes.floatingButton,
    paddingHorizontal: theme.spacing.md,
  },
  pressed: {
    backgroundColor: theme.color.state.pressed,
  },
  rightSlot: {
    alignItems: 'flex-end',
  },
  sideSlot: {
    minWidth: theme.sizes.buttonHeight,
  },
  title: {
    color: theme.color.text.primary,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
    textAlign: 'center',
  },
});
