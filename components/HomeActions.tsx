import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../lib/theme';

type HomeActionsProps = {
  onScan?: () => void;
  onManual: () => void;
  onReport: () => void;
};

export function HomeActions({
  onScan,
  onManual,
  onReport,
}: HomeActionsProps) {
  return (
    <View style={styles.actions}>
      {onScan ? (
        <Pressable
          accessibilityLabel="Сканировать"
          accessibilityRole="button"
          onPress={onScan}
          style={({ pressed }) => [
            styles.tile,
            styles.scanTile,
            pressed && styles.pressed,
          ]}
        >
          <MaterialCommunityIcons
            color={theme.color.icon.action}
            name="qrcode-scan"
            size={theme.scale.size.iconMd}
          />
          <Text style={[styles.label, styles.scanLabel]}>
            Сканировать
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityLabel="Добавить вручную"
        accessibilityRole="button"
        onPress={onManual}
        style={({ pressed }) => [
          styles.tile,
          pressed && styles.pressed,
        ]}
      >
        <Feather
          color={theme.color.icon.secondary}
          name="plus"
          size={theme.scale.size.iconMd}
        />
        <Text style={styles.label}>Вручную</Text>
      </Pressable>

      <Pressable
        accessibilityLabel="Открыть отчёт"
        accessibilityRole="button"
        onPress={onReport}
        style={({ pressed }) => [
          styles.tile,
          pressed && styles.pressed,
        ]}
      >
        <Feather
          color={theme.color.icon.secondary}
          name="pie-chart"
          size={theme.scale.size.iconMd}
        />
        <Text style={styles.label}>Отчёт</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: theme.scale.space[2],
    paddingHorizontal: theme.scale.space[4],
    paddingTop: theme.scale.space[5],
  },
  label: {
    ...theme.type.captionDefault,
    color: theme.color.text.secondary,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  scanLabel: {
    color: theme.color.action.link.rest,
  },
  scanTile: {
    backgroundColor: theme.color.action.container,
  },
  tile: {
    backgroundColor: theme.color.surface.raised,
    borderColor: theme.color.surface.border,
    borderRadius: theme.scale.radius.md,
    borderWidth: theme.scale.stroke.hairline,
    flex: 1,
    flexDirection: 'column',
    gap: theme.scale.space[2],
    minHeight: theme.scale.size.touchTarget,
    padding: theme.scale.space[3],
  },
});
