import { useMemo } from 'react';
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

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  confirming: boolean;
  confirmLabel?: string;
  confirmingLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  confirming,
  confirmLabel,
  confirmingLabel,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={confirming}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={confirming}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                styles.dangerButton,
                (pressed || confirming) && styles.pressed,
              ]}
            >
              <Text style={styles.dangerText}>
                {confirming
                  ? (confirmingLabel ?? t('common.deleting'))
                  : (confirmLabel ?? t('common.delete'))}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    actions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    button: {
      alignItems: 'center',
      borderRadius: theme.radii.button,
      flex: 1,
      justifyContent: 'center',
      minHeight: theme.sizes.buttonHeight,
    },
    cancelText: {
      color: c.text.primary,
      fontSize: theme.fontSizes.button,
      fontWeight: '600',
    },
    dangerButton: {
      backgroundColor: c.action.destructive.fill,
    },
    dangerText: {
      color: c.action.destructive.content,
      fontSize: theme.fontSizes.button,
      fontWeight: '600',
    },
    dialog: {
      backgroundColor: c.surface.overlay,
      borderRadius: theme.radii.modal,
      gap: theme.spacing.lg,
      maxWidth: theme.sizes.maxContentWidth,
      padding: theme.spacing.lg,
      width: theme.sizes.modalWidth,
    },
    overlay: {
      alignItems: 'center',
      backgroundColor: c.overlay.scrim,
      flex: 1,
      justifyContent: 'center',
      padding: theme.spacing.md,
    },
    pressed: {
      opacity: theme.opacity.pressed,
    },
    title: {
      color: c.text.primary,
      fontSize: theme.fontSizes.body,
      fontWeight: '700',
      textAlign: 'center',
    },
  });
