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
import { ReceiptCurrencySelector } from '../../../components/ReceiptCurrencySelector';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useReceiptDraft } from '../../../contexts/ReceiptDraftContext';
import {
  getFiscalReceiptForEdit,
  listCategories,
  listMerchants,
  saveFiscalReceipt,
  updateFiscalReceipt,
  type Category,
  type FiscalReceiptEditDraft,
  type FiscalReceiptMerchantInput,
  type Merchant,
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
  const { t, locale } = useLanguage();
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
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [merchantMode, setMerchantMode] =
    useState<MerchantMode>('new');
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState(
    draft?.merchantName ?? '',
  );
  const [occurredOn, setOccurredOn] = useState('');
  const [receiptCurrency, setReceiptCurrency] = useState(
    draft?.currency ?? 'RSD',
  );
  const [manualRsdInput, setManualRsdInput] = useState('');
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
      editReceiptId
        ? getFiscalReceiptForEdit(editReceiptId)
        : Promise.resolve(null),
    ]).then(
      ([
        loadedCategories,
        loadedMerchants,
        loadedEditDraft,
      ]) => {
        if (!active) {
          return;
        }
        const uncategorized = loadedCategories.find(
          (category) => category.slug === 'uncategorized',
        );
        if (!uncategorized) {
          throw new Error(t('review.uncategorizedMissing'));
        }
        setCategories(loadedCategories);
        setMerchants(loadedMerchants);
        setBulkCategoryId(null);

        if (isEditMode) {
          if (!loadedEditDraft) {
            throw new Error(t('review.purchaseNotFound'));
          }

          setEditDraft(loadedEditDraft);
          setMerchantMode(
            loadedEditDraft.merchantId ? 'existing' : 'new',
          );
          setMerchantId(loadedEditDraft.merchantId);
          setMerchantName(loadedEditDraft.merchantName);
          setOccurredOn(loadedEditDraft.occurredOn);
          setReceiptCurrency(loadedEditDraft.currency);
          setManualRsdInput(
            loadedEditDraft.manualRsdTotalCents === null ||
              loadedEditDraft.manualRsdTotalCents === undefined
              ? ''
              : centsToInput(loadedEditDraft.manualRsdTotalCents),
          );
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
          throw new Error(t('review.receiptNotFound'));
        }

        setEditDraft(null);
        const matched = findMatchingMerchant(
          loadedMerchants,
          draft.merchantName,
        );
        const categoriesByName = new Map(
          loadedCategories.map((category) => [
            normalizeCategoryName(category.name),
            category.id,
          ]),
        );

        setMerchantMode(matched ? 'existing' : 'new');
        setMerchantId(matched?.id ?? null);
        setMerchantName(draft.merchantName);
        setOccurredOn(parsedReceiptDate(draft));
        setReceiptCurrency(draft.currency);
        setManualRsdInput('');
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
              : t('review.prepareFailed'),
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
  const manualRsdTotalCents = manualRsdInput.trim()
    ? parseAmountInput(manualRsdInput)
    : null;
  const hasInvalidManualRsdTotal =
    !isCurrency(receiptCurrency) &&
    manualRsdInput.trim() !== '' &&
    (manualRsdTotalCents === null || manualRsdTotalCents <= 0);

  if (loading) {
    return <LoadingScreen />;
  }

  const reviewAvailable = isEditMode ? editDraft !== null : draft !== null;
  if (!reviewAvailable) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.stateTitle}>
          {errorMessage ||
            (isEditMode
              ? t('review.purchaseNotFound')
              : t('review.receiptNotFound'))}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(app)')}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>{t('review.goHome')}</Text>
        </Pressable>
      </View>
    );
  }

  const receiptTotalCents =
    editDraft?.totalCents ?? draft?.totalCents ?? 0;
  const receiptPaymentType =
    editDraft?.paymentType ?? draft?.paymentType ?? null;
  const receiptMerchantLabel =
    editDraft?.merchantLabel ??
    draft?.merchantLabel ??
    draft?.merchantName ??
    '';
  const selectedMerchantName =
    merchantMode === 'existing'
      ? merchants.find((merchant) => merchant.id === merchantId)?.name ??
        merchantName
      : merchantName;
  const showMerchantLabel =
    receiptMerchantLabel.trim() !== '' &&
    receiptMerchantLabel.trim() !== selectedMerchantName.trim();

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

  const changeReceiptCurrency = (currency: string) => {
    setReceiptCurrency(currency);
    if (isCurrency(currency)) {
      setManualRsdInput('');
    }
  };

  const saveReview = async (allowEmptyEdit: boolean) => {
    setErrorMessage('');
    if (!includedItems.length && !allowEmptyEdit) {
      setErrorMessage(t('review.keepOneItem'));
      return;
    }
    if (hasInvalidIncludedAmounts) {
      setErrorMessage(t('review.fixIncludedAmounts'));
      return;
    }
    if (hasInvalidManualRsdTotal) {
      setErrorMessage(t('review.validTotalOrEmpty'));
      return;
    }
    if (!parseLocalISO(occurredOn)) {
      setErrorMessage(t('review.validDate'));
      return;
    }

    let merchant: FiscalReceiptMerchantInput | null = null;
    if (merchantMode === 'existing' && merchantId) {
      merchant = { existingId: merchantId };
    }
    if (merchantMode === 'new' && merchantName.trim()) {
      merchant = { name: merchantName };
    }
    if (!merchant && includedItems.length > 0) {
      setErrorMessage(
        merchantMode === 'existing'
          ? t('review.pickExistingPlace')
          : t('review.enterNewPlaceName'),
      );
      return;
    }

    setSaving(true);
    try {
      let deleted = false;
      if (isEditMode) {
        if (!editReceiptId) {
          throw new Error(t('review.purchaseNotFound'));
        }
        const result = await updateFiscalReceipt(editReceiptId, {
          merchant,
          merchantLabel: receiptMerchantLabel,
          occurredOn,
          currency: receiptCurrency,
          manualRsdTotalCents,
          expenses: items.map((item) => {
            if (!item.expenseId) {
              throw new Error(t('review.itemNotFound'));
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
          throw new Error(t('review.receiptNotFound'));
        }
        await saveFiscalReceipt({
          receipt: { ...draft, currency: receiptCurrency },
          merchant,
          manualRsdTotalCents,
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
            ? t('review.saveChangesFailed')
            : t('review.saveReceiptFailed'),
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
          accessibilityLabel={t('common.back')}
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
          {isEditMode ? t('home.editPurchase') : t('review.checkTitle')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('common.date')}</Text>
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
                  {formatLongDate(occurredOn, locale)}
                </Text>
                <Text style={styles.dateSelectorChevron}>›</Text>
              </Pressable>
            ) : (
              <Text style={styles.summaryValue}>{occurredOn}</Text>
            )}
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('review.receiptTotal')}</Text>
            <View style={styles.summaryAmount}>
              <Text style={styles.summaryValue}>
                {formatMoney(receiptTotalCents)}
              </Text>
              <ReceiptCurrencySelector
                disabled={saving}
                onChange={changeReceiptCurrency}
                value={receiptCurrency}
              />
            </View>
          </View>
          {receiptPaymentType ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('review.payment')}</Text>
              <Text style={styles.summaryValue}>
                {receiptPaymentType}
              </Text>
            </View>
          ) : null}
        </View>

        {!isEditMode && draft?.confidence === 'low' ? (
          <View accessibilityRole="alert" style={styles.warningCard}>
            <Text style={styles.warningText}>{t('review.lowConfidence')}</Text>
          </View>
        ) : null}

        {totalsMismatch ? (
          <View accessibilityRole="alert" style={styles.warningCard}>
            <Text style={styles.warningText}>
              {t('review.mismatchTitle')} {t('review.mismatchHint')}
            </Text>
          </View>
        ) : null}

        {!isCurrency(receiptCurrency) ? (
          <View style={styles.manualCurrencySection}>
            <View style={styles.manualField}>
              <Text style={styles.label}>{t('review.manualRsdLabel')}</Text>
              <View style={styles.manualInputRow}>
                <TextInput
                  accessibilityLabel={t('review.manualRsdA11y')}
                  editable={!saving}
                  inputMode="decimal"
                  maxLength={20}
                  onChangeText={setManualRsdInput}
                  placeholder="0,00"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[
                    styles.manualInput,
                    hasInvalidManualRsdTotal && styles.itemAmountInputInvalid,
                  ]}
                  value={manualRsdInput}
                />
                <Text style={styles.manualCurrency}>RSD</Text>
              </View>
              <Text style={styles.helperText}>
                {t('review.distributeHint')}
              </Text>
              {hasInvalidManualRsdTotal ? (
                <Text accessibilityRole="alert" style={styles.itemValidationText}>
                  {t('review.amountAboveZero')}
                </Text>
              ) : null}
            </View>
            <View accessibilityRole="alert" style={styles.warningCard}>
              <Text style={styles.warningText}>
                {t('review.noConversionHint', { currency: receiptCurrency })}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('common.place')}</Text>
          {showMerchantLabel ? (
            <Text numberOfLines={2} style={styles.merchantLabel}>
              {t('common.onReceipt', { name: receiptMerchantLabel })}
            </Text>
          ) : null}
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
                {t('review.placeExistingTab')}
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
                {t('review.placeNewTab')}
              </Text>
            </Pressable>
          </View>

          {merchantMode === 'existing' ? (
            <MerchantPicker
              allowCreate={false}
              merchants={merchants}
              onChange={setMerchantId}
              value={merchantId}
            />
          ) : (
            <View style={styles.newMerchant}>
              <Text style={styles.label}>{t('review.newPlaceNameLabel')}</Text>
              <TextInput
                autoCapitalize="words"
                maxLength={80}
                onChangeText={setMerchantName}
                placeholder={t('review.newPlaceNamePlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                value={merchantName}
              />
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('review.itemsCount', {
              included: includedItems.length,
              total: items.length,
            })}
          </Text>
          {categorizing ? (
            <View style={styles.categorizingState}>
              <ActivityIndicator color={theme.colors.accent} size="small" />
              <Text style={styles.categorizingText}>
                {t('review.categorizing')}
              </Text>
            </View>
          ) : null}
          <CategoryPicker
            categories={categories}
            label={t('review.categoryForAll')}
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
                accessibilityLabel={t('review.itemNameA11y', { n: index + 1 })}
                autoCapitalize="sentences"
                editable={!saving}
                maxLength={240}
                multiline={false}
                onChangeText={(description) =>
                  updateItemDescription(index, description)
                }
                placeholder={t('review.itemNamePlaceholder')}
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
                  {t('common.onReceipt', { name: item.rawName })}
                </Text>
              ) : null}
              <View style={styles.itemDetailsRow}>
                <Text style={styles.itemDetails}>
                  {item.quantity !== null && item.unitPriceCents !== null
                    ? `${item.quantity} × ${formatMoney(item.unitPriceCents)} ${receiptCurrency}`
                    : t('review.noQtyOrPrice')}
                  {item.vatLabel
                    ? ` · ${t('review.vat', { label: item.vatLabel })}`
                    : ''}
                </Text>
                <View style={styles.itemAmountColumn}>
                  <View style={styles.itemAmountEditor}>
                    <TextInput
                      accessibilityLabel={t('review.itemAmountA11y', {
                        n: index + 1,
                      })}
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
                      {t('review.amountAboveZero')}
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
                  {item.included
                    ? t('review.excludeItem')
                    : t('review.includeItem')}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.saveSummary}>
          <Text style={styles.saveSummaryLabel}>{t('review.willBeSaved')}</Text>
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
          disabled={
            saving ||
            hasInvalidIncludedAmounts ||
            hasInvalidManualRsdTotal
          }
          onPress={() => void handleSave()}
          style={({ pressed }) => [
            styles.primaryButton,
            (pressed ||
              saving ||
              hasInvalidIncludedAmounts ||
              hasInvalidManualRsdTotal) &&
              styles.disabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator color={theme.colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {isEditMode ? t('review.saveChanges') : t('review.saveReceipt')}
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
        title={t('review.deleteConfirmTitle')}
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
  helperText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.caption,
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
  merchantLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.small,
  },
  manualCurrency: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  manualCurrencySection: {
    gap: theme.spacing.md,
  },
  manualField: {
    gap: theme.spacing.xs,
  },
  manualInput: {
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: theme.colors.text,
    flex: 1,
    fontSize: theme.fontSizes.body,
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.md,
  },
  manualInputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
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
  summaryAmount: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
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
});
