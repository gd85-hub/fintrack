import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
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
  deleteExpense,
  getExpense,
  insertExpense,
  listCategories,
  listMerchants,
  type Category,
  type Expense,
  type ExpenseInput,
  type Merchant,
  updateExpense,
} from '../lib/db';
import {
  formatLongDate,
  parseLocalISO,
  todayLocalISO,
} from '../lib/dates';
import { RateUnavailableError, ratesForExpense } from '../lib/fx';
import {
  centsToInput,
  convertAll,
  type ConvertedAmounts,
  formatMoney,
  isCurrency,
  parseAmountInput,
} from '../lib/money';
import { theme, type Colors } from '../lib/theme';
import { CategoryPicker } from './CategoryPicker';
import { ConfirmDialog } from './ConfirmDialog';
import { DatePicker } from './DatePicker';
import { LoadingScreen } from './LoadingScreen';
import { MerchantPicker } from './MerchantPicker';
import { ReceiptCurrencySelector } from './ReceiptCurrencySelector';

type ExpenseEditorScreenProps = {
  expenseId?: string;
};

type ExpenseFormProps = {
  initialExpense: Expense | null;
  categories: Category[];
  initialMerchants: Merchant[];
};

function useExpenseEditorTheme() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  return { colors, styles };
}

function ExpenseForm({
  initialExpense,
  categories,
  initialMerchants,
}: ExpenseFormProps) {
  const router = useRouter();
  const { locale, t } = useLanguage();
  const { colors, styles } = useExpenseEditorTheme();
  const [amount, setAmount] = useState(
    initialExpense ? centsToInput(initialExpense.originalAmountCents) : '',
  );
  const [currency, setCurrency] = useState(
    initialExpense?.originalCurrency ?? 'RSD',
  );
  const [manualRsdInput, setManualRsdInput] = useState(
    initialExpense &&
      !isCurrency(initialExpense.originalCurrency) &&
      initialExpense.amountRsdCents > 0
      ? centsToInput(initialExpense.amountRsdCents)
      : '',
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    initialExpense?.categoryId ?? null,
  );
  const [merchantId, setMerchantId] = useState<string | null>(
    initialExpense?.merchantId ?? null,
  );
  const [merchants, setMerchants] = useState(initialMerchants);
  const [date, setDate] = useState(
    initialExpense?.occurredOn ?? todayLocalISO(),
  );
  const [description, setDescription] = useState(
    initialExpense?.description ?? '',
  );
  const [note, setNote] = useState(initialExpense?.note ?? '');
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [preview, setPreview] = useState<ConvertedAmounts | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [rateError, setRateError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const parsedAmount = parseAmountInput(amount);
  const parsedManualRsd = manualRsdInput.trim()
    ? parseAmountInput(manualRsdInput)
    : null;
  const validAmount = parsedAmount !== null && parsedAmount > 0;
  const validDate = parseLocalISO(date) !== null;
  const automaticCurrency = isCurrency(currency) ? currency : null;
  const hasInvalidManualRsd =
    automaticCurrency === null &&
    manualRsdInput.trim() !== '' &&
    (parsedManualRsd === null || parsedManualRsd <= 0);
  const canSave =
    validAmount &&
    validDate &&
    categoryId !== null &&
    !hasInvalidManualRsd &&
    !saving;

  useEffect(() => {
    let active = true;

    if (
      !automaticCurrency ||
      !validAmount ||
      !validDate ||
      parsedAmount === null
    ) {
      setPreview(null);
      setRateError('');
      setPreviewLoading(false);
      return () => {
        active = false;
      };
    }

    setPreviewLoading(true);
    setRateError('');

    const timeout = setTimeout(() => {
      void ratesForExpense(date)
        .then((rates) => {
          if (active) {
            setPreview(
              convertAll(
                parsedAmount,
                automaticCurrency,
                rates.usdRsd,
                rates.eurRsd,
              ),
            );
          }
        })
        .catch((error: unknown) => {
          if (active) {
            console.error('Unable to build conversion preview:', error);
            setPreview(null);
            setRateError(t('editor.ratesLoadFailed'));
          }
        })
        .finally(() => {
          if (active) {
            setPreviewLoading(false);
          }
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [
    automaticCurrency,
    date,
    parsedAmount,
    retryKey,
    t,
    validAmount,
    validDate,
  ]);

  function handleCurrencyChange(nextCurrency: string) {
    setCurrency(nextCurrency);
    if (isCurrency(nextCurrency)) {
      setManualRsdInput('');
    }
  }

  function handleMerchantCreated(merchant: Merchant) {
    setMerchants((current) =>
      [...current, merchant].sort((left, right) =>
        left.name.localeCompare(right.name, 'ru'),
      ),
    );
  }

  async function handleSave() {
    if (!validAmount || parsedAmount === null) {
      setFormError(t('editor.amountAboveZeroError'));
      return;
    }

    if (!categoryId) {
      setFormError(t('editor.selectCategoryError'));
      return;
    }

    if (hasInvalidManualRsd) {
      setFormError(t('editor.validRsdOrEmpty'));
      return;
    }

    if (!validDate) {
      setFormError(t('editor.validDateError'));
      return;
    }

    const input: ExpenseInput = {
      amountCents: parsedAmount,
      currency,
      categoryId,
      merchantId,
      occurredOn: date,
      description,
      note,
      manualRsdCents: automaticCurrency ? null : parsedManualRsd,
    };

    setSaving(true);
    setFormError('');

    try {
      if (initialExpense) {
        await updateExpense(initialExpense.id, input);
      } else {
        await insertExpense(input);
      }
      router.back();
    } catch (error: unknown) {
      console.error('Unable to save expense:', error);
      setFormError(
        error instanceof RateUnavailableError
          ? t('editor.ratesLoadFailed')
          : t('editor.saveFailed'),
      );
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initialExpense) {
      return;
    }

    setDeleting(true);
    setFormError('');

    try {
      await deleteExpense(initialExpense.id);
      setDeleteVisible(false);
      router.back();
    } catch (error: unknown) {
      console.error('Unable to delete expense:', error);
      setDeleteVisible(false);
      setDeleting(false);
      setFormError(t('editor.deleteFailed'));
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={t('common.back')}
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.headerButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>
          {initialExpense ? t('editor.editTitle') : t('editor.newTitle')}
        </Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.amountField}>
          <Text style={styles.label}>{t('common.amount')}</Text>
          <TextInput
            autoFocus={!initialExpense}
            inputMode="decimal"
            maxLength={20}
            onChangeText={setAmount}
            placeholder="0,00"
            placeholderTextColor={colors.field.placeholder}
            selectTextOnFocus
            style={styles.amountInput}
            value={amount}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('common.currency')}</Text>
          <ReceiptCurrencySelector
            disabled={saving}
            label={t('editor.currencyLabel')}
            onChange={handleCurrencyChange}
            value={currency}
          />
        </View>

        {!automaticCurrency ? (
          <View style={styles.field}>
            <Text style={styles.label}>{t('editor.manualRsdLabel')}</Text>
            <View style={styles.manualAmountRow}>
              <TextInput
                accessibilityLabel={t('editor.manualRsdA11y')}
                editable={!saving}
                inputMode="decimal"
                maxLength={20}
                onChangeText={setManualRsdInput}
                placeholder="0,00"
                placeholderTextColor={colors.field.placeholder}
                style={[
                  styles.input,
                  styles.manualAmountInput,
                  hasInvalidManualRsd && styles.invalidInput,
                ]}
                value={manualRsdInput}
              />
              <Text style={styles.manualCurrency}>RSD</Text>
            </View>
            <Text style={styles.helperText}>{t('editor.manualRsdHint')}</Text>
            {hasInvalidManualRsd ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {t('review.amountAboveZero')}
              </Text>
            ) : null}
          </View>
        ) : null}

        <CategoryPicker
          categories={categories}
          onChange={setCategoryId}
          value={categoryId}
        />

        <MerchantPicker
          merchants={merchants}
          onChange={setMerchantId}
          onCreated={handleMerchantCreated}
          value={merchantId}
        />

        <View style={styles.field}>
          <Text style={styles.label}>{t('common.date')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDatePickerVisible(true)}
            style={({ pressed }) => [
              styles.selector,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.selectorText}>
              {formatLongDate(date, locale)}
            </Text>
            <Text style={styles.selectorChevron}>›</Text>
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('common.description')}</Text>
          <TextInput
            maxLength={120}
            onChangeText={setDescription}
            placeholder={t('editor.descriptionPlaceholder')}
            placeholderTextColor={colors.field.placeholder}
            style={styles.input}
            value={description}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('editor.note')}</Text>
          <TextInput
            maxLength={500}
            multiline
            onChangeText={setNote}
            placeholder={t('common.optional')}
            placeholderTextColor={colors.field.placeholder}
            style={[styles.input, styles.multilineInput]}
            textAlignVertical="top"
            value={note}
          />
        </View>

        {previewLoading ? (
          <Text style={styles.previewMuted}>{t('editor.loadingRates')}</Text>
        ) : null}

        {preview ? (
          <Text style={styles.preview}>
            ≈ {formatMoney(preview.rsd)} RSD · {formatMoney(preview.eur)} EUR ·{' '}
            {formatMoney(preview.usd)} USD
          </Text>
        ) : null}

        {rateError ? (
          <View style={styles.inlineError}>
            <Text style={styles.errorText}>{rateError}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setRetryKey((current) => current + 1)}
            >
              <Text style={styles.retryText}>{t('home.retry')}</Text>
            </Pressable>
          </View>
        ) : null}

        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
          disabled={!canSave}
          onPress={() => void handleSave()}
          style={({ pressed }) => [
            styles.saveButton,
            !canSave && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.saveButtonText}>
            {saving ? t('common.saving') : t('common.save')}
          </Text>
        </Pressable>

        {initialExpense ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setDeleteVisible(true)}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.deleteButtonText}>{t('common.delete')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <DatePicker
        onChange={setDate}
        onClose={() => setDatePickerVisible(false)}
        value={date}
        visible={datePickerVisible}
      />

      <ConfirmDialog
        confirming={deleting}
        onCancel={() => setDeleteVisible(false)}
        onConfirm={() => void handleDelete()}
        title={t('editor.deleteConfirmTitle')}
        visible={deleteVisible}
      />
    </KeyboardAvoidingView>
  );
}

export function ExpenseEditorScreen({
  expenseId,
}: ExpenseEditorScreenProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { styles } = useExpenseEditorTheme();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [expense, setExpense] = useState<Expense | null>(null);

  useEffect(() => {
    let active = true;

    void Promise.all([
      listCategories(),
      listMerchants(),
      expenseId ? getExpense(expenseId) : Promise.resolve(null),
    ])
      .then(
        ([
          loadedCategories,
          loadedMerchants,
          loadedExpense,
        ]) => {
          if (!active) {
            return;
          }

          if (expenseId && !loadedExpense) {
            setErrorMessage(t('editor.notFound'));
            return;
          }

          setCategories(loadedCategories);
          setMerchants(loadedMerchants);
          setExpense(loadedExpense);
        },
      )
      .catch((error: unknown) => {
        console.error('Unable to load expense editor:', error);
        if (active) {
          setErrorMessage(t('editor.loadFailed'));
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
  }, [expenseId, t]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (errorMessage) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.secondaryAction,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryActionText}>{t('common.back')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ExpenseForm
      categories={categories}
      initialExpense={expense}
      initialMerchants={merchants}
    />
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  amountField: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  amountInput: {
    color: c.text.primary,
    fontSize: theme.fontSizes.amount,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  centered: {
    alignItems: 'center',
    backgroundColor: c.bg.base,
    flex: 1,
    gap: theme.spacing.md,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  content: {
    alignSelf: 'center',
    gap: theme.spacing.lg,
    maxWidth: theme.sizes.maxContentWidth,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    width: '100%',
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: c.status.error.container,
    borderRadius: theme.radii.button,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
  },
  deleteButtonText: {
    color: c.status.error.content,
    fontSize: theme.fontSizes.button,
    fontWeight: '600',
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
  errorText: {
    color: c.status.error.content,
    fontSize: theme.fontSizes.caption,
  },
  field: {
    gap: theme.spacing.xs,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: c.border.default,
    borderBottomWidth: theme.sizes.border,
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  headerButton: {
    alignItems: 'center',
    height: theme.sizes.iconButton,
    justifyContent: 'center',
    width: theme.sizes.iconButton,
  },
  headerButtonText: {
    color: c.icon.primary,
    fontSize: theme.fontSizes.title,
  },
  helperText: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.caption,
  },
  inlineError: {
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
    paddingVertical: theme.spacing.sm,
  },
  invalidInput: {
    borderColor: c.field.borderError,
  },
  label: {
    color: c.text.primary,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  manualAmountInput: {
    flex: 1,
  },
  manualAmountRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  manualCurrency: {
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  multilineInput: {
    minHeight: theme.sizes.multilineInputHeight,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  preview: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.label,
    textAlign: 'center',
  },
  previewMuted: {
    color: c.text.tertiary,
    fontSize: theme.fontSizes.label,
    textAlign: 'center',
  },
  retryText: {
    color: c.action.link.rest,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: c.action.primary.fill,
    borderRadius: theme.radii.button,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
  },
  saveButtonText: {
    color: c.action.primary.content,
    fontSize: theme.fontSizes.button,
    fontWeight: '700',
  },
  screen: {
    backgroundColor: c.bg.base,
    flex: 1,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: c.action.secondary.fill,
    borderRadius: theme.radii.button,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.lg,
  },
  secondaryActionText: {
    color: c.action.secondary.content,
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
  selectorChevron: {
    color: c.icon.secondary,
    fontSize: theme.fontSizes.title,
  },
  selectorText: {
    color: c.text.primary,
    flex: 1,
    fontSize: theme.fontSizes.body,
  },
  title: {
    color: c.text.primary,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
    textAlign: 'center',
  },
});
