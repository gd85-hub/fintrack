import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type ViewStyle,
  View,
} from 'react-native';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CurrencySelector } from '../../components/CurrencySelector';
import { ExpenseMiniRow } from '../../components/ExpenseMiniRow';
import { LoadingScreen } from '../../components/LoadingScreen';
import { useAuth } from '../../contexts/AuthContext';
import { useDisplayCurrency } from '../../contexts/DisplayCurrencyContext';
import {
  deleteExpense,
  deleteReceipt,
  listExpensesByMonth,
  type Expense,
} from '../../lib/db';
import {
  formatDayHeader,
  formatMonthTitle,
  monthBounds,
  shiftMonth,
  todayLocalISO,
} from '../../lib/dates';
import {
  collapseIdenticalPurchaseItems,
  decideHomeRowPresentation,
  resolveHomeRowHeader,
} from '../../lib/homeRowPresentation';
import { type Currency, formatMoney } from '../../lib/money';
import { theme } from '../../lib/theme';

type ExpenseGroup = {
  date: string;
  expenses: Expense[];
};

export type PurchaseUnit = {
  expenses: Expense[];
  key: string;
  receiptId: string | null;
};

type PendingPurchaseDelete = {
  expenseCount: number;
  expenseIds: string[];
  receiptId: string | null;
  unitKey: string;
};

const expensePageSize = 10;

function amountForCurrency(expense: Expense, currency: Currency): number {
  if (currency === 'USD') {
    return expense.amountUsdCents;
  }

  if (currency === 'EUR') {
    return expense.amountEurCents;
  }

  return expense.amountRsdCents;
}

export function buildPurchaseUnits(
  expenses: readonly Expense[],
): PurchaseUnit[] {
  const units: PurchaseUnit[] = [];
  const receiptUnitIndexes = new Map<string, number>();

  for (const expense of expenses) {
    if (expense.receiptId === null) {
      units.push({
        expenses: [expense],
        key: `expense:${expense.id}`,
        receiptId: null,
      });
      continue;
    }

    const existingIndex = receiptUnitIndexes.get(expense.receiptId);
    if (existingIndex !== undefined) {
      units[existingIndex]?.expenses.push(expense);
      continue;
    }

    receiptUnitIndexes.set(expense.receiptId, units.length);
    units.push({
      expenses: [expense],
      key: `receipt:${expense.receiptId}`,
      receiptId: expense.receiptId,
    });
  }

  return units;
}

export function purchaseUnitTotal(
  unit: PurchaseUnit,
  currency: Currency,
): number {
  return unit.expenses.reduce(
    (sum, expense) => sum + amountForCurrency(expense, currency),
    0,
  );
}

export function purchaseUnitsTotal(
  units: readonly PurchaseUnit[],
  currency: Currency,
): number {
  return units.reduce(
    (sum, unit) => sum + purchaseUnitTotal(unit, currency),
    0,
  );
}

function purchaseDisplayAmount(
  expenses: readonly Expense[],
  displayCurrency: Currency,
) {
  const firstExpense = expenses[0];
  const usesOneUnconvertedCurrency =
    firstExpense !== undefined &&
    expenses.every(
      (expense) =>
        expense.fxRateDate === null &&
        expense.originalCurrency === firstExpense.originalCurrency,
    );

  if (usesOneUnconvertedCurrency) {
    return {
      amountCents: expenses.reduce(
        (sum, expense) => sum + expense.originalAmountCents,
        0,
      ),
      currency: firstExpense.originalCurrency,
    };
  }

  return {
    amountCents: expenses.reduce(
      (sum, expense) =>
        sum + amountForCurrency(expense, displayCurrency),
      0,
    ),
    currency: displayCurrency,
  };
}

export function purchaseCategoryHint(expenses: readonly Expense[]): string {
  const categories = new Map<string, string>();

  for (const expense of expenses) {
    if (!categories.has(expense.categoryId)) {
      categories.set(expense.categoryId, expense.categoryEmoji);
    }
  }

  const emojis = new Set<string>();
  for (const categoryEmoji of categories.values()) {
    const emoji = categoryEmoji.trim();
    if (emoji) {
      emojis.add(emoji);
    }
    if (emojis.size === 3) {
      break;
    }
  }

  return [...emojis].join(' ');
}

function purchasePositionLabel(itemCount: number): string {
  return itemCount === 1 ? '1 позиция' : `${itemCount} позиций`;
}

type PurchaseRowProps = {
  displayCurrency: Currency;
  expanded: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
  onOpenExpense: (expenseId: string) => void;
  onShowMore?: () => void;
  onToggle?: () => void;
  unit: PurchaseUnit;
  visibleCount: number;
};

function PurchaseRow({
  displayCurrency,
  expanded,
  onDelete,
  onEdit,
  onOpenExpense,
  onShowMore,
  onToggle,
  unit,
  visibleCount,
}: PurchaseRowProps) {
  const displayAmount = purchaseDisplayAmount(
    unit.expenses,
    displayCurrency,
  );
  const firstExpense = unit.expenses[0];
  const header = resolveHomeRowHeader(unit.expenses);
  const merchantName = unit.expenses
    .find((expense) => expense.merchantName?.trim())
    ?.merchantName?.trim();
  const merchantLabel = unit.expenses
    .find((expense) => expense.merchantLabel?.trim())
    ?.merchantLabel?.trim();
  const showMerchantLabel =
    merchantName !== undefined &&
    merchantLabel !== undefined &&
    merchantLabel !== header;
  const expandable = decideHomeRowPresentation(
    unit.expenses.length,
  ).expandable;
  const rowExpanded = expandable && expanded;
  const positionLabel = purchasePositionLabel(unit.expenses.length);
  const categoryHint = purchaseCategoryHint(unit.expenses);
  const collapsedItems = collapseIdenticalPurchaseItems(unit.expenses);
  const visibleItems = collapsedItems.slice(0, visibleCount);
  const remaining = collapsedItems.length - visibleItems.length;

  if (!firstExpense) {
    return null;
  }

  const handleRowPress = () => {
    if (expandable) {
      onToggle?.();
      return;
    }
    onOpenExpense(firstExpense.id);
  };

  return (
    <View style={styles.purchaseUnit}>
      <Pressable
        accessibilityLabel={`${header}${showMerchantLabel ? `, ${merchantLabel}` : ''}, ${positionLabel}, ${formatMoney(displayAmount.amountCents)} ${displayAmount.currency}`}
        accessibilityRole="button"
        accessibilityState={
          expandable ? { expanded: rowExpanded } : undefined
        }
        onPress={handleRowPress}
        style={({ pressed }) => [
          styles.expenseRow,
          pressed && styles.rowPressed,
        ]}
      >
        <View style={styles.expenseCopy}>
          <Text numberOfLines={1} style={styles.purchaseTitle}>
            {header}
          </Text>
          {showMerchantLabel ? (
            <Text numberOfLines={1} style={styles.purchaseMerchantLabel}>
              {merchantLabel}
            </Text>
          ) : null}
          <Text numberOfLines={1} style={styles.expenseSubtitle}>
            {categoryHint ? `${positionLabel} · ${categoryHint}` : positionLabel}
          </Text>
        </View>
        <Text numberOfLines={1} style={styles.expenseAmount}>
          {formatMoney(displayAmount.amountCents)} {displayAmount.currency}
        </Text>
        {expandable ? (
          <Text
            style={[
              styles.expandIcon,
              rowExpanded && styles.expandIconExpanded,
            ]}
          >
            ›
          </Text>
        ) : (
          <View style={styles.expandIconSpacer} />
        )}
      </Pressable>

      {rowExpanded ? (
        <View style={styles.purchaseDetails}>
          <View style={styles.purchaseActions}>
            <Text style={styles.purchaseDetailsTitle}>
              Позиции чека
            </Text>
            {onEdit && onDelete ? (
              <View style={styles.purchaseActionButtons}>
                <Pressable
                  accessibilityLabel="Редактировать всю покупку"
                  accessibilityRole="button"
                  onPress={onEdit}
                  style={({ pressed }) => [
                    styles.editPurchaseButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.editPurchaseText}>
                    Редактировать покупку
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Удалить всю покупку из ${unit.expenses.length} трат`}
                  accessibilityRole="button"
                  onPress={onDelete}
                  style={({ pressed }) => [
                    styles.deletePurchaseButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.deletePurchaseText}>
                    Удалить покупку
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {visibleItems.map((item) => {
            const expense = item.firstExpense;
            const itemAmount = purchaseDisplayAmount(
              item.expenses,
              displayCurrency,
            );
            const displayName = `${item.displayName}${
              item.count > 1 ? ` ×${item.count}` : ''
            }`;

            return (
              <Pressable
                accessibilityLabel={`Открыть позицию ${displayName}`}
                accessibilityRole="button"
                key={expense.id}
                onPress={() => onOpenExpense(expense.id)}
                style={({ pressed }) => [
                  styles.purchaseItem,
                  pressed && styles.rowPressed,
                ]}
              >
                <ExpenseMiniRow
                  amountCents={itemAmount.amountCents}
                  categoryLabel={`${expense.categoryEmoji} ${expense.categoryName}`.trim()}
                  currency={itemAmount.currency}
                  date={expense.occurredOn}
                  description={displayName}
                  merchantName={null}
                  rawName={
                    expense.rawName?.trim() === item.displayName
                      ? null
                      : expense.rawName
                  }
                />
              </Pressable>
            );
          })}

          {remaining > 0 && onShowMore ? (
            <Pressable
              accessibilityLabel={`Показать ещё ${Math.min(expensePageSize, remaining)} позиций`}
              accessibilityRole="button"
              onPress={onShowMore}
              style={({ pressed }) => [
                styles.showMoreButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.showMoreText}>
                Показать ещё {Math.min(expensePageSize, remaining)}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
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

function monthFromParam(value: string | string[] | undefined) {
  const month = Array.isArray(value) ? value[0] : value;
  if (!month) {
    return null;
  }

  try {
    monthBounds(month);
    return month;
  } catch {
    return null;
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ month?: string | string[] }>();
  const { signOut } = useAuth();
  const {
    currency: displayCurrency,
    setCurrency: setDisplayCurrency,
  } = useDisplayCurrency();
  const currentMonth = todayLocalISO().slice(0, 7);
  const requestedMonth = monthFromParam(params.month);
  const [visibleMonth, setVisibleMonth] = useState(
    requestedMonth ?? currentMonth,
  );
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false);
  const [expandedUnitKeys, setExpandedUnitKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [unitVisibleCounts, setUnitVisibleCounts] = useState<
    Record<string, number>
  >({});
  const [pendingPurchaseDelete, setPendingPurchaseDelete] =
    useState<PendingPurchaseDelete | null>(null);
  const [deletingPurchase, setDeletingPurchase] = useState(false);
  const [purchaseErrorMessage, setPurchaseErrorMessage] = useState('');

  useEffect(() => {
    if (requestedMonth) {
      setVisibleMonth(requestedMonth);
    }
  }, [requestedMonth]);

  useEffect(() => {
    setExpandedUnitKeys(new Set());
    setUnitVisibleCounts({});
    setPurchaseErrorMessage('');
  }, [visibleMonth]);

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

  const needsAttentionExpenses = useMemo(
    () =>
      expenses.filter(
        (expense) =>
          expense.categorySlug === 'uncategorized' ||
          expense.fxRateDate === null,
      ),
    [expenses],
  );
  const visibleExpenses = useMemo(
    () =>
      needsAttentionOnly && needsAttentionExpenses.length > 0
        ? needsAttentionExpenses
        : expenses,
    [expenses, needsAttentionExpenses, needsAttentionOnly],
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

  function toggleUnit(unitKey: string) {
    const willExpand = !expandedUnitKeys.has(unitKey);

    setExpandedUnitKeys((current) => {
      const next = new Set(current);
      if (willExpand) {
        next.add(unitKey);
      } else {
        next.delete(unitKey);
      }
      return next;
    });
    setUnitVisibleCounts((current) => {
      if (willExpand) {
        return { ...current, [unitKey]: expensePageSize };
      }

      const next = { ...current };
      delete next[unitKey];
      return next;
    });
  }

  function showMoreUnit(unitKey: string) {
    setUnitVisibleCounts((current) => ({
      ...current,
      [unitKey]: (current[unitKey] ?? expensePageSize) + expensePageSize,
    }));
  }

  function requestPurchaseDelete(unit: PurchaseUnit) {
    setPendingPurchaseDelete({
      expenseCount: unit.expenses.length,
      expenseIds: unit.expenses.map((expense) => expense.id),
      receiptId: unit.receiptId,
      unitKey: unit.key,
    });
  }

  async function handlePurchaseDelete() {
    if (!pendingPurchaseDelete) {
      return;
    }

    const { expenseIds, receiptId, unitKey } = pendingPurchaseDelete;
    let deletionFailed = false;

    setDeletingPurchase(true);
    setPurchaseErrorMessage('');

    try {
      for (const expenseId of expenseIds) {
        await deleteExpense(expenseId);
      }
      if (receiptId !== null) {
        await deleteReceipt(receiptId);
      }
    } catch (error: unknown) {
      deletionFailed = true;
      console.error('Unable to delete the complete purchase:', error);
    }

    try {
      const refreshedExpenses = await listExpensesByMonth(visibleMonth);
      setExpenses(refreshedExpenses);
      if (deletionFailed) {
        setPurchaseErrorMessage(
          'Не удалось удалить покупку полностью. Список обновлён.',
        );
      }
    } catch (error: unknown) {
      console.error('Unable to refresh expenses after deletion:', error);
      setErrorMessage(
        deletionFailed
          ? 'Не удалось удалить покупку полностью и обновить список. Попробуйте ещё раз.'
          : 'Покупка удалена, но не удалось обновить список. Попробуйте ещё раз.',
      );
    } finally {
      setDeletingPurchase(false);
      setPendingPurchaseDelete(null);
      setExpandedUnitKeys((current) => {
        const next = new Set(current);
        next.delete(unitKey);
        return next;
      });
      setUnitVisibleCounts((current) => {
        const next = { ...current };
        delete next[unitKey];
        return next;
      });
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.accountRow}>
          <Text style={styles.appName}>Fintrack</Text>
          <View style={styles.accountActions}>
            <Pressable
              accessibilityLabel="Открыть меню"
              accessibilityRole="button"
              onPress={() => router.push('/(app)/menu')}
              style={({ pressed }) => [
                styles.headerAction,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.headerActionText}>☰ Меню</Text>
            </Pressable>
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

        {needsAttentionExpenses.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: needsAttentionOnly }}
            onPress={() => setNeedsAttentionOnly((current) => !current)}
            style={({ pressed }) => [
              styles.triageChip,
              needsAttentionOnly && styles.triageChipSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.triageChipText,
                needsAttentionOnly && styles.triageChipTextSelected,
              ]}
            >
              Требуют внимания: {needsAttentionExpenses.length}
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

        {purchaseErrorMessage ? (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>{purchaseErrorMessage}</Text>
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
              const purchaseUnits = buildPurchaseUnits(group.expenses);

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

                  {purchaseUnits.map((unit) => {
                    const expense = unit.expenses[0];

                    if (!expense) {
                      return null;
                    }

                    const receiptId = unit.receiptId;

                    return (
                      <PurchaseRow
                        displayCurrency={displayCurrency}
                        expanded={expandedUnitKeys.has(unit.key)}
                        key={unit.key}
                        onDelete={() => requestPurchaseDelete(unit)}
                        onEdit={
                          receiptId !== null
                            ? () =>
                                router.push(
                                  `/(app)/receipt/review?receiptId=${encodeURIComponent(receiptId)}`,
                                )
                            : () =>
                                router.push(`/(app)/expense/${expense.id}`)
                        }
                        onOpenExpense={(expenseId) =>
                          router.push(`/(app)/expense/${expenseId}`)
                        }
                        onShowMore={() => showMoreUnit(unit.key)}
                        onToggle={() => toggleUnit(unit.key)}
                        unit={unit}
                        visibleCount={
                          unitVisibleCounts[unit.key] ?? expensePageSize
                        }
                      />
                    );
                  })}
                </View>
              );
            })
          : null}
      </ScrollView>

      <Pressable
        accessibilityLabel={
          Platform.OS === 'web'
            ? 'Чек из фото или скриншота'
            : 'Сканировать чек'
        }
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

      <ConfirmDialog
        confirming={deletingPurchase}
        onCancel={() => {
          if (!deletingPurchase) {
            setPendingPurchaseDelete(null);
          }
        }}
        onConfirm={() => void handlePurchaseDelete()}
        title={
          pendingPurchaseDelete
            ? `Удалить всю покупку (${pendingPurchaseDelete.expenseCount} трат)?`
            : ''
        }
        visible={pendingPurchaseDelete !== null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  accountActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
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
  deletePurchaseButton: {
    justifyContent: 'center',
    minHeight: theme.sizes.iconButton,
  },
  deletePurchaseText: {
    color: theme.colors.danger,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  editPurchaseButton: {
    justifyContent: 'center',
    minHeight: theme.sizes.iconButton,
  },
  editPurchaseText: {
    color: theme.colors.accent,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  disabled: {
    opacity: theme.opacity.disabled,
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
    fontVariant: ['tabular-nums'],
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
  expandIcon: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.body,
    textAlign: 'center',
    width: theme.spacing.md,
  },
  expandIconExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  expandIconSpacer: {
    width: theme.spacing.md,
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
  headerAction: {
    justifyContent: 'center',
    minHeight: theme.sizes.iconButton,
  },
  headerActionText: {
    color: theme.colors.accent,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
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
  purchaseActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  purchaseActionButtons: {
    flexDirection: 'row',
    flexShrink: 1,
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    justifyContent: 'flex-end',
  },
  purchaseDetails: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    marginBottom: theme.spacing.sm,
    marginLeft: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xxs,
  },
  purchaseDetailsTitle: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  purchaseItem: {
    borderBottomColor: theme.colors.border,
    borderBottomWidth: theme.sizes.border,
  },
  purchaseMerchantLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.small,
  },
  purchaseTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  purchaseUnit: {
    width: '100%',
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
  showMoreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.sizes.iconButton,
  },
  showMoreText: {
    color: theme.colors.accent,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
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
