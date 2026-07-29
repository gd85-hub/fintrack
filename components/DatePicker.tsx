import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  formatMonthTitle,
  monthBounds,
  parseLocalISO,
  shiftMonth,
  todayLocalISO,
  yesterdayLocalISO,
} from '../lib/dates';
import { theme } from '../lib/theme';

type DatePickerProps = {
  visible: boolean;
  value: string;
  onChange: (dateISO: string) => void;
  onClose: () => void;
};

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

function buildCalendar(month: string): Array<number | null> {
  const { first, last } = monthBounds(month);
  const firstParts = parseLocalISO(first);
  const lastParts = parseLocalISO(last);

  if (!firstParts || !lastParts) {
    return [];
  }

  const firstWeekday = new Date(
    firstParts.year,
    firstParts.month - 1,
    firstParts.day,
  ).getDay();
  const mondayOffset = (firstWeekday + 6) % 7;
  return [
    ...Array.from({ length: mondayOffset }, () => null),
    ...Array.from({ length: lastParts.day }, (_, index) => index + 1),
  ];
}

function dateForDay(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, '0')}`;
}

export function DatePicker({
  visible,
  value,
  onChange,
  onClose,
}: DatePickerProps) {
  const [visibleMonth, setVisibleMonth] = useState(value.slice(0, 7));
  const today = todayLocalISO();
  const days = useMemo(() => buildCalendar(visibleMonth), [visibleMonth]);

  useEffect(() => {
    if (visible) {
      setVisibleMonth(value.slice(0, 7));
    }
  }, [value, visible]);

  function selectDate(dateISO: string) {
    onChange(dateISO);
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
        <View style={styles.modal}>
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Предыдущий месяц"
              accessibilityRole="button"
              onPress={() =>
                setVisibleMonth((month) => shiftMonth(month, -1))
              }
              style={({ pressed }) => [
                styles.navigationButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.navigationText}>‹</Text>
            </Pressable>
            <Text style={styles.title}>
              {formatMonthTitle(visibleMonth)}
            </Text>
            <Pressable
              accessibilityLabel="Следующий месяц"
              accessibilityRole="button"
              onPress={() =>
                setVisibleMonth((month) => shiftMonth(month, 1))
              }
              style={({ pressed }) => [
                styles.navigationButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.navigationText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.week}>
            {WEEKDAYS.map((weekday) => (
              <View key={weekday} style={styles.dayColumn}>
                <Text style={styles.weekday}>{weekday}</Text>
              </View>
            ))}
          </View>

          <View style={styles.grid}>
            {days.map((day, index) => {
              if (day === null) {
                return <View key={`empty-${index}`} style={styles.dayColumn} />;
              }

              const dateISO = dateForDay(visibleMonth, day);
              const selected = dateISO === value;
              const isToday = dateISO === today;
              return (
                <View key={dateISO} style={styles.dayColumn}>
                  <Pressable
                    accessibilityLabel={dateISO}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => selectDate(dateISO)}
                    style={({ pressed }) => [
                      styles.day,
                      isToday && styles.today,
                      selected && styles.selectedDay,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        selected && styles.selectedDayText,
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => selectDate(yesterdayLocalISO())}
              style={({ pressed }) => [
                styles.quickAction,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.quickActionText}>Вчера</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => selectDate(today)}
              style={({ pressed }) => [
                styles.quickAction,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.quickActionText}>Сегодня</Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.closeText}>Закрыть</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  closeButton: {
    alignItems: 'center',
    minHeight: theme.sizes.buttonHeight,
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
  },
  closeText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.body,
  },
  day: {
    alignItems: 'center',
    borderRadius: theme.radii.round,
    height: theme.sizes.dateCell,
    justifyContent: 'center',
    width: theme.sizes.dateCell,
  },
  dayColumn: {
    alignItems: 'center',
    minHeight: theme.sizes.dateCell,
    width: theme.sizes.dateColumn,
  },
  dayText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.label,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  modal: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.modal,
    maxWidth: theme.sizes.maxContentWidth,
    padding: theme.spacing.lg,
    width: theme.sizes.modalWidth,
  },
  navigationButton: {
    alignItems: 'center',
    height: theme.sizes.iconButton,
    justifyContent: 'center',
    width: theme.sizes.iconButton,
  },
  navigationText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.title,
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: theme.colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  quickAction: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.button,
    flex: 1,
    minHeight: theme.sizes.buttonHeight,
    justifyContent: 'center',
  },
  quickActionText: {
    color: theme.colors.accent,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  selectedDay: {
    backgroundColor: theme.colors.accent,
  },
  selectedDayText: {
    color: theme.colors.white,
    fontWeight: '700',
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
  today: {
    backgroundColor: theme.colors.accentMuted,
  },
  week: {
    flexDirection: 'row',
    marginBottom: theme.spacing.xs,
  },
  weekday: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.small,
    fontWeight: '600',
  },
});
