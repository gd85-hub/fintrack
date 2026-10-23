import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useLanguage } from '../contexts/LanguageContext';
import { useColors } from '../contexts/ThemeContext';
import {
  createMerchant,
  type Merchant,
} from '../lib/db';
import { filterAndSortMerchants } from '../lib/merchantSearch';
import { theme, type Colors } from '../lib/theme';

type MerchantPickerProps = {
  allowCreate?: boolean;
  merchants: Merchant[];
  value: string | null;
  onChange: (merchantId: string | null) => void;
  onCreated?: (merchant: Merchant) => void;
};

export function MerchantPicker({
  allowCreate = true,
  merchants,
  value,
  onChange,
  onCreated,
}: MerchantPickerProps) {
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const [visible, setVisible] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const selected = merchants.find((merchant) => merchant.id === value);
  const displayedMerchants = useMemo(
    () => filterAndSortMerchants(merchants, query),
    [merchants, query],
  );

  function close() {
    setVisible(false);
    setAdding(false);
    setErrorMessage('');
    setQuery('');
  }

  function selectMerchant(merchantId: string | null) {
    onChange(merchantId);
    close();
  }

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage(t('merchant.nameRequired'));
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const merchant = await createMerchant(trimmedName);
      onCreated?.(merchant);
      onChange(merchant.id);
      setName('');
      close();
    } catch (error: unknown) {
      console.error('Unable to create merchant:', error);
      setErrorMessage(t('merchant.addFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>{t('common.place')}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setVisible(true)}
          style={({ pressed }) => [
            styles.selector,
            pressed && styles.pressed,
          ]}
        >
          <Text style={selected ? styles.value : styles.placeholder}>
            {selected?.name ?? t('common.notSet')}
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
              <Text style={styles.modalTitle}>{t('common.place')}</Text>
              <Pressable accessibilityRole="button" onPress={close}>
                <Text style={styles.close}>{t('common.close')}</Text>
              </Pressable>
            </View>

            {!adding ? (
              <TextInput
                accessibilityLabel={t('merchant.searchA11y')}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                onChangeText={setQuery}
                placeholder={t('merchant.searchPlaceholder')}
                placeholderTextColor={colors.text.secondary}
                returnKeyType="search"
                style={styles.searchInput}
                value={query}
              />
            ) : null}

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
                    placeholder={t('common.name')}
                    placeholderTextColor={colors.text.secondary}
                    style={styles.input}
                    value={name}
                  />

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
                      <Text style={styles.secondaryButtonText}>
                        {t('common.cancel')}
                      </Text>
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
                        {submitting ? t('common.adding') : t('common.add')}
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
                    <Text style={styles.rowText}>{t('common.notSet')}</Text>
                  </Pressable>

                  {displayedMerchants.map((merchant) => (
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

                  {query.trim() && displayedMerchants.length === 0 ? (
                    <Text style={styles.emptyHint}>
                      {t('common.nothingFound')}
                    </Text>
                  ) : null}

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
                        {t('merchant.addPlace')}
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

const makeStyles = (c: Colors) => StyleSheet.create({
  addRow: {
    alignItems: 'center',
    borderRadius: theme.radii.button,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  addRowText: {
    color: c.action.link.rest,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  chevron: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.title,
  },
  close: {
    color: c.action.link.rest,
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
    color: c.status.error.content,
    fontSize: theme.fontSizes.caption,
  },
  emptyHint: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.caption,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    textAlign: 'center',
  },
  field: {
    gap: theme.spacing.xs,
  },
  input: {
    borderColor: c.field.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  label: {
    color: c.text.primary,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  list: {
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.md,
  },
  modal: {
    backgroundColor: c.surface.overlay,
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
    color: c.text.primary,
    fontSize: theme.fontSizes.title,
    fontWeight: '700',
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: c.overlay.scrim,
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  placeholder: {
    color: c.text.secondary,
    flex: 1,
    fontSize: theme.fontSizes.body,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: c.action.primary.fill,
    borderRadius: theme.radii.button,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
  },
  primaryButtonText: {
    color: c.action.primary.content,
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
    backgroundColor: c.action.container,
  },
  rowText: {
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
  },
  searchInput: {
    borderColor: c.field.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    marginBottom: theme.spacing.sm,
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: c.surface.default,
    borderRadius: theme.radii.button,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
  },
  secondaryButtonText: {
    color: c.text.primary,
    fontSize: theme.fontSizes.button,
    fontWeight: '600',
  },
  selector: {
    alignItems: 'center',
    borderColor: c.field.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    flexDirection: 'row',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  value: {
    color: c.text.primary,
    flex: 1,
    fontSize: theme.fontSizes.body,
  },
});
