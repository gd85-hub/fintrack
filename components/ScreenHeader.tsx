import Feather from '@expo/vector-icons/Feather';
import { type ReactNode, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '../contexts/ThemeContext';
import { theme, type Colors } from '../lib/theme';

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
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);

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
                color={colors.icon.primary}
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

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    backButton: {
      alignItems: 'center',
      borderRadius: theme.radii.round,
      height: theme.sizes.buttonHeight,
      justifyContent: 'center',
      width: theme.sizes.buttonHeight,
    },
    header: {
      backgroundColor: c.surface.default,
      borderBottomColor: c.border.subtle,
      borderBottomWidth: theme.sizes.border,
    },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      minHeight: theme.sizes.floatingButton,
      paddingHorizontal: theme.spacing.md,
    },
    pressed: {
      backgroundColor: c.state.pressed,
    },
    rightSlot: {
      alignItems: 'flex-end',
    },
    sideSlot: {
      minWidth: theme.sizes.buttonHeight,
    },
    title: {
      color: c.text.primary,
      flex: 1,
      fontSize: theme.fontSizes.body,
      fontWeight: '700',
      textAlign: 'center',
    },
  });
