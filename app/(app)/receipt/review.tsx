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
import {
  centsToInput,
  formatMoney,
  isCurrency,
  parseAmountInput,
} from '../../../lib/money';
import {
  findMatchingMerchant,
  parsedReceiptDate,
} from '../../../lib/receipts';
import { theme } from '../../../lib/theme';

type MerchantMode = 'existing' | 'new';

type ReviewItem = {
  amountCents: number | null;
  amountInput: string;
  categoryId: string;
  description: string;
  id: number;
  included: boolean;
  quantity: number | null;
  unitPriceCents: number | null;
  vatLabel: string | null;
};

function normalizeCategoryName(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

type ReviewTotalItem = {
  amountCents: number | null;
  included: boolean;
};

export function includedReviewTotal(
  items: readonly ReviewTotalItem[],
): number | null {
  let total = 0;

  for (const item of items) {
    if (!item.included) {
      continue;
    }
    if (item.amountCents === null) {
      return null;
    }

    total += item.amountCents;
    if (!Number.isSafeInteger(total)) {
      return null;
    }
  }

  return total;
}

export function reviewTotalsMismatch(
  includedTotal: number | null,
  receiptTotal: number,
) {
  return includedTotal !== null && includedTotal !== receiptTotal;
}

export function parseReviewAmountInput(value: string): number | null {
  const amountCents = parseAmountInput(value);
  return amountCents !== null && amountCents > 0 ? amountCents : null;
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
        const matched = findMatchingMerchant(
          loadedMerchants,
          draft.merchantName,
        );
        const defaultType =
          loadedTypes.find(
            (type) => type.slug === draft.merchantTypeSlug,
          ) ??
          loadedTypes.find((type) => type.slug === 'shop') ??
          loadedTypes[0] ??
          null;
        const categoriesByName = new Map(
          loadedCategories.map((category) => [
            normalizeCategoryName(category.name),
            category.id,
          ]),
        );

        setCategories(loadedCategories);
        setMerchants(loadedMerchants);
        setMerchantTypes(loadedTypes);
        setMerchantMode(matched ? 'existing' : 'new');
        setMerchantId(matched?.id ?? null);
        setMerchantTypeId(
          matched?.typeId ?? defaultType?.id ?? null,
        );
        setBulkCategoryId(null);
        setItems(
          draft.items.map((item, itemIndex) => {
            const suggestedCategoryId = item.categoryName
              ? categoriesByName.get(
                  normalizeCategoryName(item.categoryName),
                )
              : null;
            return {
              amountCents: item.lineTotalCents,
              amountInput: centsToInput(item.lineTotalCents),
              categoryId: suggestedCategoryId ?? uncategorized.id,
              description: item.name,
              id: itemIndex,
              included: true,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              vatLabel: item.vatLabel,
            };
          }),
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
  const validIncludedItems = useMemo(
    () =>
      includedItems.filter(
        (item): item is ReviewItem & { amountCents: number } =>
          item.amountCents !== null,
      ),
    [includedItems],
  );
  const includedTotal = includedReviewTotal(items);
  const hasInvalidIncludedAmounts =
    validIncludedItems.length !== includedItems.length;

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

  const totalsMismatch = reviewTotalsMismatch(
    includedTotal,
    draft.totalCents,
  );

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

  const updateItemDescription = (index: number, description: string) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, description } : item,
      ),
    );
  };

  const updateItemAmount = (index: number, amountInput: string) => {
    const amountCents = parseReviewAmountInput(amountInput);
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, amountCents, amountInput }
          : item,
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
    if (hasInvalidIncludedAmounts) {
      setErrorMessage('Исправьте суммы включённых позиций.');
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
        expenses: validIncludedItems.map((item) => ({
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
              {parsedReceiptDate(draft)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Итого в чеке</Text>
            <Text style={styles.summaryValue}>
              {formatMoney(draft.totalCents)} {draft.currency}
            </Text>
          </View>
          {draft.paymentType ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Оплата</Text>
              <Text style={styles.summaryValue}>{draft.paymentType}</Text>
            </View>
          ) : null}
        </View>

        {draft.confidence === 'low' ? (
          <View accessibilityRole="alert" style={styles.warningCard}>
            <Text style={styles.warningText}>
              Распознавание неуверенное. Проверьте чек перед сохранением.
            </Text>
          </View>
        ) : null}

        {totalsMismatch ? (
          <View accessibilityRole="alert" style={styles.warningCard}>
            <Text style={styles.warningText}>
              Сумма выбранных позиций не совпадает с итогом чека.
              Проверьте суммы перед сохранением.
            </Text>
          </View>
        ) : null}

        {!isCurrency(draft.currency) ? (
          <View accessibilityRole="alert" style={styles.warningCard}>
            <Text style={styles.warningText}>
              Для {draft.currency} пока нет конвертации. Сохраним исходные
              суммы и отметим позиции как требующие внимания.
            </Text>
          </View>
        ) : null}

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
              key={item.id}
              style={[
                styles.itemCard,
                !item.included && styles.itemCardExcluded,
              ]}
            >
              <TextInput
                accessibilityLabel={`Название позиции ${index + 1}`}
                autoCapitalize="sentences"
                editable={!saving}
                maxLength={240}
                multiline={false}
                onChangeText={(description) =>
                  updateItemDescription(index, description)
                }
                placeholder="Название позиции"
                placeholderTextColor={theme.colors.disabled}
                style={[
                  styles.itemNameInput,
                  !item.included && styles.excludedText,
                ]}
                value={item.description}
              />
              <View style={styles.itemDetailsRow}>
                <Text style={styles.itemDetails}>
                  {item.quantity !== null && item.unitPriceCents !== null
                    ? `${item.quantity} × ${formatMoney(item.unitPriceCents)} ${draft.currency}`
                    : 'Количество или цена за единицу не указаны'}
                  {item.vatLabel ? ` · НДС ${item.vatLabel}` : ''}
                </Text>
                <View style={styles.itemAmountColumn}>
                  <View style={styles.itemAmountEditor}>
                    <TextInput
                      accessibilityLabel={`Сумма позиции ${index + 1}`}
                      editable={!saving}
                      inputMode="decimal"
                      maxLength={20}
                      onChangeText={(amountInput) =>
                        updateItemAmount(index, amountInput)
                      }
                      placeholder="0,00"
                      placeholderTextColor={theme.colors.disabled}
                      selectTextOnFocus
                      style={[
                        styles.itemAmountInput,
                        item.amountCents === null &&
                          styles.itemAmountInputInvalid,
                        !item.included && styles.excludedText,
                      ]}
                      value={item.amountInput}
                    />
                    <Text
                      style={[
                        styles.itemCurrency,
                        !item.included && styles.excludedText,
                      ]}
                    >
                      {draft.currency}
                    </Text>
                  </View>
                  {item.amountCents === null ? (
                    <Text
                      accessibilityRole="alert"
                      style={styles.itemValidationText}
                    >
                      Введите сумму больше нуля
                    </Text>
                  ) : null}
                </View>
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
            {includedTotal === null
              ? `— ${draft.currency}`
              : `${formatMoney(includedTotal)} ${draft.currency}`}
          </Text>
        </View>

        {errorMessage ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {errorMessage}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={saving || hasInvalidIncludedAmounts}
          onPress={() => void handleSave()}
          style={({ pressed }) => [
            styles.primaryButton,
            (pressed || saving || hasInvalidIncludedAmounts) &&
              styles.disabled,
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
  itemAmountColumn: {
    alignItems: 'flex-end',
    width: '45%',
  },
  itemAmountEditor: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.xxs,
    width: '100%',
  },
  itemAmountInput: {
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: theme.colors.text,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
    minHeight: theme.sizes.iconButton,
    paddingHorizontal: theme.spacing.xs,
    textAlign: 'right',
  },
  itemAmountInputInvalid: {
    borderColor: theme.colors.danger,
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
  itemCurrency: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  itemDetails: {
    color: theme.colors.textMuted,
    flex: 1,
    fontSize: theme.fontSizes.caption,
  },
  itemDetailsRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  itemNameInput: {
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  itemValidationText: {
    color: theme.colors.danger,
    fontSize: theme.fontSizes.caption,
    marginTop: theme.spacing.xxs,
    textAlign: 'right',
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
  warningCard: {
    backgroundColor: theme.colors.accentMuted,
    borderRadius: theme.radii.card,
    padding: theme.spacing.md,
  },
  warningText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
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
