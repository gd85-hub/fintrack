import Feather from '@expo/vector-icons/Feather';
import { useEffect, useMemo, useState } from 'react';
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
import { formatDayMonth, todayLocalISO } from '../lib/dates';
import type { Period } from '../lib/period';
import { theme, type Colors } from '../lib/theme';
import { DatePicker } from './DatePicker';

type PeriodSelectorProps = {
  visible: boolean;
  period: Period;
  onSelect: (period: Period) => void;
  onClose: () => void;
};

type PresetKind = Exclude<Period['kind'], 'custom'>;
type DateField = 'from' | 'to';

const presetKinds: readonly PresetKind[] = [
  'thisMonth',
  'lastMonth',
  'last3Months',
  'thisYear',
];

export function PeriodSelector({
  visible,
  period,
  onSelect,
  onClose,
}: PeriodSelectorProps) {
  const { t, locale } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const [customExpanded, setCustomExpanded] = useState(
    period.kind === 'custom',
  );
  const [fromISO, setFromISO] = useState(
    period.kind === 'custom' ? period.fromISO : '',
  );
  const [toISO, setToISO] = useState(
    period.kind === 'custom' ? period.toISO : '',
  );
  const [activeDateField, setActiveDateField] =
    useState<DateField | null>(null);
  const today = todayLocalISO();
  const canApply = fromISO !== '' && toISO !== '' && fromISO <= toISO;
  const pickerValue =
    activeDateField === 'from' ? fromISO || today : toISO || today;

  useEffect(() => {
    if (!visible) {
      setActiveDateField(null);
      return;
    }

    if (period.kind === 'custom') {
      setCustomExpanded(true);
      setFromISO(period.fromISO);
      setToISO(period.toISO);
    } else {
      setCustomExpanded(false);
      setFromISO('');
      setToISO('');
    }
  }, [period, visible]);

  function handleDateChange(dateISO: string) {
    if (activeDateField === 'from') {
      setFromISO(dateISO);
    } else if (activeDateField === 'to') {
      setToISO(dateISO);
    }
  }

  function handleApply() {
    if (!canApply) {
      return;
    }

    onSelect({ kind: 'custom', fromISO, toISO });
  }

  return (
    <>
      <Modal
        animationType="fade"
        onRequestClose={onClose}
        transparent
        visible={visible}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityLabel={t('period.close')}
            accessibilityRole="button"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>{t('period.title')}</Text>
              <Pressable
                accessibilityLabel={t('period.close')}
                accessibilityRole="button"
                onPress={onClose}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.pressed,
                ]}
              >
                <Feather
                  color={colors.icon.secondary}
                  name="x"
                  size={theme.scale.size.iconMd}
                />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
              {presetKinds.map((kind) => {
                const selected = period.kind === kind;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={kind}
                    onPress={() => onSelect({ kind })}
                    style={({ pressed }) => [
                      styles.optionRow,
                      selected && styles.selectedRow,
                      pressed && styles.pressedRow,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionLabel,
                        selected && styles.selectedLabel,
                      ]}
                    >
                      {t(`period.${kind}`)}
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

              <View style={styles.divider} />

              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  expanded: customExpanded,
                  selected: period.kind === 'custom',
                }}
                onPress={() => setCustomExpanded(true)}
                style={({ pressed }) => [
                  styles.optionRow,
                  period.kind === 'custom' && styles.selectedRow,
                  pressed && styles.pressedRow,
                ]}
              >
                <Text
                  style={[
                    styles.optionLabel,
                    period.kind === 'custom' && styles.selectedLabel,
                  ]}
                >
                  {t('period.custom')}
                </Text>
                <Feather
                  color={
                    period.kind === 'custom'
                      ? colors.icon.action
                      : colors.icon.secondary
                  }
                  name={period.kind === 'custom' ? 'check' : 'chevron-down'}
                  size={theme.scale.size.iconMd}
                />
              </Pressable>

              {customExpanded ? (
                <View style={styles.customBlock}>
                  <View style={styles.dateFields}>
                    <View style={styles.dateFieldGroup}>
                      <Text style={styles.fieldLabel}>{t('period.from')}</Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setActiveDateField('from')}
                        style={({ pressed }) => [
                          styles.dateField,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.dateValue}>
                          {fromISO ? formatDayMonth(fromISO, locale) : '—'}
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.dateFieldGroup}>
                      <Text style={styles.fieldLabel}>{t('period.to')}</Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setActiveDateField('to')}
                        style={({ pressed }) => [
                          styles.dateField,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.dateValue}>
                          {toISO ? formatDayMonth(toISO, locale) : '—'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canApply }}
                    disabled={!canApply}
                    onPress={handleApply}
                    style={({ pressed }) => [
                      styles.applyButton,
                      !canApply && styles.applyButtonDisabled,
                      pressed && canApply && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.applyLabel,
                        !canApply && styles.applyLabelDisabled,
                      ]}
                    >
                      {t('period.apply')}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <DatePicker
        onChange={handleDateChange}
        onClose={() => setActiveDateField(null)}
        value={pickerValue}
        visible={activeDateField !== null}
      />
    </>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    applyButton: {
      alignItems: 'center',
      backgroundColor: c.action.primary.fill,
      borderRadius: theme.scale.radius.sm,
      justifyContent: 'center',
      minHeight: theme.scale.size.buttonHeight,
      paddingHorizontal: theme.scale.space[4],
    },
    applyButtonDisabled: {
      backgroundColor: c.action.primary.disabled,
    },
    applyLabel: {
      ...theme.type.labelDefault,
      color: c.action.primary.content,
    },
    applyLabelDisabled: {
      color: c.action.primary.disabledContent,
    },
    closeButton: {
      alignItems: 'center',
      height: theme.scale.size.iconButton,
      justifyContent: 'center',
      width: theme.scale.size.iconButton,
    },
    content: {
      paddingBottom: theme.scale.space[4],
    },
    customBlock: {
      gap: theme.scale.space[4],
      paddingHorizontal: theme.scale.space[4],
      paddingTop: theme.scale.space[3],
    },
    dateField: {
      alignItems: 'center',
      backgroundColor: c.field.fill,
      borderColor: c.field.border,
      borderRadius: theme.scale.radius.sm,
      borderWidth: theme.scale.stroke.hairline,
      justifyContent: 'center',
      minHeight: theme.scale.size.fieldHeight,
      paddingHorizontal: theme.scale.space[3],
    },
    dateFieldGroup: {
      flex: 1,
      gap: theme.scale.space[1],
    },
    dateFields: {
      flexDirection: 'row',
      gap: theme.scale.space[3],
    },
    dateValue: {
      ...theme.type.bodyDefault,
      color: c.text.primary,
    },
    divider: {
      backgroundColor: c.border.subtle,
      height: theme.scale.stroke.hairline,
      marginVertical: theme.scale.space[2],
    },
    fieldLabel: {
      ...theme.type.captionDefault,
      color: c.text.secondary,
    },
    header: {
      alignItems: 'center',
      borderBottomColor: c.border.subtle,
      borderBottomWidth: theme.scale.stroke.hairline,
      flexDirection: 'row',
      paddingHorizontal: theme.scale.space[4],
      paddingVertical: theme.scale.space[2],
    },
    optionLabel: {
      ...theme.type.bodyDefault,
      color: c.text.secondary,
      flex: 1,
    },
    optionRow: {
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
    pressed: {
      opacity: theme.opacity.pressed,
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
    title: {
      ...theme.type.titleNav,
      color: c.text.primary,
      flex: 1,
    },
  });
