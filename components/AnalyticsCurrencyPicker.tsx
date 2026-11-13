import Feather from '@expo/vector-icons/Feather';
import { Fragment, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useLanguage } from '../contexts/LanguageContext';
import { useColors } from '../contexts/ThemeContext';
import { theme, type Colors } from '../lib/theme';

type AnalyticsCurrencyPickerProps = {
  accessibilityLabel: string;
  onChange: (currency: string) => void;
  options: readonly string[];
  value: string;
};

export function AnalyticsCurrencyPicker({
  accessibilityLabel,
  onChange,
  options,
  value,
}: AnalyticsCurrencyPickerProps) {
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ expanded: visible }}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [
          styles.selector,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.value}>{value}</Text>
        <Feather
          color={colors.icon.secondary}
          name="chevron-down"
          size={theme.scale.size.iconMd}
        />
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        transparent={true}
        visible={visible}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel={accessibilityLabel}
            accessibilityRole="button"
            onPress={() => setVisible(false)}
            style={styles.scrim}
          />
          <View accessibilityViewIsModal={true} style={styles.modalPanel}>
            <Text style={styles.modalTitle}>
              {t('settings.homeCurrency.title')}
            </Text>
            <View accessibilityRole="radiogroup" style={styles.options}>
              {options.map((currency, index) => {
                const selected = currency === value;
                return (
                  <Fragment key={currency}>
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => {
                        onChange(currency);
                        setVisible(false);
                      }}
                      style={({ pressed }) => [
                        styles.option,
                        pressed && styles.rowPressed,
                      ]}
                    >
                      <Text style={styles.optionLabel}>{currency}</Text>
                      {selected ? (
                        <Feather
                          color={colors.icon.action}
                          name="check"
                          size={theme.scale.size.iconMd}
                        />
                      ) : null}
                    </Pressable>
                    {index < options.length - 1 ? (
                      <View style={styles.separator} />
                    ) : null}
                  </Fragment>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  modalPanel: {
    backgroundColor: c.surface.overlay,
    borderRadius: theme.scale.radius.lg,
    maxWidth: theme.sizes.modalWidth,
    padding: theme.scale.space[4],
    width: '100%',
  },
  modalRoot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: theme.scale.space[4],
  },
  modalTitle: {
    ...theme.type.titleSection,
    color: c.text.primary,
    marginBottom: theme.scale.space[3],
  },
  option: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: theme.scale.size.touchTarget,
    paddingHorizontal: theme.scale.space[3],
  },
  optionLabel: {
    ...theme.type.bodyDefault,
    color: c.text.primary,
  },
  options: {
    borderColor: c.border.subtle,
    borderRadius: theme.scale.radius.sm,
    borderWidth: theme.scale.stroke.hairline,
    overflow: 'hidden',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  rowPressed: {
    backgroundColor: c.surface.default,
  },
  scrim: {
    backgroundColor: c.overlay.scrim,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  selector: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: c.field.border,
    borderRadius: theme.scale.radius.sm,
    borderWidth: theme.scale.stroke.hairline,
    flexDirection: 'row',
    gap: theme.scale.space[2],
    minHeight: theme.scale.size.fieldHeight,
    paddingHorizontal: theme.scale.space[3],
  },
  separator: {
    backgroundColor: c.separatorInset,
    height: theme.scale.stroke.hairline,
  },
  value: {
    ...theme.type.labelDefault,
    color: c.text.primary,
  },
});
