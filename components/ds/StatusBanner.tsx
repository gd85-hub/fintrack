import Feather from '@expo/vector-icons/Feather';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '../../contexts/ThemeContext';
import { theme, type Colors } from '../../lib/theme';

export type StatusBannerTone = 'error' | 'warning' | 'success' | 'info';

export type StatusBannerAction = {
  label: string;
  onPress: () => void;
};

export type StatusBannerProps = {
  tone: StatusBannerTone;
  message: string;
  action?: StatusBannerAction;
};

const iconByTone = {
  error: 'alert-triangle',
  warning: 'alert-circle',
  success: 'check-circle',
  info: 'info',
} as const;

type StatusColors = Colors['status'][StatusBannerTone];

export function StatusBanner({
  tone,
  message,
  action,
}: StatusBannerProps) {
  const colors = useColors();
  const toneColors = (colors as Colors).status[tone];
  const styles = useMemo(() => makeStyles(toneColors), [toneColors]);

  return (
    <View
      accessibilityLiveRegion="assertive"
      accessibilityRole="alert"
      style={styles.banner}
    >
      <Feather
        color={toneColors.icon}
        name={iconByTone[tone]}
        size={theme.scale.size.iconMd}
      />
      <Text
        ellipsizeMode="tail"
        numberOfLines={3}
        style={styles.message}
      >
        {message}
      </Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
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

const makeStyles = (c: StatusColors) =>
  StyleSheet.create({
    action: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: theme.scale.size.touchTarget,
    },
    actionLabel: {
      ...theme.type.labelDefault,
      color: c.content,
    },
    actionPressed: {
      opacity: theme.opacity.pressed,
    },
    banner: {
      alignItems: 'center',
      backgroundColor: c.container,
      borderColor: c.border,
      borderRadius: theme.scale.radius.md,
      borderWidth: theme.scale.stroke.hairline,
      flexDirection: 'row',
      gap: theme.scale.space[3],
      minHeight: theme.scale.size.touchTarget,
      paddingHorizontal: theme.scale.space[3],
      paddingVertical: theme.scale.space[2],
    },
    message: {
      ...theme.type.labelDefault,
      color: c.content,
      flex: 1,
    },
  });
