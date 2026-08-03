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
import { router, useLocalSearchParams } from 'expo-router';

import { CategoryPicker } from '../../../components/CategoryPicker';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { DatePicker } from '../../../components/DatePicker';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { MerchantPicker } from '../../../components/MerchantPicker';
import { useReceiptDraft } from '../../../contexts/ReceiptDraftContext';
import {
  getFiscalReceiptForEdit,
  listCategories,
  listMerchants,
  listMerchantTypes,
  saveFiscalReceipt,
  updateFiscalReceipt,
  type Category,
  type FiscalReceiptEditDraft,
  type FiscalReceiptMerchantInput,
  type Merchant,
  type MerchantType,
} from '../../../lib/db';
import { formatLongDate, parseLocalISO } from '../../../lib/dates';
import {
  centsToInput,
  formatMoney,
  isCurrency,
  parseAmountInput,
} from '../../../lib/money';
import {
  learnItemCategoryRules,
  resolveCategoriesForItems,
} from '../../../lib/itemCategorization';
import {
  findMatchingMerchant,
  parsedReceiptDate,
} from '../../../lib/receipts';
import { theme } from '../../../lib/theme';

type MerchantMode = 'existing' | 'new';

type ReviewItem = {
  amountCents: number | null;
  amountInput: string;
  categoryEdited: boolean;
  categoryId: string;
  description: string;
  descriptionEdited: boolean;
  expenseId: string | null;
  id: number | string;
  included: boolean;
  inclusionEdited: boolean;
  quantity: number | null;
  rawName: string;
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

function routeParam(
  value: string | string[] | undefined,
): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || null;
}

export default function ReviewReceiptScreen() {
  const { draft, clearDraft } = useReceiptDraft();
  const params = useLocalSearchParams<{
    receiptId?: string | string[];
  }>();
  const editReceiptId = routeParam(params.receiptId);
  const isEditMode = editReceiptId !== null;
  const [editDraft, setEditDraft] =
    useState<FiscalReceiptEditDraft | null>(null);
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
  const [occurredOn, setOccurredOn] = useState('');
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [categorizing, setCategorizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isEditMode && !draft) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setCategorizing(false);
    setEditDraft(null);
    setErrorMessage('');
    setItems([]);
    setBulkCategoryId(null);

    void Promise.all([
      listCategories(),
      listMerchants(),
      listMerchantTypes(),
      editReceiptId
        ? getFiscalReceiptForEdit(editReceiptId)
        : Promise.resolve(null),
    ]).then(
      ([
        loadedCategories,
        loadedMerchants,
        loadedTypes,
        loadedEditDraft,
      ]) => {
        if (!active) {
          return;
        }
        const uncategorized = loadedCategories.find(
          (category) => category.slug === 'uncategorized',
        );
        if (!uncategorized) {
          throw new Error('Категория «Не распознано» не найдена.');
        }
        const defaultType =
          loadedTypes.find((type) => type.slug === 'shop') ??
          loadedTypes[0] ??
          null;

        setCategories(loadedCategories);
        setMerchants(loadedMerchants);
        setMerchantTypes(loadedTypes);
        setBulkCategoryId(null);

        if (isEditMode) {
          if (!loadedEditDraft) {
            throw new Error('Покупка не найдена.');
          }

          setEditDraft(loadedEditDraft);
          setMerchantMode(
            loadedEditDraft.merchantId ? 'existing' : 'new',
          );
          setMerchantId(loadedEditDraft.merchantId);
          setMerchantName(loadedEditDraft.merchantName);
          setMerchantTypeId(
            loadedEditDraft.merchantTypeId ?? defaultType?.id ?? null,
          );
          setOccurredOn(loadedEditDraft.occurredOn);
          setItems(
            loadedEditDraft.items.map((item) => ({
              amountCents: item.amountCents,
              amountInput: centsToInput(item.amountCents),
              categoryEdited: false,
              categoryId: item.categoryId,
              description: item.description,
              descriptionEdited: false,
              expenseId: item.id,
              id: item.id,
              included: true,
              inclusionEdited: false,
              quantity: null,
              rawName: item.rawName,
              unitPriceCents: null,
              vatLabel: null,
            })),
          );
          return;
        }

        if (!draft) {
          throw new Error('Чек не найден.');
        }

        setEditDraft(null);
        const matched = findMatchingMerchant(
          loadedMerchants,
          draft.merchantName,
        );
        const scanDefaultType =
          loadedTypes.find(
            (type) => type.slug === draft.merchantTypeSlug,
          ) ?? defaultType;
        const categoriesByName = new Map(
          loadedCategories.map((category) => [
            normalizeCategoryName(category.name),
            category.id,
          ]),
        );

        setMerchantMode(matched ? 'existing' : 'new');
        setMerchantId(matched?.id ?? null);
        setMerchantName(draft.merchantName);
        setMerchantTypeId(
          matched?.typeId ?? scanDefaultType?.id ?? null,
        );
        setOccurredOn(parsedReceiptDate(draft));
        const preparedItems = draft.items.map((item, itemIndex) => {
          const suggestedCategoryId = item.categoryName
            ? categoriesByName.get(
                normalizeCategoryName(item.categoryName),
              )
            : null;
          return {
            amountCents: item.lineTotalCents,
            amountInput: centsToInput(item.lineTotalCents),
            categoryEdited: false,
            categoryId: suggestedCategoryId ?? uncategorized.id,
            description: item.name,
            descriptionEdited: false,
            expenseId: null,
            id: itemIndex,
            included: true,
            inclusionEdited: false,
            quantity: item.quantity,
            rawName: item.rawName?.trim() || item.name,
            unitPriceCents: item.unitPriceCents,
            vatLabel: item.vatLabel,
          };
        });
        setItems(preparedItems);
        setCategorizing(true);
        void resolveCategoriesForItems(
          preparedItems.map(({ rawName }) => ({ name: rawName })),
          loadedCategories,
        )
          .then((resolutions) => {
            if (!active) {
              return;
            }
            setItems((current) =>
              current.map((item, index) => {
                const resolution = resolutions[index];
                if (!resolution) {
                  return item;
                }
                return {
                  ...item,
                  categoryId: item.categoryEdited
                    ? item.categoryId
                    : resolution.categoryId,
                  description: item.descriptionEdited
                    ? item.description
                    : resolution.displayName,
                  included: item.inclusionEdited
                    ? item.included
                    : !resolution.excluded,
                };
              }),
            );
          })
          .catch(() => {
            console.error('Unable to resolve receipt item categories.');
          })
          .finally(() => {
            if (active) {
              setCategorizing(false);
            }
          });
      },
    )
      .catch((error: unknown) => {
        console.error('Unable to prepare receipt review:', error);
        if (active) {
          setErrorMessage(
            error instanceof Error && error.message
              ? error.message
              : 'Не удалось подготовить чек. Попробуйте ещё раз.',
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
  }, [draft, editReceiptId, isEditMode]);

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

  if (loading) {
    return <LoadingScreen />;
  }

  const reviewAvailable = isEditMode ? editDraft !== null : draft !== null;
  if (!reviewAvailable) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.stateTitle}>
          {errorMessage ||
            (isEditMode ? 'Покупка не найдена' : 'Чек не найден')}
        </Text>
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

  const receiptCurrency = editDraft?.currency ?? draft?.currency ?? '';
  const receiptTotalCents =
    editDraft?.totalCents ?? draft?.totalCents ?? 0;
  const receiptPaymentType =
    editDraft?.paymentType ?? draft?.paymentType ?? null;

  const totalsMismatch = reviewTotalsMismatch(
    includedTotal,
    receiptTotalCents,
  );

  const applyCategoryToAll = (categoryId: string) => {
    setBulkCategoryId(categoryId);
    setItems((current) =>
      current.map((item) => ({
        ...item,
        categoryEdited: true,
        categoryId,
      })),
    );
  };

  const updateItemCategory = (index: number, categoryId: string) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, categoryEdited: true, categoryId }
          : item,
      ),
    );
  };

  const updateItemDescription = (index: number, description: string) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, description, descriptionEdited: true }
          : item,
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
          ? {
              ...item,
              included: !item.included,
              inclusionEdited: true,
            }
          : item,
      ),
    );
  };

  const saveReview = async (allowEmptyEdit: boolean) => {
    setErrorMessage('');
    if (!includedItems.length && !allowEmptyEdit) {
      setErrorMessage('Оставьте хотя бы одну позицию чека.');
      return;
    }
    if (hasInvalidIncludedAmounts) {
      setErrorMessage('Исправьте суммы включённых позиций.');
      return;
    }
    if (!parseLocalISO(occurredOn)) {
      setErrorMessage('Выберите корректную дату покупки.');
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
    if (!merchant && includedItems.length > 0) {
      setErrorMessage(
        merchantMode === 'existing'
          ? 'Выберите существующее место.'
          : 'Укажите название и тип нового места.',
      );
      return;
    }

    setSaving(true);
    try {
      let deleted = false;
      if (isEditMode) {
        if (!editReceiptId) {
          throw new Error('Покупка не найдена.');
        }
        const result = await updateFiscalReceipt(editReceiptId, {
          merchant,
          occurredOn,
          expenses: items.map((item) => {
            if (!item.expenseId) {
              throw new Error('Позиция покупки не найдена.');
            }
            return {
              id: item.expenseId,
              amountCents: item.amountCents,
              categoryId: item.categoryId,
              description: item.description.trim() || item.rawName,
              rawName: item.rawName,
              included: item.included,
            };
          }),
        });
        deleted = result.deleted;
      } else {
        if (!draft || !merchant) {
          throw new Error('Чек не найден.');
        }
        await saveFiscalReceipt({
          receipt: draft,
          merchant,
          expenses: validIncludedItems.map((item) => ({
            amountCents: item.amountCents,
            categoryId: item.categoryId,
            description: item.description.trim() || item.rawName,
            rawName: item.rawName,
          })),
        });
      }
      try {
        await learnItemCategoryRules(
          items.map((item) => ({
            rawName: item.rawName,
            displayName: item.description.trim() || item.rawName,
            categoryId: item.included ? item.categoryId : null,
            excluded: !item.included,
          })),
        );
      } catch {
        console.error('Unable to learn receipt item categories.');
      }
      if (!isEditMode) {
        clearDraft();
      }
      if (isEditMode) {
        const homeMonth = deleted
          ? editDraft?.occurredOn.slice(0, 7)
          : occurredOn.slice(0, 7);
        router.replace(
          homeMonth ? `/(app)?month=${homeMonth}` : '/(app)',
        );
      } else {
        router.replace('/(app)');
      }
    } catch (error: unknown) {
      console.error('Unable to save receipt review:', error);
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : isEditMode
            ? 'Не удалось сохранить изменения. Попробуйте ещё раз.'
            : 'Не удалось сохранить чек. Попробуйте ещё раз.',
      );
    } finally {
      setSaving(false);
      setConfirmDeleteAll(false);
    }
  };

  const handleSave = async () => {
    if (isEditMode && includedItems.length === 0) {
      setConfirmDeleteAll(true);
      return;
    }
    await saveReview(false);
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
        <Text style={styles.title}>
          {isEditMode ? 'Редактировать покупку' : 'Проверить чек'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Дата</Text>
            {isEditMode ? (
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => setDatePickerVisible(true)}
                style={({ pressed }) => [
                  styles.dateSelector,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.dateSelectorText}>
                  {formatLongDate(occurredOn)}
                </Text>
                <Text style={styles.dateSelectorChevron}>›</Text>
              </Pressable>
            ) : (
              <Text style={styles.summaryValue}>{occurredOn}</Text>
            )}
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Итого в чеке</Text>
            <Text style={styles.summaryValue}>
              {formatMoney(receiptTotalCents)} {receiptCurrency}
            </Text>
          </View>
          {receiptPaymentType ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Оплата</Text>
              <Text style={styles.summaryValue}>
                {receiptPaymentType}
              </Text>
            </View>
          ) : null}
        </View>

        {!isEditMode && draft?.confidence === 'low' ? (
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

        {!isCurrency(receiptCurrency) ? (
          <View accessibilityRole="alert" style={styles.warningCard}>
            <Text style={styles.warningText}>
              Для {receiptCurrency} пока нет конвертации. Сохраним исходные
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
          {categorizing ? (
            <View style={styles.categorizingState}>
              <ActivityIndicator color={theme.colors.accent} size="small" />
              <Text style={styles.categorizingText}>
                Категоризируем позиции…
              </Text>
            </View>
          ) : null}
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
              {item.rawName.trim() &&
              item.rawName.trim() !== item.description.trim() ? (
                <Text numberOfLines={2} style={styles.itemRawName}>
                  В чеке: {item.rawName}
                </Text>
              ) : null}
              <View style={styles.itemDetailsRow}>
                <Text style={styles.itemDetails}>
                  {item.quantity !== null && item.unitPriceCents !== null
                    ? `${item.quantity} × ${formatMoney(item.unitPriceCents)} ${receiptCurrency}`
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
                      {receiptCurrency}
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
              ? `— ${receiptCurrency}`
              : `${formatMoney(includedTotal)} ${receiptCurrency}`}
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
            <Text style={styles.primaryButtonText}>
              {isEditMode ? 'Сохранить изменения' : 'Сохранить чек'}
            </Text>
          )}
        </Pressable>
      </ScrollView>

      {isEditMode && parseLocalISO(occurredOn) ? (
        <DatePicker
          onChange={setOccurredOn}
          onClose={() => setDatePickerVisible(false)}
          value={occurredOn}
          visible={datePickerVisible}
        />
      ) : null}

      <ConfirmDialog
        confirming={saving}
        onCancel={() => {
          if (!saving) {
            setConfirmDeleteAll(false);
          }
        }}
        onConfirm={() => void saveReview(true)}
        title="Удалить покупку со всеми позициями?"
        visible={isEditMode && confirmDeleteAll}
      />
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
  categorizingState: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  categorizingText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.caption,
  },
  content: {
    alignSelf: 'center',
    gap: theme.spacing.lg,
    maxWidth: theme.sizes.maxContentWidth,
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
    width: '100%',
  },
  dateSelector: {
    alignItems: 'center',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    flexDirection: 'row',
    gap: theme.spacing.xs,
    minHeight: theme.sizes.iconButton,
    paddingHorizontal: theme.spacing.sm,
  },
  dateSelectorChevron: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.title,
  },
  dateSelectorText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
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
  itemRawName: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.small,
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
