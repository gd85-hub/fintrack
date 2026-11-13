import Feather from '@expo/vector-icons/Feather';
import { Fragment, useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useColors } from '../contexts/ThemeContext';
import { theme, type Colors } from '../lib/theme';

export type CurrencyPickerOption = {
  label: string;
  value: string | null;
};

type CurrencyPickerModalProps = {
  onClose: () => void;
  onSelect: (value: string | null) => void;
  options: readonly CurrencyPickerOption[];
  title: string;
  value: string | null;
  visible: boolean;
};

export function CurrencyPickerModal({
  onClose,
  onSelect,
  options,
  title,
  value,
  visible,
}: CurrencyPickerModalProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent={true}
      visible={visible}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel={title}
          accessibilityRole="button"
          onPress={onClose}
          style={styles.scrim}
        />
        <View accessibilityViewIsModal={true} style={styles.modalPanel}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView
            contentContainerStyle={styles.options}
            style={styles.optionsScroll}
          >
            {options.map((option, index) => {
              const selected = value === option.value;

              return (
                <Fragment key={option.value ?? 'off'}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => {
                      onSelect(option.value);
                      onClose();
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    {selected ? (
                      <Feather
                        color={colors.icon.action}
                        name="check"
                        size={theme.spacing.lg}
                      />
                    ) : null}
                  </Pressable>
                  {index < options.length - 1 ? (
                    <View style={styles.separator} />
                  ) : null}
                </Fragment>
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
    modalPanel: {
      backgroundColor: c.surface.raised,
      borderRadius: theme.radii.modal,
      gap: theme.spacing.md,
      maxWidth: theme.sizes.maxContentWidth,
      maxHeight: theme.sizes.modalMaxHeight,
      padding: theme.spacing.lg,
      width: theme.sizes.modalWidth,
    },
    modalRoot: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: theme.spacing.md,
    },
    modalTitle: {
      color: c.text.primary,
      fontSize: theme.fontSizes.body,
      fontWeight: '700',
    },
    option: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      minHeight: theme.sizes.floatingButton,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    optionLabel: {
      color: c.text.primary,
      flex: 1,
      fontSize: theme.fontSizes.body,
      fontWeight: '600',
    },
    options: {
      borderColor: c.border.default,
      borderRadius: theme.radii.input,
      borderWidth: theme.sizes.border,
      overflow: 'hidden',
    },
    optionsScroll: {
      flexGrow: 0,
    },
    pressed: {
      backgroundColor: c.state.pressed,
    },
    scrim: {
      ...StyleSheet.absoluteFill,
      backgroundColor: c.overlay.scrim,
    },
    separator: {
      backgroundColor: c.separatorInset,
      height: theme.sizes.border,
      marginLeft: theme.spacing.md,
    },
  });
