import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  deleteExpense,
  getExpense,
  insertExpense,
  listCategories,
  listMerchants,
  listMerchantTypes,
  type Category,
  type Expense,
  type ExpenseInput,
  type Merchant,
  type MerchantType,
  updateExpense,
} from '../lib/db';
import { parseLocalISO, todayLocalISO } from '../lib/dates';
import { RateUnavailableError, ratesForExpense } from '../lib/fx';
import {
  centsToInput,
  convertAll,
  type ConvertedAmounts,
  type Currency,
  formatMoney,
  parseAmountInput,
} from '../lib/money';
import { theme } from '../lib/theme';
import { CategoryPicker } from './CategoryPicker';
import { ConfirmDialog } from './ConfirmDialog';
import { CurrencySelector } from './CurrencySelector';
import { DatePicker } from './DatePicker';
import { LoadingScreen } from './LoadingScreen';
import { MerchantPicker } from './MerchantPicker';

type ExpenseEditorScreenProps = {
  expenseId?: string;
};

type ExpenseFormProps = {
  initialExpense: Expense | null;
  categories: Category[];
  initialMerchants: Merchant[];
  merchantTypes: MerchantType[];
};

const RATE_ERROR =
  'Не удалось загрузить курсы валют. Проверьте интернет и попробуйте ещё раз.';

function ExpenseForm({
  initialExpense,
  categories,
  initialMerchants,
  merchantTypes,
}: ExpenseFormProps) {
  const router = useRouter();
  const [amount, setAmount] = useState(
    initialExpense ? centsToInput(initialExpense.originalAmountCents) : '',
  );
  const [currency, setCurrency] = useState<Currency>(
    initialExpense?.originalCurrency ?? 'RSD',
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
  const validAmount = parsedAmount !== null && parsedAmount > 0;
  const validDate = parseLocalISO(date) !== null;
  const canSave = validAmount && validDate && categoryId !== null && !saving;

  useEffect(() => {
    let active = true;

    if (!validAmount || !validDate || parsedAmount === null) {
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
                currency,
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
            setRateError(RATE_ERROR);
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
  }, [currency, date, parsedAmount, retryKey, validAmount, validDate]);

  function handleMerchantCreated(merchant: Merchant) {
    setMerchants((current) =>
      [...current, merchant].sort((left, right) =>
        left.name.localeCompare(right.name, 'ru'),
      ),
    );
  }

  async function handleSave() {
    if (!validAmount || parsedAmount === null) {
      setFormError('Введите сумму больше нуля.');
      return;
    }

    if (!categoryId) {
      setFormError('Выберите категорию.');
      return;
    }

    if (!validDate) {
      setFormError('Выберите корректную дату.');
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
          ? RATE_ERROR
          : 'Не удалось сохранить трату. Попробуйте ещё раз.',
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
      setFormError('Не удалось удалить трату. Попробуйте ещё раз.');
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Назад"
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
          {initialExpense ? 'Редактировать трату' : 'Новая трата'}
        </Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.amountField}>
          <Text style={styles.label}>Сумма</Text>
          <TextInput
            autoFocus={!initialExpense}
            inputMode="decimal"
            maxLength={20}
            onChangeText={setAmount}
            placeholder="0,00"
            placeholderTextColor={theme.colors.disabled}
            selectTextOnFocus
            style={styles.amountInput}
            value={amount}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Валюта</Text>
          <CurrencySelector
            accessibilityLabel="Валюта траты"
            onChange={setCurrency}
            value={currency}
          />
        </View>

        <CategoryPicker
          categories={categories}
          onChange={setCategoryId}
          value={categoryId}
        />

        <MerchantPicker
          merchantTypes={merchantTypes}
          merchants={merchants}
          onChange={setMerchantId}
          onCreated={handleMerchantCreated}
          value={merchantId}
        />

        <View style={styles.field}>
          <Text style={styles.label}>Дата</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDatePickerVisible(true)}
            style={({ pressed }) => [
              styles.selector,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.selectorText}>{date}</Text>
            <Text style={styles.selectorChevron}>›</Text>
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Описание</Text>
          <TextInput
            maxLength={120}
            onChangeText={setDescription}
            placeholder="Например, ужин"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
            value={description}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Заметка</Text>
          <TextInput
            maxLength={500}
            multiline
            onChangeText={setNote}
            placeholder="Необязательно"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.input, styles.multilineInput]}
            textAlignVertical="top"
            value={note}
          />
        </View>

        {previewLoading ? (
          <Text style={styles.previewMuted}>Загружаем курсы…</Text>
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
              <Text style={styles.retryText}>Повторить</Text>
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
            {saving ? 'Сохранение…' : 'Сохранить'}
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
            <Text style={styles.deleteButtonText}>Удалить</Text>
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
        title="Удалить эту трату?"
        visible={deleteVisible}
      />
    </KeyboardAvoidingView>
  );
}

export function ExpenseEditorScreen({
  expenseId,
}: ExpenseEditorScreenProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [merchantTypes, setMerchantTypes] = useState<MerchantType[]>([]);
  const [expense, setExpense] = useState<Expense | null>(null);

  useEffect(() => {
    let active = true;

    void Promise.all([
      listCategories(),
      listMerchants(),
      listMerchantTypes(),
      expenseId ? getExpense(expenseId) : Promise.resolve(null),
    ])
      .then(
        ([
          loadedCategories,
          loadedMerchants,
          loadedMerchantTypes,
          loadedExpense,
        ]) => {
          if (!active) {
            return;
          }

          if (expenseId && !loadedExpense) {
            setErrorMessage('Трата не найдена.');
            return;
          }

          setCategories(loadedCategories);
          setMerchants(loadedMerchants);
          setMerchantTypes(loadedMerchantTypes);
          setExpense(loadedExpense);
        },
      )
      .catch((error: unknown) => {
        console.error('Unable to load expense editor:', error);
        if (active) {
          setErrorMessage('Не удалось загрузить данные. Попробуйте ещё раз.');
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
  }, [expenseId]);

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
          <Text style={styles.secondaryActionText}>Назад</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ExpenseForm
      categories={categories}
      initialExpense={expense}
      initialMerchants={merchants}
      merchantTypes={merchantTypes}
    />
  );
}

const styles = StyleSheet.create({
  amountField: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  amountInput: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.amount,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  centered: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
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
    backgroundColor: theme.colors.dangerMuted,
    borderRadius: theme.radii.button,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
  },
  deleteButtonText: {
    color: theme.colors.danger,
    fontSize: theme.fontSizes.button,
    fontWeight: '600',
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.fontSizes.caption,
  },
  field: {
    gap: theme.spacing.xs,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: theme.colors.border,
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
    color: theme.colors.text,
    fontSize: theme.fontSizes.title,
  },
  inlineError: {
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
    paddingVertical: theme.spacing.sm,
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  multilineInput: {
    minHeight: theme.sizes.multilineInputHeight,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  preview: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.label,
    textAlign: 'center',
  },
  previewMuted: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.label,
    textAlign: 'center',
  },
  retryText: {
    color: theme.colors.accent,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.button,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
  },
  saveButtonText: {
    color: theme.colors.white,
    fontSize: theme.fontSizes.button,
    fontWeight: '700',
  },
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.button,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.lg,
  },
  secondaryActionText: {
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
  selectorChevron: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.title,
  },
  selectorText: {
    color: theme.colors.text,
    flex: 1,
    fontSize: theme.fontSizes.body,
  },
  title: {
    color: theme.colors.text,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
    textAlign: 'center',
  },
});
