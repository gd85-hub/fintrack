import Feather from '@expo/vector-icons/Feather';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '../../contexts/ThemeContext';
import { theme, type Colors } from '../../lib/theme';

export type ToastTone = 'success' | 'error' | 'info';

export type ToastAction = {
  label: string;
  onPress: () => void;
};

export type ToastProps = {
  tone: ToastTone;
  message: string;
  action?: ToastAction;
  onDismiss: () => void;
};

const iconByTone = {
  success: 'check-circle',
  error: 'alert-triangle',
  info: 'info',
} as const;

export function Toast({ tone, message, action, onDismiss }: ToastProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);

  function handleActionPress() {
    try {
      action?.onPress();
    } finally {
      onDismiss();
    }
  }

  return (
    <View accessibilityRole="alert" style={styles.toast}>
      <Feather
        color={colors.icon.onInverse}
        name={iconByTone[tone]}
        size={theme.scale.size.iconMd}
      />
      <Text
        ellipsizeMode="tail"
        numberOfLines={2}
        style={styles.message}
      >
        {message}
      </Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={handleActionPress}
          style={({ pressed }) => [
            styles.action,
            pressed && styles.actionPressed,
          ]}
        >
          <Text style={styles.actionLabel}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    action: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: theme.scale.size.touchTarget,
    },
    actionLabel: {
      ...theme.type.bodyStrong,
      color: c.text.onInverse,
    },
    actionPressed: {
      opacity: theme.opacity.pressed,
    },
    message: {
      ...theme.type.bodyDefault,
      color: c.text.onInverse,
      flex: 1,
    },
    toast: {
      alignItems: 'center',
      alignSelf: 'stretch',
      backgroundColor: c.surface.inverse,
      borderRadius: theme.scale.radius.md,
      flexDirection: 'row',
      gap: theme.scale.space[3],
      minHeight: theme.scale.size.touchTarget,
      paddingHorizontal: theme.scale.space[4],
      paddingVertical: theme.scale.space[2],
    },
  });
