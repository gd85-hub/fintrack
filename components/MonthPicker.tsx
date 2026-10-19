import Feather from '@expo/vector-icons/Feather';
import { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { formatMonthTitle, shiftMonth } from '../lib/dates';
import { theme } from '../lib/theme';

const MONTH_OPTION_COUNT = 24;

type MonthPickerProps = {
  visible: boolean;
  selectedMonth: string;
  currentMonth: string;
  onSelect: (month: string) => void;
  onClose: () => void;
};

export function MonthPicker({
  visible,
  selectedMonth,
  currentMonth,
  onSelect,
  onClose,
}: MonthPickerProps) {
  const months = useMemo(
    () =>
      Array.from({ length: MONTH_OPTION_COUNT }, (_, index) =>
        shiftMonth(currentMonth, -index),
      ),
    [currentMonth],
  );

  function handleSelect(month: string) {
    onSelect(month);
    onClose();
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Закрыть выбор месяца"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.monthList}>
            {months.map((month) => {
              const selected = month === selectedMonth;
              const label = formatMonthTitle(month);

              return (
                <Pressable
                  accessibilityLabel={`Выбрать ${label}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={month}
                  onPress={() => handleSelect(month)}
                  style={({ pressed }) => [
                    styles.monthRow,
                    selected && styles.selectedRow,
                    pressed && styles.pressedRow,
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.monthLabel,
                      selected && styles.selectedLabel,
                    ]}
                  >
                    {label}
                  </Text>
                  {selected ? (
                    <Feather
                      color={theme.color.icon.action}
                      name="check"
                      size={theme.scale.size.iconMd}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  monthLabel: {
    ...theme.type.bodyDefault,
    color: theme.color.text.secondary,
    flex: 1,
  },
  monthList: {
    paddingVertical: theme.scale.space[2],
  },
  monthRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.scale.space[3],
    minHeight: theme.scale.size.touchTarget,
    paddingHorizontal: theme.scale.space[4],
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: theme.color.overlay.scrim,
    flex: 1,
    justifyContent: 'flex-end',
    padding: theme.scale.space[4],
  },
  pressedRow: {
    backgroundColor: theme.color.state.pressed,
  },
  selectedLabel: {
    color: theme.color.text.primary,
  },
  selectedRow: {
    backgroundColor: theme.color.surface.selected,
  },
  sheet: {
    backgroundColor: theme.color.surface.raised,
    borderRadius: theme.scale.radius.sheet,
    maxHeight: theme.sizes.modalMaxHeight,
    maxWidth: theme.sizes.maxContentWidth,
    overflow: 'hidden',
    width: theme.sizes.modalWidth,
  },
});
