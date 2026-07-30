import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { CategoryPicker } from '../../../components/CategoryPicker';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { MerchantPicker } from '../../../components/MerchantPicker';
import { useReceiptDraft } from '../../../contexts/ReceiptDraftContext';
import {
  listCategories,
  listMerchants,
  listMerchantTypes,
  saveFiscalReceipt,
  type Category,
  type FiscalReceiptMerchantInput,
  type Merchant,
  type MerchantType,
} from '../../../lib/db';
import { formatMoney } from '../../../lib/money';
import { receiptDate } from '../../../lib/receipts';
import { theme } from '../../../lib/theme';

type MerchantMode = 'existing' | 'new';

type ReviewItem = {
  amountCents: number;
  categoryId: string;
  description: string;
  included: boolean;
  quantity: number;
  unitPriceCents: number;
  vatLabel: string | null;
};

function normalizeMerchantName(value: string) {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

function matchingMerchant(
  merchants: readonly Merchant[],
  receiptName: string,
) {
  const normalizedReceiptName = normalizeMerchantName(receiptName);
  return (
    merchants.find((merchant) =>
      [merchant.name, ...merchant.aliases].some(
        (name) => normalizeMerchantName(name) === normalizedReceiptName,
      ),
    ) ?? null
  );
}

export default function ReviewReceiptScreen() {
  const { draft, clearDraft } = useReceiptDraft();
  const [categories, setCategories] = useState<Category[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [merchantTypes, setMerchantTypes] = useState<MerchantType[]>([]);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [merchantMode, setMerchantMode] =
    useState<MerchantMode>('new');
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState(
    draft?.merchantName ?? '',
  );
  const [merchantTypeId, setMerchantTypeId] = useState<string | null>(null);
  const [bulkCategoryId, setBulkCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!draft) {
      setLoading(false);
      return;
    }

    let active = true;
    void Promise.all([
      listCategories(),
      listMerchants(),
      listMerchantTypes(),
    ])
      .then(([loadedCategories, loadedMerchants, loadedTypes]) => {
        if (!active) {
          return;
        }
        const uncategorized = loadedCategories.find(
          (category) => category.slug === 'uncategorized',
        );
        if (!uncategorized) {
          throw new Error('Категория «Не распознано» не найдена.');
        }
        const matched = matchingMerchant(
          loadedMerchants,
          draft.merchantName,
        );
        const defaultType =
          loadedTypes.find((type) => type.slug === 'shop') ??
          loadedTypes[0] ??
          null;

        setCategories(loadedCategories);
        setMerchants(loadedMerchants);
        setMerchantTypes(loadedTypes);
        setMerchantMode(matched ? 'existing' : 'new');
        setMerchantId(matched?.id ?? null);
        setMerchantTypeId(
          matched?.typeId ?? defaultType?.id ?? null,
        );
        setBulkCategoryId(uncategorized.id);
        setItems(
          draft.items.map((item) => ({
            amountCents: item.lineTotalCents,
            categoryId: uncategorized.id,
            description: item.name,
            included: true,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            vatLabel: item.vatLabel,
          })),
        );
      })
      .catch((error: unknown) => {
        console.error('Unable to prepare receipt review:', error);
        if (active) {
          setErrorMessage(
            'Не удалось подготовить чек. Попробуйте ещё раз.',
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [draft]);

  const includedItems = useMemo(
    () => items.filter((item) => item.included),
    [items],
  );
  const includedTotal = useMemo(
    () =>
      includedItems.reduce((sum, item) => sum + item.amountCents, 0),
    [includedItems],
  );

  if (!draft) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.stateTitle}>Чек не найден</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(app)')}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>На главную</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return <LoadingScreen />;
  }

  const applyCategoryToAll = (categoryId: string) => {
    setBulkCategoryId(categoryId);
    setItems((current) =>
      current.map((item) => ({ ...item, categoryId })),
    );
  };

  const updateItemCategory = (index: number, categoryId: string) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, categoryId } : item,
      ),
    );
  };

  const toggleItem = (index: number) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, included: !item.included }
          : item,
      ),
    );
  };

  const handleSave = async () => {
    setErrorMessage('');
    if (!includedItems.length) {
      setErrorMessage('Оставьте хотя бы одну позицию чека.');
      return;
    }

    let merchant: FiscalReceiptMerchantInput | null = null;
    if (merchantMode === 'existing' && merchantId) {
      merchant = { existingId: merchantId };
    }
    if (
      merchantMode === 'new' &&
      merchantName.trim() &&
      merchantTypeId
    ) {
      merchant = { name: merchantName, typeId: merchantTypeId };
    }
    if (!merchant) {
      setErrorMessage(
        merchantMode === 'existing'
          ? 'Выберите существующее место.'
          : 'Укажите название и тип нового места.',
      );
      return;
    }

    setSaving(true);
    try {
      await saveFiscalReceipt({
        receipt: draft,
        merchant,
        expenses: includedItems.map((item) => ({
          amountCents: item.amountCents,
          categoryId: item.categoryId,
          description: item.description,
        })),
      });
      clearDraft();
      router.replace('/(app)');
    } catch (error: unknown) {
      console.error('Unable to save fiscal receipt:', error);
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : 'Не удалось сохранить чек. Попробуйте ещё раз.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Назад"
          accessibilityRole="button"
          disabled={saving}
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Проверить чек</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Дата</Text>
            <Text style={styles.summaryValue}>
              {receiptDate(draft.occurredAt)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Итого в чеке</Text>
            <Text style={styles.summaryValue}>
              {formatMoney(draft.totalCents)} RSD
            </Text>
          </View>
          {draft.paymentType ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Оплата</Text>
              <Text style={styles.summaryValue}>{draft.paymentType}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Место</Text>
          <View style={styles.modeChips}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: merchantMode === 'existing' }}
              onPress={() => setMerchantMode('existing')}
              style={({ pressed }) => [
                styles.modeChip,
                merchantMode === 'existing' && styles.modeChipSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.modeChipText,
                  merchantMode === 'existing' &&
                    styles.modeChipTextSelected,
                ]}
              >
                Существующее
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: merchantMode === 'new' }}
              onPress={() => setMerchantMode('new')}
              style={({ pressed }) => [
                styles.modeChip,
                merchantMode === 'new' && styles.modeChipSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.modeChipText,
                  merchantMode === 'new' && styles.modeChipTextSelected,
                ]}
              >
                Новое
              </Text>
            </Pressable>
          </View>

          {merchantMode === 'existing' ? (
            <MerchantPicker
              allowCreate={false}
              merchants={merchants}
              merchantTypes={merchantTypes}
              onChange={setMerchantId}
              value={merchantId}
            />
          ) : (
            <View style={styles.newMerchant}>
              <Text style={styles.label}>Название</Text>
              <TextInput
                autoCapitalize="words"
                maxLength={80}
                onChangeText={setMerchantName}
                placeholder="Название места"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                value={merchantName}
              />
              <Text style={styles.label}>Тип места</Text>
              <View style={styles.typeChips}>
                {merchantTypes.map((type) => {
                  const selected = type.id === merchantTypeId;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      key={type.id}
                      onPress={() => setMerchantTypeId(type.id)}
                      style={({ pressed }) => [
                        styles.typeChip,
                        selected && styles.typeChipSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeChipText,
                          selected && styles.typeChipTextSelected,
                        ]}
                      >
                        {type.emoji} {type.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Позиции · {includedItems.length} из {items.length}
          </Text>
          <CategoryPicker
            categories={categories}
            label="Категория для всех"
            onChange={applyCategoryToAll}
            value={bulkCategoryId}
          />

          {items.map((item, index) => (
            <View
              key={`${index}-${item.description}`}
              style={[
                styles.itemCard,
                !item.included && styles.itemCardExcluded,
              ]}
            >
              <View style={styles.itemHeader}>
                <View style={styles.itemCopy}>
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.itemName,
                      !item.included && styles.excludedText,
                    ]}
                  >
                    {item.description}
                  </Text>
                  <Text style={styles.itemDetails}>
                    {item.quantity} × {formatMoney(item.unitPriceCents)} RSD
                    {item.vatLabel ? ` · НДС ${item.vatLabel}` : ''}
                  </Text>
                </View>
                <Text style={styles.itemAmount}>
                  {formatMoney(item.amountCents)} RSD
                </Text>
              </View>
              {item.included ? (
                <CategoryPicker
                  categories={categories}
                  onChange={(categoryId) =>
                    updateItemCategory(index, categoryId)
                  }
                  value={item.categoryId}
                />
              ) : null}
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !item.included }}
                onPress={() => toggleItem(index)}
                style={({ pressed }) => [
                  styles.excludeButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.excludeText}>
                  {item.included ? 'Исключить позицию' : 'Вернуть позицию'}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.saveSummary}>
          <Text style={styles.saveSummaryLabel}>Будет сохранено</Text>
          <Text style={styles.saveSummaryTotal}>
            {formatMoney(includedTotal)} RSD
          </Text>
        </View>

        {errorMessage ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {errorMessage}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => void handleSave()}
          style={({ pressed }) => [
            styles.primaryButton,
            (pressed || saving) && styles.disabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator color={theme.colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Сохранить чек</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    height: theme.sizes.iconButton,
    justifyContent: 'center',
    width: theme.sizes.iconButton,
  },
  backText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.title,
  },
  centerState: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    flex: 1,
    gap: theme.spacing.lg,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  content: {
    alignSelf: 'center',
    gap: theme.spacing.lg,
    maxWidth: theme.sizes.maxContentWidth,
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
    width: '100%',
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.fontSizes.body,
    textAlign: 'center',
  },
  excludeButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: theme.sizes.iconButton,
  },
  excludeText: {
    color: theme.colors.danger,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  excludedText: {
    color: theme.colors.textMuted,
    textDecorationLine: 'line-through',
  },
  header: {
    alignItems: 'center',
    borderBottomColor: theme.colors.border,
    borderBottomWidth: theme.sizes.border,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  input: {
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.md,
  },
  itemAmount: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
    textAlign: 'right',
  },
  itemCard: {
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    borderWidth: theme.sizes.border,
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  itemCardExcluded: {
    backgroundColor: theme.colors.surface,
    opacity: theme.opacity.disabled,
  },
  itemCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  itemDetails: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.caption,
  },
  itemHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  itemName: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  modeChip: {
    borderColor: theme.colors.border,
    borderRadius: theme.radii.chip,
    borderWidth: theme.sizes.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  modeChipSelected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  modeChipText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.label,
  },
  modeChipTextSelected: {
    color: theme.colors.white,
  },
  modeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  newMerchant: {
    gap: theme.spacing.sm,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.button,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.lg,
    width: '100%',
  },
  primaryButtonText: {
    color: theme.colors.white,
    fontSize: theme.fontSizes.button,
    fontWeight: '700',
  },
  saveSummary: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  saveSummaryLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.body,
  },
  saveSummaryTotal: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  section: {
    gap: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
  stateTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  summaryLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.label,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  summaryValue: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  title: {
    color: theme.colors.text,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
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
});
