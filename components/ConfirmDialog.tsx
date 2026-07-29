import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { theme } from '../lib/theme';

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  confirming: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  confirming,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
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
              <Text style={styles.cancelText}>Отмена</Text>
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
                {confirming ? 'Удаление…' : 'Удалить'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    color: theme.colors.text,
    fontSize: theme.fontSizes.button,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: theme.colors.danger,
  },
  dangerText: {
    color: theme.colors.white,
    fontSize: theme.fontSizes.button,
    fontWeight: '600',
  },
  dialog: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.modal,
    gap: theme.spacing.lg,
    maxWidth: theme.sizes.maxContentWidth,
    padding: theme.spacing.lg,
    width: theme.sizes.modalWidth,
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
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
    textAlign: 'center',
  },
});
