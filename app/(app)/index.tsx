import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CurrencySelector } from '../../components/CurrencySelector';
import { ExpenseMiniRow } from '../../components/ExpenseMiniRow';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ListRow } from '../../components/ds/ListRow';
import { useDisplayCurrency } from '../../contexts/DisplayCurrencyContext';
import {
  deleteExpense,
  deleteReceipt,
  listExpensesByMonth,
  type Expense,
} from '../../lib/db';
import {
  formatDayHeader,
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

export type HomeDaySection = {
  data: PurchaseUnit[];
  date: string;
  dayTotal: number;
  units: PurchaseUnit[];
};

type PendingPurchaseDelete = {
  expenseCount: number;
  expenseIds: string[];
  receiptId: string | null;
  unitKey: string;
};

const expensePageSize = 10;
const purchaseRowTextOffset =
  theme.scale.space[3] +
  theme.scale.size.iconCircle +
  theme.scale.space[3];

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

export function buildDaySections(
  groups: readonly ExpenseGroup[],
  collapsedDays: ReadonlySet<string>,
  displayCurrency: Currency,
): HomeDaySection[] {
  return groups.map((group) => {
    const units = buildPurchaseUnits(group.expenses);

    return {
      data: collapsedDays.has(group.date) ? [] : units,
      date: group.date,
      dayTotal: group.expenses.reduce(
        (sum, expense) => sum + amountForCurrency(expense, displayCurrency),
        0,
      ),
      units,
    };
  });
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
  const iconEmoji = unit.expenses
    .find((expense) => expense.categoryEmoji.trim())
    ?.categoryEmoji.trim();
  const expandable = decideHomeRowPresentation(
    unit.expenses.length,
  ).expandable;
  const rowExpanded = expandable && expanded;
  const positionLabel = purchasePositionLabel(unit.expenses.length);
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
      <ListRow
        amount={`${formatMoney(displayAmount.amountCents)} ${displayAmount.currency}`}
        category={positionLabel}
        iconEmoji={iconEmoji}
        onPress={handleRowPress}
        place={header}
        showChevron={true}
      />

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

function PurchaseRowSeparator() {
  return <View style={styles.purchaseRowSeparator} />;
}

function DaySectionFooter() {
  return <View style={styles.daySectionGap} />;
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
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false);
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(
    () => new Set(),
  );
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
    setCollapsedDays(new Set());
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
  const sections = useMemo(
    () => buildDaySections(groups, collapsedDays, displayCurrency),
    [collapsedDays, displayCurrency, groups],
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
  const monthTitle = useMemo(() => {
    const firstDay = monthBounds(visibleMonth).first;
    const year = Number(firstDay.slice(0, 4));
    const monthIndex = Number(firstDay.slice(5, 7)) - 1;

    return new Date(year, monthIndex, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, [visibleMonth]);
  const canMoveForward = visibleMonth < currentMonth;

  const listHeaderElement = useMemo(
    () => (
      <View style={styles.listHeader}>
        <Text style={styles.appName}>Fintrack</Text>

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
            {monthTitle}
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
      </View>
    ),
    [
      canMoveForward,
      displayCurrency,
      errorMessage,
      loading,
      monthTotal,
      monthTitle,
      needsAttentionExpenses.length,
      needsAttentionOnly,
      purchaseErrorMessage,
      setDisplayCurrency,
      visibleMonth,
    ],
  );

  const listEmptyElement = useMemo(
    () =>
      !loading && !errorMessage && sections.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Пока нет трат за этот месяц</Text>
          <Text style={styles.emptyHint}>
            Нажмите «+», чтобы добавить первую трату
          </Text>
        </View>
      ) : null,
    [errorMessage, loading, sections.length],
  );

  const listSections = useMemo(
    () => (loading || errorMessage ? [] : sections),
    [errorMessage, loading, sections],
  );

  function toggleDay(date: string) {
    setCollapsedDays((current) => {
      const next = new Set(current);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
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
      <SectionList<PurchaseUnit, HomeDaySection>
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={PurchaseRowSeparator}
        keyExtractor={(unit) => unit.key}
        ListEmptyComponent={listEmptyElement}
        ListHeaderComponent={listHeaderElement}
        renderItem={({ item: unit }) => {
          const expense = unit.expenses[0];

          if (!expense) {
            return null;
          }

          const receiptId = unit.receiptId;

          return (
            <PurchaseRow
              displayCurrency={displayCurrency}
              expanded={expandedUnitKeys.has(unit.key)}
              onDelete={() => requestPurchaseDelete(unit)}
              onEdit={
                receiptId !== null
                  ? () =>
                      router.push(
                        `/(app)/receipt/review?receiptId=${encodeURIComponent(receiptId)}`,
                      )
                  : () => router.push(`/(app)/expense/${expense.id}`)
              }
              onOpenExpense={(expenseId) =>
                router.push(`/(app)/expense/${expenseId}`)
              }
              onShowMore={() => showMoreUnit(unit.key)}
              onToggle={() => toggleUnit(unit.key)}
              unit={unit}
              visibleCount={unitVisibleCounts[unit.key] ?? expensePageSize}
            />
          );
        }}
        renderSectionFooter={DaySectionFooter}
        renderSectionHeader={({ section }) => {
          const collapsed = collapsedDays.has(section.date);

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: !collapsed }}
              onPress={() => toggleDay(section.date)}
              style={({ pressed }) => [
                styles.dayHeader,
                pressed && styles.rowPressed,
              ]}
            >
              <Text numberOfLines={1} style={styles.dayTitle}>
                {formatDayHeader(section.date)}
              </Text>
              <Text numberOfLines={1} style={styles.dayTotal}>
                {formatMoney(section.dayTotal)} {displayCurrency}
              </Text>
            </Pressable>
          );
        }}
        sections={listSections}
        stickySectionHeadersEnabled={true}
        style={styles.list}
      />

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
  appName: {
    color: theme.color.text.primary,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
  content: {
    alignSelf: 'center',
    maxWidth: theme.sizes.maxContentWidth,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.listBottom,
    width: '100%',
  },
  dayHeader: {
    alignItems: 'center',
    backgroundColor: theme.color.bg.base,
    flexDirection: 'row',
    gap: theme.scale.space[3],
    justifyContent: 'space-between',
    paddingBottom: theme.scale.space[2],
    paddingHorizontal: theme.scale.space[4],
    paddingTop: theme.scale.space[5],
  },
  daySectionGap: {
    height: theme.spacing.lg,
  },
  dayTitle: {
    ...theme.type.captionDefault,
    color: theme.color.text.secondary,
    flex: 1,
  },
  dayTotal: {
    ...theme.type.amountSecondary,
    color: theme.color.text.secondary,
    fontVariant: [...theme.type.amountSecondary.fontVariant],
    textAlign: 'right',
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
  list: {
    flex: 1,
  },
  listHeader: {
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  monthButton: {
    alignItems: 'center',
    height: theme.sizes.iconButton,
    justifyContent: 'center',
    width: theme.sizes.iconButton,
  },
  monthButtonText: {
    color: theme.color.text.primary,
    fontSize: theme.fontSizes.title,
  },
  monthRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthTitle: {
    color: theme.color.text.primary,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
    textAlign: 'center',
  },
  monthTotal: {
    color: theme.color.text.primary,
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
  purchaseRowSeparator: {
    backgroundColor: theme.color.separatorInset,
    height: theme.scale.stroke.hairline,
    marginLeft: purchaseRowTextOffset,
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
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
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
