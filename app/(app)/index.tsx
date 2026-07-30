import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type ViewStyle,
  View,
} from 'react-native';

import { CurrencySelector } from '../../components/CurrencySelector';
import { LoadingScreen } from '../../components/LoadingScreen';
import { useAuth } from '../../contexts/AuthContext';
import { useDisplayCurrency } from '../../contexts/DisplayCurrencyContext';
import { listExpensesByMonth, type Expense } from '../../lib/db';
import {
  formatDayHeader,
  formatMonthTitle,
  shiftMonth,
  todayLocalISO,
} from '../../lib/dates';
import { type Currency, formatMoney } from '../../lib/money';
import { theme } from '../../lib/theme';

type ExpenseGroup = {
  date: string;
  expenses: Expense[];
};

function amountForCurrency(expense: Expense, currency: Currency): number {
  if (currency === 'USD') {
    return expense.amountUsdCents;
  }

  if (currency === 'EUR') {
    return expense.amountEurCents;
  }

  return expense.amountRsdCents;
}

function groupExpenses(expenses: Expense[]): ExpenseGroup[] {
  const groups = new Map<string, Expense[]>();

  for (const expense of expenses) {
    const group = groups.get(expense.occurredOn) ?? [];
    group.push(expense);
    groups.set(expense.occurredOn, group);
  }

  return [...groups.entries()].map(([date, groupedExpenses]) => ({
    date,
    expenses: groupedExpenses,
  }));
}

export default function HomeScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const {
    currency: displayCurrency,
    setCurrency: setDisplayCurrency,
  } = useDisplayCurrency();
  const currentMonth = todayLocalISO().slice(0, 7);
  const [visibleMonth, setVisibleMonth] = useState(currentMonth);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [uncategorizedOnly, setUncategorizedOnly] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setErrorMessage('');

      void listExpensesByMonth(visibleMonth)
        .then((loadedExpenses) => {
          if (active) {
            setExpenses(loadedExpenses);
          }
        })
        .catch((error: unknown) => {
          console.error('Unable to load month expenses:', error);
          if (active) {
            setErrorMessage(
              'Не удалось загрузить траты. Попробуйте ещё раз.',
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
    }, [retryKey, visibleMonth]),
  );

  const uncategorizedExpenses = useMemo(
    () =>
      expenses.filter(
        (expense) => expense.categorySlug === 'uncategorized',
      ),
    [expenses],
  );
  const visibleExpenses = useMemo(
    () =>
      uncategorizedOnly && uncategorizedExpenses.length > 0
        ? uncategorizedExpenses
        : expenses,
    [expenses, uncategorizedExpenses, uncategorizedOnly],
  );
  const groups = useMemo(
    () => groupExpenses(visibleExpenses),
    [visibleExpenses],
  );
  const monthTotal = useMemo(
    () =>
      expenses.reduce(
        (sum, expense) =>
          sum + amountForCurrency(expense, displayCurrency),
        0,
      ),
    [displayCurrency, expenses],
  );
  const uncategorizedTotal = useMemo(
    () =>
      uncategorizedExpenses.reduce(
        (sum, expense) =>
          sum + amountForCurrency(expense, displayCurrency),
        0,
      ),
    [displayCurrency, uncategorizedExpenses],
  );
  const canMoveForward = visibleMonth < currentMonth;

  async function handleSignOut() {
    setSigningOut(true);
    setErrorMessage('');
    const { error } = await signOut();

    if (error) {
      setErrorMessage('Не удалось выйти. Попробуйте ещё раз.');
      setSigningOut(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.accountRow}>
          <Text style={styles.appName}>Fintrack</Text>
          <Pressable
            accessibilityRole="button"
            disabled={signingOut}
            onPress={() => void handleSignOut()}
            style={({ pressed }) => [
              styles.signOutButton,
              (pressed || signingOut) && styles.pressed,
            ]}
          >
            <Text style={styles.signOutText}>
              {signingOut ? 'Выход…' : 'Выйти'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.monthRow}>
          <Pressable
            accessibilityLabel="Предыдущий месяц"
            accessibilityRole="button"
            onPress={() =>
              setVisibleMonth((month) => shiftMonth(month, -1))
            }
            style={({ pressed }) => [
              styles.monthButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.monthButtonText}>‹</Text>
          </Pressable>

          <Text style={styles.monthTitle}>
            {formatMonthTitle(visibleMonth)}
          </Text>

          <Pressable
            accessibilityLabel="Следующий месяц"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canMoveForward }}
            disabled={!canMoveForward}
            onPress={() =>
              setVisibleMonth((month) => shiftMonth(month, 1))
            }
            style={({ pressed }) => [
              styles.monthButton,
              !canMoveForward && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.monthButtonText}>›</Text>
          </Pressable>
        </View>

        <Text style={styles.monthTotal}>
          {formatMoney(monthTotal)} {displayCurrency}
        </Text>

        <CurrencySelector
          accessibilityLabel="Валюта отображения"
          onChange={setDisplayCurrency}
          value={displayCurrency}
        />

        {uncategorizedExpenses.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: uncategorizedOnly }}
            onPress={() => setUncategorizedOnly((current) => !current)}
            style={({ pressed }) => [
              styles.triageChip,
              uncategorizedOnly && styles.triageChipSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.triageChipText,
                uncategorizedOnly && styles.triageChipTextSelected,
              ]}
            >
              Не распознано: {uncategorizedExpenses.length} ·{' '}
              {formatMoney(uncategorizedTotal)} {displayCurrency}
            </Text>
          </Pressable>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setRetryKey((current) => current + 1)}
            >
              <Text style={styles.retryText}>Повторить</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? <LoadingScreen compact /> : null}

        {!loading && !errorMessage && groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              Пока нет трат за этот месяц
            </Text>
            <Text style={styles.emptyHint}>
              Нажмите «+», чтобы добавить первую трату
            </Text>
          </View>
        ) : null}

        {!loading && !errorMessage
          ? groups.map((group) => {
              const dayTotal = group.expenses.reduce(
                (sum, expense) =>
                  sum + amountForCurrency(expense, displayCurrency),
                0,
              );

              return (
                <View key={group.date} style={styles.dayGroup}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayTitle}>
                      {formatDayHeader(group.date)}
                    </Text>
                    <Text style={styles.dayTotal}>
                      {formatMoney(dayTotal)} {displayCurrency}
                    </Text>
                  </View>

                  {group.expenses.map((expense) => (
                    <Pressable
                      accessibilityRole="button"
                      key={expense.id}
                      onPress={() =>
                        router.push(`/(app)/expense/${expense.id}`)
                      }
                      style={({ pressed }) => [
                        styles.expenseRow,
                        pressed && styles.rowPressed,
                      ]}
                    >
                      <Text style={styles.emoji}>
                        {expense.categoryEmoji}
                      </Text>
                      <View style={styles.expenseCopy}>
                        <Text numberOfLines={1} style={styles.expenseTitle}>
                          {expense.description.trim() ||
                            expense.categoryName}
                        </Text>
                        {expense.merchantName ? (
                          <Text
                            numberOfLines={1}
                            style={styles.expenseSubtitle}
                          >
                            {expense.merchantName}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={styles.expenseAmount}>
                        {formatMoney(
                          amountForCurrency(expense, displayCurrency),
                        )}{' '}
                        {displayCurrency}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              );
            })
          : null}
      </ScrollView>

      {Platform.OS !== 'web' ? (
        <Pressable
          accessibilityLabel="Сканировать чек"
          accessibilityRole="button"
          onPress={() => router.push('/(app)/receipt/scan')}
          style={({ pressed }) => [
            styles.floatingButton,
            styles.scanFloatingButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.scanFloatingButtonText}>📷</Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityLabel="Добавить трату"
        accessibilityRole="button"
        onPress={() => router.push('/(app)/expense/new')}
        style={({ pressed }) => [
          styles.floatingButton,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.floatingButtonText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  accountRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  appName: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
  content: {
    alignSelf: 'center',
    gap: theme.spacing.lg,
    maxWidth: theme.sizes.maxContentWidth,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.listBottom,
    width: '100%',
  },
  dayGroup: {
    gap: theme.spacing.xs,
  },
  dayHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  dayTitle: {
    color: theme.colors.textMuted,
    flex: 1,
    fontSize: theme.fontSizes.dayHeader,
    fontWeight: '600',
  },
  dayTotal: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.dayHeader,
    fontWeight: '600',
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
  emoji: {
    fontSize: theme.fontSizes.body,
  },
  emptyHint: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.label,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xxl,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorState: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.fontSizes.caption,
    textAlign: 'center',
  },
  expenseAmount: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
    textAlign: 'right',
  },
  expenseCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  expenseRow: {
    alignItems: 'center',
    borderBottomColor: theme.colors.border,
    borderBottomWidth: theme.sizes.border,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    minHeight: theme.sizes.floatingButton,
    paddingVertical: theme.spacing.xs,
  },
  expenseSubtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.caption,
  },
  expenseTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
  },
  floatingButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.round,
    bottom: theme.spacing.floatingOffset,
    height: theme.sizes.floatingButton,
    justifyContent: 'center',
    position: Platform.select({
      web: 'fixed',
      default: 'absolute',
    }) as ViewStyle['position'],
    right: theme.spacing.floatingOffset,
    width: theme.sizes.floatingButton,
  },
  floatingButtonText: {
    color: theme.colors.white,
    fontSize: theme.fontSizes.title,
    fontWeight: '400',
  },
  monthButton: {
    alignItems: 'center',
    height: theme.sizes.iconButton,
    justifyContent: 'center',
    width: theme.sizes.iconButton,
  },
  monthButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.title,
  },
  monthRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthTitle: {
    color: theme.colors.text,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
    textAlign: 'center',
  },
  monthTotal: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.monthTotal,
    fontWeight: '700',
    textAlign: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  retryText: {
    color: theme.colors.accent,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  rowPressed: {
    backgroundColor: theme.colors.surface,
  },
  scanFloatingButton: {
    bottom: theme.spacing.floatingStackOffset,
  },
  scanFloatingButtonText: {
    fontSize: theme.fontSizes.body,
  },
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  signOutButton: {
    minHeight: theme.sizes.iconButton,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xs,
  },
  signOutText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.label,
  },
  triageChip: {
    alignSelf: 'center',
    borderColor: theme.colors.accent,
    borderRadius: theme.radii.chip,
    borderWidth: theme.sizes.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  triageChipSelected: {
    backgroundColor: theme.colors.accent,
  },
  triageChipText: {
    color: theme.colors.accent,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  triageChipTextSelected: {
    color: theme.colors.white,
  },
});
