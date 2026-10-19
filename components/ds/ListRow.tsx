import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../../lib/theme';

// Fixed glyph size from the List Row DS master; no scale token exists.
const ICON_GLYPH = 18;
// Fixed selected-marker width from the List Row DS master.
const MARKER_WIDTH = 3;

export type ListRowProps = {
  place: string;
  category?: string;
  amount: string;
  equivalent?: string;
  kind?: 'default' | 'exception';
  icon?: ReactNode;
  iconEmoji?: string;
  showChevron?: boolean;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
};

export function ListRow({
  place,
  category,
  amount,
  equivalent,
  kind = 'default',
  icon,
  iconEmoji,
  showChevron = true,
  selected = false,
  onPress,
  onLongPress,
}: ListRowProps) {
  const [hovered, setHovered] = useState(false);
  const isException = kind === 'exception';
  const visibleIconEmoji = iconEmoji?.trim() ?? '';
  const accessibilityParts = [place.trim(), amount.trim()];

  if (isException) {
    accessibilityParts.push('возврат или пополнение');
  }

  const accessibilityLabel = accessibilityParts
    .filter((part) => part.length > 0)
    .join(', ');

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        hovered && styles.hovered,
        pressed && styles.pressed,
        selected && styles.selected,
      ]}
    >
      {selected ? <View style={styles.selectedMarker} /> : null}

      <View style={styles.iconCircle}>
        {isException ? (
          <Feather
            color={theme.color.icon.secondary}
            name="repeat"
            size={ICON_GLYPH}
          />
        ) : visibleIconEmoji ? (
          <Text style={styles.iconEmoji}>{visibleIconEmoji}</Text>
        ) : (
          icon
        )}
      </View>

      <View style={styles.textBlock}>
        <Text ellipsizeMode="tail" numberOfLines={1} style={styles.place}>
          {place}
        </Text>
        {category ? (
          <Text
            ellipsizeMode="tail"
            numberOfLines={1}
            style={styles.category}
          >
            {category}
          </Text>
        ) : null}
      </View>

      <View style={styles.amountBlock}>
        <Text
          numberOfLines={1}
          style={isException ? styles.exceptionAmount : styles.amount}
        >
          {amount}
        </Text>
        {equivalent ? (
          <Text numberOfLines={1} style={styles.equivalent}>
            {equivalent}
          </Text>
        ) : null}
      </View>

      {showChevron ? (
        <Feather
          color={theme.color.icon.secondary}
          name="chevron-right"
          size={theme.scale.size.iconSm}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  amount: {
    ...theme.type.amountRow,
    color: theme.color.text.primary,
    fontVariant: [...theme.type.amountRow.fontVariant],
    textAlign: 'right',
  },
  amountBlock: {
    alignItems: 'flex-end',
    gap: theme.scale.stroke.hairline,
  },
  category: {
    ...theme.type.captionDefault,
    color: theme.color.text.secondary,
  },
  equivalent: {
    ...theme.type.amountSecondary,
    color: theme.color.text.secondary,
    fontVariant: [...theme.type.amountSecondary.fontVariant],
    textAlign: 'right',
  },
  exceptionAmount: {
    ...theme.type.amountRowException,
    color: theme.color.finance.inflow.content,
    fontVariant: [...theme.type.amountRowException.fontVariant],
    textAlign: 'right',
  },
  hovered: {
    backgroundColor: theme.color.state.hover,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: theme.color.surface.muted,
    borderRadius: theme.scale.radius.pill,
    height: theme.scale.size.iconCircle,
    justifyContent: 'center',
    width: theme.scale.size.iconCircle,
  },
  iconEmoji: {
    fontSize: ICON_GLYPH,
    textAlign: 'center',
  },
  place: {
    ...theme.type.bodyStrong,
    color: theme.color.text.primary,
  },
  pressed: {
    backgroundColor: theme.color.state.pressed,
  },
  row: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: theme.scale.space[3],
    height: theme.scale.size.rowHeight,
    paddingHorizontal: theme.scale.space[3],
    position: 'relative',
  },
  selected: {
    backgroundColor: theme.color.surface.selected,
  },
  selectedMarker: {
    backgroundColor: theme.color.action.primary.fill,
    borderRadius: theme.scale.radius.pill,
    height: theme.scale.size.touchTarget,
    left: 0,
    position: 'absolute',
    top:
      (theme.scale.size.rowHeight - theme.scale.size.touchTarget) / 2,
    width: MARKER_WIDTH,
  },
  textBlock: {
    flex: 1,
    gap: theme.scale.stroke.hairline,
  },
});
