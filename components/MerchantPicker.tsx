import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  createMerchant,
  type Merchant,
  type MerchantType,
} from '../lib/db';
import { theme } from '../lib/theme';

type MerchantPickerProps = {
  allowCreate?: boolean;
  merchants: Merchant[];
  merchantTypes: MerchantType[];
  value: string | null;
  onChange: (merchantId: string | null) => void;
  onCreated?: (merchant: Merchant) => void;
};

export function MerchantPicker({
  allowCreate = true,
  merchants,
  merchantTypes,
  value,
  onChange,
  onCreated,
}: MerchantPickerProps) {
  const [visible, setVisible] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [typeId, setTypeId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const selected = merchants.find((merchant) => merchant.id === value);

  function close() {
    setVisible(false);
    setAdding(false);
    setErrorMessage('');
  }

  function selectMerchant(merchantId: string | null) {
    onChange(merchantId);
    close();
  }

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName || !typeId) {
      setErrorMessage('Укажите название и тип места.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const merchant = await createMerchant(trimmedName, typeId);
      onCreated?.(merchant);
      onChange(merchant.id);
      setName('');
      setTypeId(null);
      close();
    } catch (error: unknown) {
      console.error('Unable to create merchant:', error);
      setErrorMessage(
        'Не удалось добавить место. Возможно, оно уже существует.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>Место</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setVisible(true)}
          style={({ pressed }) => [
            styles.selector,
            pressed && styles.pressed,
          ]}
        >
          <Text style={selected ? styles.value : styles.placeholder}>
            {selected?.name ?? 'Не указано'}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={close}
        transparent
        visible={visible}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Место</Text>
              <Pressable accessibilityRole="button" onPress={close}>
                <Text style={styles.close}>Закрыть</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
            >
              {adding ? (
                <View style={styles.createForm}>
                  <TextInput
                    autoCapitalize="sentences"
                    maxLength={80}
                    onChangeText={setName}
                    placeholder="Название"
                    placeholderTextColor={theme.colors.textMuted}
                    style={styles.input}
                    value={name}
                  />

                  <View style={styles.typeChips}>
                    {merchantTypes.map((merchantType) => {
                      const selectedType = merchantType.id === typeId;
                      return (
                        <Pressable
                          accessibilityRole="radio"
                          accessibilityState={{ selected: selectedType }}
                          key={merchantType.id}
                          onPress={() => setTypeId(merchantType.id)}
                          style={({ pressed }) => [
                            styles.typeChip,
                            selectedType && styles.typeChipSelected,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.typeChipText,
                              selectedType && styles.typeChipTextSelected,
                            ]}
                          >
                            {merchantType.emoji} {merchantType.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {errorMessage ? (
                    <Text style={styles.error}>{errorMessage}</Text>
                  ) : null}

                  <View style={styles.createActions}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={submitting}
                      onPress={() => {
                        setAdding(false);
                        setErrorMessage('');
                      }}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.secondaryButtonText}>Отмена</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={submitting}
                      onPress={() => void handleCreate()}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        (pressed || submitting) && styles.pressed,
                      ]}
                    >
                      <Text style={styles.primaryButtonText}>
                        {submitting ? 'Добавление…' : 'Добавить'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => selectMerchant(null)}
                    style={({ pressed }) => [
                      styles.row,
                      value === null && styles.rowSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.rowText}>Не указано</Text>
                  </Pressable>

                  {merchants.map((merchant) => (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{
                        selected: merchant.id === value,
                      }}
                      key={merchant.id}
                      onPress={() => selectMerchant(merchant.id)}
                      style={({ pressed }) => [
                        styles.row,
                        merchant.id === value && styles.rowSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.rowText}>{merchant.name}</Text>
                    </Pressable>
                  ))}

                  {allowCreate ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setAdding(true)}
                      style={({ pressed }) => [
                        styles.addRow,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.addRowText}>
                        + Добавить место
                      </Text>
                    </Pressable>
                  ) : null}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  addRow: {
    alignItems: 'center',
    borderRadius: theme.radii.button,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  addRowText: {
    color: theme.colors.accent,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  chevron: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.title,
  },
  close: {
    color: theme.colors.accent,
    fontSize: theme.fontSizes.body,
  },
  createActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  createForm: {
    gap: theme.spacing.md,
  },
  error: {
    color: theme.colors.danger,
    fontSize: theme.fontSizes.caption,
  },
  field: {
    gap: theme.spacing.xs,
  },
  input: {
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  list: {
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.md,
  },
  modal: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.modal,
    maxHeight: theme.sizes.modalMaxHeight,
    maxWidth: theme.sizes.maxContentWidth,
    padding: theme.spacing.lg,
    width: theme.sizes.modalWidth,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.title,
    fontWeight: '700',
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: theme.colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  placeholder: {
    color: theme.colors.textMuted,
    flex: 1,
    fontSize: theme.fontSizes.body,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.button,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
  },
  primaryButtonText: {
    color: theme.colors.white,
    fontSize: theme.fontSizes.button,
    fontWeight: '600',
  },
  row: {
    borderRadius: theme.radii.button,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  rowSelected: {
    backgroundColor: theme.colors.accentMuted,
  },
  rowText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.button,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.button,
    fontWeight: '600',
  },
  selector: {
    alignItems: 'center',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    flexDirection: 'row',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  typeChip: {
    borderColor: theme.colors.border,
    borderRadius: theme.radii.chip,
    borderWidth: theme.sizes.border,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  typeChipSelected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  typeChipText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.caption,
  },
  typeChipTextSelected: {
    color: theme.colors.white,
  },
  typeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  value: {
    color: theme.colors.text,
    flex: 1,
    fontSize: theme.fontSizes.body,
  },
});
