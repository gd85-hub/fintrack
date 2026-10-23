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

import { useLanguage } from '../contexts/LanguageContext';
import { useColors } from '../contexts/ThemeContext';
import { formatMonthTitle, shiftMonth } from '../lib/dates';
import { theme, type Colors } from '../lib/theme';

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
  const { t, locale } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
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
          accessibilityLabel={t('home.closeMonthPicker')}
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.monthList}>
            {months.map((month) => {
              const selected = month === selectedMonth;
              const label = formatMonthTitle(month, locale);

              return (
                <Pressable
                  accessibilityLabel={t('home.selectMonthValue', {
                    month: label,
                  })}
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
                      color={colors.icon.action}
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

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    monthLabel: {
      ...theme.type.bodyDefault,
      color: c.text.secondary,
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
      backgroundColor: c.overlay.scrim,
      flex: 1,
      justifyContent: 'flex-end',
      padding: theme.scale.space[4],
    },
    pressedRow: {
      backgroundColor: c.state.pressed,
    },
    selectedLabel: {
      color: c.text.primary,
    },
    selectedRow: {
      backgroundColor: c.surface.selected,
    },
    sheet: {
      backgroundColor: c.surface.raised,
      borderRadius: theme.scale.radius.sheet,
      maxHeight: theme.sizes.modalMaxHeight,
      maxWidth: theme.sizes.maxContentWidth,
      overflow: 'hidden',
      width: theme.sizes.modalWidth,
    },
  });
