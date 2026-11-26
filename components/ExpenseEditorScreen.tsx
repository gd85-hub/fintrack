import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../contexts/AuthContext';
import { useHomeCurrency } from '../contexts/HomeCurrencyContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useColors } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import {
  anchorRateForExpense,
  AnchorRateUnavailableError,
} from '../lib/anchorRates';
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
import {
  readLastManualCurrency,
  rememberLastManualCurrency,
} from '../lib/lastCurrency';
import { RateUnavailableError, ratesForExpense } from '../lib/fx';
import { isSupportedHomeCurrency } from '../lib/homeCurrency';
import {
  centsToInput,
  convertAll,
  type ConvertedAmounts,
  formatMoney,
  isCurrency,
  parseAmountInput,
  roundHalfUp,
} from '../lib/money';
import { theme, type Colors } from '../lib/theme';
import { CategoryPicker } from './CategoryPicker';
import { ConfirmDialog } from './ConfirmDialog';
import { DatePicker } from './DatePicker';
import { Button } from './ds/Button';
import { FieldError } from './ds/FieldError';
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
  // Currency a new form opens with (last manual currency or home currency),
  // resolved before the form mounts. Ignored when editing an existing expense.
  initialCurrency: string;
  // Account the saved currency is remembered under; null when signed out.
  accountId: string | null;
  // Called with the currency of a just-created manual expense, so the still
  // mounted screen can reopen in it without waiting for the AsyncStorage write.
  onManualCurrencySaved?: (currency: string) => void;
};

type ConversionPreview =
  | { kind: 'anchor'; eurCents: number }
  | { kind: 'legacy'; amounts: ConvertedAmounts };

function useExpenseEditorTheme() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  return { colors, styles };
}

function ExpenseForm({
  initialExpense,
  categories,
  initialMerchants,
  initialCurrency,
  accountId,
  onManualCurrencySaved,
}: ExpenseFormProps) {
  const router = useRouter();
  const { locale, t } = useLanguage();
  const toast = useToast();
  const { colors, styles } = useExpenseEditorTheme();
  const [amount, setAmount] = useState(
    initialExpense ? centsToInput(initialExpense.originalAmountCents) : '',
  );
  const [currency, setCurrency] = useState(
    initialExpense?.originalCurrency ?? initialCurrency,
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
  const [preview, setPreview] = useState<ConversionPreview | null>(null);
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
  const legacyCurrency = isCurrency(currency) ? currency : null;
  const isCoveredAuto =
    legacyCurrency === null && isSupportedHomeCurrency(currency);
  const isAutomatic = legacyCurrency !== null || isCoveredAuto;
  const hasInvalidManualRsd =
    !isAutomatic &&
    manualRsdInput.trim() !== '' &&
    (parsedManualRsd === null || parsedManualRsd <= 0);
  // Same rule as before, split in two: what the form says, and whether a
  // save is already running. The button shows those as different states.
  const formValid =
    validAmount && validDate && categoryId !== null && !hasInvalidManualRsd;
  const canSave = formValid && !saving;

  useEffect(() => {
    let active = true;

    if (
      !isAutomatic ||
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
      void (async () => {
        if (legacyCurrency) {
          const rates = await ratesForExpense(date);
          if (active) {
            setPreview({
              kind: 'legacy',
              amounts: convertAll(
                parsedAmount,
                legacyCurrency,
                rates.usdRsd,
                rates.eurRsd,
              ),
            });
          }
          return;
        }

        const anchorRate = await anchorRateForExpense(currency, date);
        if (active) {
          setPreview({
            kind: 'anchor',
            eurCents: roundHalfUp(parsedAmount / anchorRate.ratePerEur),
          });
        }
      })()
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
    currency,
    date,
    isAutomatic,
    legacyCurrency,
    parsedAmount,
    retryKey,
    t,
    validAmount,
    validDate,
  ]);

  function handleCurrencyChange(nextCurrency: string) {
    setCurrency(nextCurrency);
    if (
      isCurrency(nextCurrency) ||
      isSupportedHomeCurrency(nextCurrency)
    ) {
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
      manualRsdCents: isAutomatic ? null : parsedManualRsd,
    };

    setSaving(true);
    setFormError('');

    try {
      if (initialExpense) {
        await updateExpense(initialExpense.id, input);
      } else {
        await insertExpense(input);
        // Remember the currency only after a successful manual creation. The
        // in-memory notify is synchronous, so an immediate reopen of the still
        // mounted screen sees it even before the write lands; the write is
        // fire-and-forget and swallows its own errors, so a storage failure
        // never turns a saved expense into a failed save.
        onManualCurrencySaved?.(currency);
        void rememberLastManualCurrency(accountId, currency);
      }
      toast.success(
        t(initialExpense ? 'toast.changesSaved' : 'toast.expenseSaved'),
      );
      router.back();
    } catch (error: unknown) {
      console.error('Unable to save expense:', error);
      toast.error(
        error instanceof RateUnavailableError ||
          error instanceof AnchorRateUnavailableError
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
      toast.success(t('toast.expenseDeleted'));
      setDeleteVisible(false);
      router.back();
    } catch (error: unknown) {
      console.error('Unable to delete expense:', error);
      setDeleteVisible(false);
      setDeleting(false);
      toast.error(t('editor.deleteFailed'));
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

        {!isAutomatic ? (
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
            <FieldError
              message={
                hasInvalidManualRsd
                  ? t('review.amountAboveZero')
                  : null
              }
            />
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

        {preview?.kind === 'legacy' ? (
          <Text style={styles.preview}>
            ≈ {formatMoney(preview.amounts.rsd)} RSD ·{' '}
            {formatMoney(preview.amounts.eur)} EUR ·{' '}
            {formatMoney(preview.amounts.usd)} USD
          </Text>
        ) : null}

        {preview?.kind === 'anchor' ? (
          <Text style={styles.preview}>
            ≈ {formatMoney(preview.eurCents)} EUR
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

        {/* An incomplete form is Disabled; a save in flight is Loading. The
            guards at the top of handleSave are unchanged and still cover
            both. */}
        <Button
          accessibilityLabel={saving ? t('common.saving') : t('common.save')}
          disabled={!formValid}
          fullWidth
          label={t('common.save')}
          loading={saving}
          onPress={() => void handleSave()}
          size="medium"
          variant="primary"
        />

        {initialExpense ? (
          <Button
            fullWidth
            label={t('common.delete')}
            onPress={() => setDeleteVisible(true)}
            size="medium"
            variant="danger"
          />
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
  const { user } = useAuth();
  const { homeCurrency } = useHomeCurrency();
  const accountId = user?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [expense, setExpense] = useState<Expense | null>(null);
  // The currency a new form opens with, resolved per focus (below).
  const [initialCurrency, setInitialCurrency] = useState(homeCurrency);
  const [focusKey, setFocusKey] = useState(0);
  // The focus session `initialCurrency` was resolved for. The form is gated on
  // this matching the current focusKey, so a just-focused screen never shows a
  // form carrying currency from an earlier visit.
  const [currencyResolvedFocus, setCurrencyResolvedFocus] = useState(-1);
  // The currency of an expense created during this mounted session. Preferred
  // over storage so an immediate reopen cannot race the pending AsyncStorage
  // write and restore an older value.
  const sessionCurrencyRef = useRef<string | null>(null);
  // Guards the async currency read: only the latest focus session may apply.
  const currencySessionRef = useRef(0);

  const handleManualCurrencySaved = useCallback((saved: string) => {
    sessionCurrencyRef.current = saved;
  }, []);

  useFocusEffect(
    useCallback(() => {
      setFocusKey((key) => key + 1);
    }, []),
  );

  // Categories, merchants and the edited expense are loaded once (and when the
  // account or target expense changes) — never re-fetched merely to refresh the
  // currency on a later focus.
  useEffect(() => {
    let active = true;

    void Promise.all([
      listCategories(),
      listMerchants(),
      expenseId ? getExpense(expenseId) : Promise.resolve(null),
    ])
      .then(([loadedCategories, loadedMerchants, loadedExpense]) => {
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
      })
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

  // Resolve the remembered currency for every new-expense focus, before the
  // form is shown. Editing keeps the expense's own currency and reads nothing.
  useEffect(() => {
    if (expenseId) {
      return;
    }

    const session = currencySessionRef.current + 1;
    currencySessionRef.current = session;
    const focus = focusKey;
    let active = true;

    void (async () => {
      const remembered =
        sessionCurrencyRef.current ??
        (await readLastManualCurrency(accountId));
      // Drop a response from a focus session that a newer one has superseded.
      if (!active || session !== currencySessionRef.current) {
        return;
      }
      setInitialCurrency(remembered ?? homeCurrency);
      setCurrencyResolvedFocus(focus);
    })();

    return () => {
      active = false;
    };
  }, [accountId, expenseId, focusKey, homeCurrency]);

  // A new form is ready only once its currency is resolved for this focus.
  const currencyReady =
    expenseId !== undefined || currencyResolvedFocus === focusKey;

  if (loading) {
    return <LoadingScreen />;
  }

  if (errorMessage) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{errorMessage}</Text>
        {/* The button hugs its label and stays in the middle. Button sets
            alignSelf itself, which would beat the container's alignItems,
            so the row centres it instead. */}
        <View style={styles.centeredAction}>
          <Button
            label={t('common.back')}
            onPress={() => router.back()}
            size="medium"
            variant="surface"
          />
        </View>
      </View>
    );
  }

  // Data is loaded and valid, but a new form still waits for its currency so it
  // never renders with a currency carried over from an earlier focus.
  if (!currencyReady) {
    return <LoadingScreen />;
  }

  return (
    <ExpenseForm
      accountId={accountId}
      categories={categories}
      initialCurrency={initialCurrency}
      initialExpense={expense}
      initialMerchants={merchants}
      key={focusKey}
      onManualCurrencySaved={handleManualCurrencySaved}
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
  // A row, so justifyContent centres the button horizontally: in a column
  // the button's own alignSelf would decide instead.
  centeredAction: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  content: {
    alignSelf: 'center',
    gap: theme.spacing.lg,
    maxWidth: theme.sizes.maxContentWidth,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    width: '100%',
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
  screen: {
    backgroundColor: c.bg.base,
    flex: 1,
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
