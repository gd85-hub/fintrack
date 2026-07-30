import { useFocusEffect, useRouter } from 'expo-router';
import {
  Children,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CurrencySelector } from '../../components/CurrencySelector';
import { ExpenseMiniRow } from '../../components/ExpenseMiniRow';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ShareBar } from '../../components/ShareBar';
import { useDisplayCurrency } from '../../contexts/DisplayCurrencyContext';
import {
  type AnalyticsExpense,
  categoryBreakdownByMonth,
  type CategoryBreakdown,
  type MerchantBreakdown,
  merchantBreakdownByMonth,
  type MerchantTypeBreakdown,
  listExpensesForAnalytics,
  type MonthlyCategoryBreakdown,
  type MonthlyMerchantBreakdown,
} from '../../lib/db';
import {
  formatMonthTitle,
  shiftMonth,
  todayLocalISO,
} from '../../lib/dates';
import { type Currency, formatMoney } from '../../lib/money';
import { theme } from '../../lib/theme';

const expensePageSize = 10;
const unknownMerchantKey = 'unknown';

type PaletteColor =
  | (typeof theme.categoryPalette)[number]
  | typeof theme.colors.disabled;

type RankedCategory = {
  amount: number;
  category: CategoryBreakdown;
  color: PaletteColor;
  share: number;
};

type RankedMerchantType = {
  amount: number;
  color: PaletteColor;
  merchants: Array<{
    amount: number;
    merchant: MerchantBreakdown;
  }>;
  share: number;
  type: MerchantTypeBreakdown;
};

type CurrencyTotals = {
  totalRsd: number;
  totalUsd: number;
  totalEur: number;
};

function amountForCurrency(value: CurrencyTotals, currency: Currency) {
  if (currency === 'USD') {
    return value.totalUsd;
  }

  if (currency === 'EUR') {
    return value.totalEur;
  }

  return value.totalRsd;
}

function colorForKey(key: string | null) {
  if (key === null) {
    return theme.colors.disabled;
  }

  let hash = 0;
  for (const character of key) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return theme.categoryPalette[hash % theme.categoryPalette.length];
}

function formatShare(share: number) {
  const rounded = Math.round(share * 10) / 10;
  return `${String(rounded).replace('.', ',')}%`;
}

function amountForExpense(
  expense: AnalyticsExpense,
  currency: Currency,
) {
  if (currency === 'USD') {
    return expense.amountUsd;
  }

  if (currency === 'EUR') {
    return expense.amountEur;
  }

  return expense.amountRsd;
}

type ExpenseDetailsProps = {
  currency: Currency;
  expenses: AnalyticsExpense[];
  onShowMore: () => void;
  visibleCount: number;
};

function DrilldownPanel({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);

  return (
    <View style={styles.drilldownPanel}>
      {items.map((child, index) => (
        <View
          key={index}
          style={
            index < items.length - 1
              ? styles.drilldownItemDivider
              : undefined
          }
        >
          {child}
        </View>
      ))}
    </View>
  );
}

function ExpenseDetails({
  currency,
  expenses,
  onShowMore,
  visibleCount,
}: ExpenseDetailsProps) {
  const visibleExpenses = expenses.slice(0, visibleCount);
  const remaining = expenses.length - visibleExpenses.length;

  return (
    <DrilldownPanel>
      {visibleExpenses.map((expense) => (
        <ExpenseMiniRow
          amountCents={amountForExpense(expense, currency)}
          currency={currency}
          date={expense.occurredOn}
          description={
            expense.description.trim() || expense.categoryName
          }
          key={expense.id}
          merchantName={expense.merchantName}
        />
      ))}
      {remaining > 0 ? (
        <Pressable
          accessibilityLabel={`Показать ещё ${Math.min(expensePageSize, remaining)} трат`}
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
    </DrilldownPanel>
  );
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const {
    currency: displayCurrency,
    setCurrency: setDisplayCurrency,
  } = useDisplayCurrency();
  const currentMonth = todayLocalISO().slice(0, 7);
  const [visibleMonth, setVisibleMonth] = useState(currentMonth);
  const [breakdown, setBreakdown] =
    useState<MonthlyCategoryBreakdown | null>(null);
  const [merchantBreakdown, setMerchantBreakdown] =
    useState<MonthlyMerchantBreakdown | null>(null);
  const [analyticsExpenses, setAnalyticsExpenses] = useState<
    AnalyticsExpense[]
  >([]);
  const [expandedTypeKeys, setExpandedTypeKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [categoryVisibleCounts, setCategoryVisibleCounts] = useState<
    Record<string, number>
  >({});
  const [merchantVisibleCounts, setMerchantVisibleCounts] = useState<
    Record<string, number>
  >({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setBreakdown(null);
      setMerchantBreakdown(null);
      setAnalyticsExpenses([]);
      setExpandedTypeKeys(new Set());
      setCategoryVisibleCounts({});
      setMerchantVisibleCounts({});
      setErrorMessage('');

      void Promise.all([
        categoryBreakdownByMonth(visibleMonth),
        merchantBreakdownByMonth(visibleMonth),
        listExpensesForAnalytics(visibleMonth),
      ])
        .then(
          ([
            loadedBreakdown,
            loadedMerchantBreakdown,
            loadedExpenses,
          ]) => {
            if (active) {
              setBreakdown(loadedBreakdown);
              setMerchantBreakdown(loadedMerchantBreakdown);
              setAnalyticsExpenses(loadedExpenses);
            }
          },
        )
        .catch((error: unknown) => {
          console.error('Unable to load category analytics:', error);
          if (active) {
            setErrorMessage(
              'Не удалось загрузить аналитику. Попробуйте ещё раз.',
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

  const monthTotal = breakdown
    ? amountForCurrency(breakdown, displayCurrency)
    : 0;
  const rankedCategories = useMemo<RankedCategory[]>(() => {
    if (!breakdown || monthTotal <= 0) {
      return [];
    }

    return breakdown.categories
      .map((category) => ({
        amount: amountForCurrency(category, displayCurrency),
        category,
        color: colorForKey(category.categoryId),
      }))
      .filter(({ amount }) => amount > 0)
      .sort((left, right) => right.amount - left.amount)
      .map((category) => ({
        ...category,
        share: (category.amount / monthTotal) * 100,
      }));
  }, [breakdown, displayCurrency, monthTotal]);
  const merchantTotal = merchantBreakdown
    ? amountForCurrency(merchantBreakdown, displayCurrency)
    : 0;
  const rankedMerchantTypes = useMemo<RankedMerchantType[]>(() => {
    if (!merchantBreakdown || merchantTotal <= 0) {
      return [];
    }

    return merchantBreakdown.types
      .map((type) => ({
        amount: amountForCurrency(type, displayCurrency),
        color: colorForKey(type.typeId),
        merchants: type.merchants
          .map((merchant) => ({
            amount: amountForCurrency(merchant, displayCurrency),
            merchant,
          }))
          .filter(({ amount }) => amount > 0)
          .sort((left, right) => right.amount - left.amount),
        type,
      }))
      .filter(({ amount }) => amount > 0)
      .sort((left, right) => {
        if (left.type.typeId === null) {
          return right.type.typeId === null ? 0 : 1;
        }
        if (right.type.typeId === null) {
          return -1;
        }
        return right.amount - left.amount;
      })
      .map((type) => ({
        ...type,
        share: (type.amount / merchantTotal) * 100,
      }));
  }, [displayCurrency, merchantBreakdown, merchantTotal]);
  const { expensesByCategory, expensesByMerchant } = useMemo(() => {
    const categoryBuckets = new Map<string, AnalyticsExpense[]>();
    const merchantBuckets = new Map<string, AnalyticsExpense[]>();

    for (const expense of analyticsExpenses) {
      const categoryExpenses =
        categoryBuckets.get(expense.categoryId) ?? [];
      categoryExpenses.push(expense);
      categoryBuckets.set(expense.categoryId, categoryExpenses);

      const merchantKey = expense.merchantId ?? unknownMerchantKey;
      const merchantExpenses = merchantBuckets.get(merchantKey) ?? [];
      merchantExpenses.push(expense);
      merchantBuckets.set(merchantKey, merchantExpenses);
    }

    return {
      expensesByCategory: categoryBuckets,
      expensesByMerchant: merchantBuckets,
    };
  }, [analyticsExpenses]);
  const canMoveForward = visibleMonth < currentMonth;

  function openMonthOnHome() {
    router.replace({
      pathname: '/(app)',
      params: { month: visibleMonth },
    });
  }

  function toggleType(typeId: string | null) {
    const typeKey = typeId ?? unknownMerchantKey;
    setExpandedTypeKeys((current) => {
      const next = new Set(current);
      if (next.has(typeKey)) {
        next.delete(typeKey);
      } else {
        next.add(typeKey);
      }
      return next;
    });
  }

  function toggleCategory(categoryId: string) {
    setCategoryVisibleCounts((current) => {
      if (current[categoryId] !== undefined) {
        const next = { ...current };
        delete next[categoryId];
        return next;
      }
      return { ...current, [categoryId]: expensePageSize };
    });
  }

  function showMoreCategory(categoryId: string) {
    setCategoryVisibleCounts((current) => ({
      ...current,
      [categoryId]: (current[categoryId] ?? expensePageSize) + expensePageSize,
    }));
  }

  function toggleMerchant(merchantId: string | null) {
    const merchantKey = merchantId ?? unknownMerchantKey;
    setMerchantVisibleCounts((current) => {
      if (current[merchantKey] !== undefined) {
        const next = { ...current };
        delete next[merchantKey];
        return next;
      }
      return { ...current, [merchantKey]: expensePageSize };
    });
  }

  function showMoreMerchant(merchantId: string | null) {
    const merchantKey = merchantId ?? unknownMerchantKey;
    setMerchantVisibleCounts((current) => ({
      ...current,
      [merchantKey]:
        (current[merchantKey] ?? expensePageSize) + expensePageSize,
    }));
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Вернуться к тратам"
          accessibilityRole="button"
          onPress={openMonthOnHome}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Аналитика</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
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

        <CurrencySelector
          accessibilityLabel="Валюта аналитики"
          onChange={setDisplayCurrency}
          value={displayCurrency}
        />

        <View style={styles.totalBlock}>
          <Text style={styles.totalLabel}>Всего за месяц</Text>
          <Text style={styles.monthTotal}>
            {formatMoney(monthTotal)} {displayCurrency}
          </Text>
        </View>

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

        {!loading && !errorMessage && rankedCategories.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              Нет трат за этот месяц для анализа
            </Text>
          </View>
        ) : null}

        {!loading && !errorMessage && rankedCategories.length > 0 ? (
          <View style={styles.analyticsBlocks}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>По категориям</Text>
              <ShareBar
                accessibilityLabel="Доли трат по категориям"
                segments={rankedCategories.map(
                  ({ amount, category, color }) => ({
                    id: category.categoryId,
                    amount,
                    color,
                  }),
                )}
              />

              <View style={styles.categoryList}>
                {rankedCategories.map(
                  ({ amount, category, color, share }) => {
                    const visibleCount =
                      categoryVisibleCounts[category.categoryId];
                    const expanded = visibleCount !== undefined;
                    const categoryExpenses =
                      expensesByCategory.get(category.categoryId) ?? [];

                    return (
                      <View
                        key={category.categoryId}
                        style={styles.categoryGroup}
                      >
                        <Pressable
                          accessibilityLabel={`${category.name}, ${formatMoney(amount)} ${displayCurrency}, ${formatShare(share)}, операций: ${category.count}`}
                          accessibilityRole="button"
                          accessibilityState={{ expanded }}
                          onPress={() =>
                            toggleCategory(category.categoryId)
                          }
                          style={({ pressed }) => [
                            styles.categoryRow,
                            pressed && styles.rowPressed,
                          ]}
                        >
                          <View
                            style={[
                              styles.categoryMarker,
                              { backgroundColor: color },
                            ]}
                          />
                          <Text style={styles.emoji}>{category.emoji}</Text>
                          <View style={styles.categoryCopy}>
                            <Text
                              numberOfLines={1}
                              style={styles.categoryName}
                            >
                              {category.name}
                            </Text>
                            <Text style={styles.categoryMeta}>
                              {formatShare(share)} · Операций:{' '}
                              {category.count}
                            </Text>
                          </View>
                          <Text style={styles.categoryAmount}>
                            {formatMoney(amount)} {displayCurrency}
                          </Text>
                          <Text
                            style={[
                              styles.expandIcon,
                              expanded && styles.expandIconExpanded,
                            ]}
                          >
                            ›
                          </Text>
                        </Pressable>

                        {expanded ? (
                          <ExpenseDetails
                            currency={displayCurrency}
                            expenses={categoryExpenses}
                            onShowMore={() =>
                              showMoreCategory(category.categoryId)
                            }
                            visibleCount={visibleCount}
                          />
                        ) : null}
                      </View>
                    );
                  },
                )}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>По местам</Text>
              <ShareBar
                accessibilityLabel="Доли трат по типам мест"
                segments={rankedMerchantTypes.map(
                  ({ amount, color, type }) => ({
                    id: type.typeId ?? unknownMerchantKey,
                    amount,
                    color,
                  }),
                )}
              />

              <View style={styles.merchantTypeList}>
                {rankedMerchantTypes.map(
                  ({ amount, color, merchants, share, type }) => {
                    const typeKey =
                      type.typeId ?? unknownMerchantKey;
                    const expanded = expandedTypeKeys.has(typeKey);
                    return (
                      <View key={typeKey} style={styles.merchantTypeGroup}>
                        <Pressable
                          accessibilityLabel={`${type.typeName}, ${formatMoney(amount)} ${displayCurrency}, ${formatShare(share)}, операций: ${type.count}`}
                          accessibilityRole="button"
                          accessibilityState={{ expanded }}
                          onPress={() => toggleType(type.typeId)}
                          style={({ pressed }) => [
                            styles.merchantTypeHeader,
                            pressed && styles.rowPressed,
                          ]}
                        >
                          <View
                            style={[
                              styles.categoryMarker,
                              { backgroundColor: color },
                            ]}
                          />
                          <Text style={styles.emoji}>{type.emoji}</Text>
                          <View style={styles.categoryCopy}>
                            <Text
                              numberOfLines={1}
                              style={styles.categoryName}
                            >
                              {type.typeName}
                            </Text>
                            <Text style={styles.categoryMeta}>
                              {formatShare(share)} · Операций: {type.count}
                            </Text>
                          </View>
                          <Text style={styles.categoryAmount}>
                            {formatMoney(amount)} {displayCurrency}
                          </Text>
                          <Text
                            style={[
                              styles.expandIcon,
                              expanded && styles.expandIconExpanded,
                            ]}
                          >
                            ›
                          </Text>
                        </Pressable>

                        {type.typeId === null ? (
                          <Text style={styles.unknownHint}>
                            Можно уточнить, отредактировав трату
                          </Text>
                        ) : null}

                        {expanded ? (
                          <DrilldownPanel>
                            {merchants.map(
                              ({ amount: merchantAmount, merchant }) => {
                                const merchantKey =
                                  merchant.merchantId ??
                                  unknownMerchantKey;
                                const merchantVisibleCount =
                                  merchantVisibleCounts[merchantKey];
                                const merchantExpanded =
                                  merchantVisibleCount !== undefined;
                                const merchantExpenses =
                                  expensesByMerchant.get(merchantKey) ?? [];

                                return (
                                  <View
                                    key={merchantKey}
                                    style={styles.merchantGroup}
                                  >
                                    <Pressable
                                      accessibilityLabel={`${merchant.name}, ${formatMoney(merchantAmount)} ${displayCurrency}, операций: ${merchant.count}`}
                                      accessibilityRole="button"
                                      accessibilityState={{
                                        expanded: merchantExpanded,
                                      }}
                                      onPress={() =>
                                        toggleMerchant(
                                          merchant.merchantId,
                                        )
                                      }
                                      style={({ pressed }) => [
                                        styles.merchantRow,
                                        pressed && styles.rowPressed,
                                      ]}
                                    >
                                      <View style={styles.merchantCopy}>
                                        <Text
                                          numberOfLines={1}
                                          style={styles.merchantName}
                                        >
                                          {merchant.name}
                        </Text>
                                        <Text style={styles.merchantMeta}>
                                          Операций: {merchant.count}
                                        </Text>
                                      </View>
                                      <Text style={styles.merchantAmount}>
                                        {formatMoney(merchantAmount)}{' '}
                                        {displayCurrency}
                                      </Text>
                                      <Text
                                        style={[
                                          styles.expandIcon,
                                          merchantExpanded &&
                                            styles.expandIconExpanded,
                                        ]}
                                      >
                                        ›
                                      </Text>
                                    </Pressable>

                                    {merchantExpanded ? (
                                      <ExpenseDetails
                                        currency={displayCurrency}
                                        expenses={merchantExpenses}
                                        onShowMore={() =>
                                          showMoreMerchant(
                                            merchant.merchantId,
                                          )
                                        }
                                        visibleCount={
                                          merchantVisibleCount
                                        }
                                      />
                                    ) : null}
                                  </View>
                                );
                              },
                            )}
                          </DrilldownPanel>
                        ) : null}
                      </View>
                    );
                  },
                )}
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  analyticsBlocks: {
    gap: theme.spacing.lg,
  },
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
  categoryAmount: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
    textAlign: 'right',
  },
  categoryCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  categoryGroup: {
    borderBottomColor: theme.colors.border,
    borderBottomWidth: theme.sizes.border,
  },
  categoryList: {
    gap: theme.spacing.xs,
  },
  categoryMarker: {
    borderRadius: theme.radii.round,
    height: theme.sizes.categoryMarker,
    width: theme.sizes.categoryMarker,
  },
  categoryMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.caption,
  },
  categoryName: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  categoryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    minHeight: theme.sizes.floatingButton,
    paddingVertical: theme.spacing.xs,
  },
  content: {
    alignSelf: 'center',
    gap: theme.spacing.lg,
    maxWidth: theme.sizes.maxContentWidth,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    width: '100%',
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
  emoji: {
    fontSize: theme.fontSizes.body,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.body,
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
  drilldownItemDivider: {
    borderBottomColor: theme.colors.border,
    borderBottomWidth: theme.sizes.border,
  },
  drilldownPanel: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    marginBottom: theme.spacing.sm,
    marginLeft: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xxs,
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
  header: {
    alignItems: 'center',
    borderBottomColor: theme.colors.border,
    borderBottomWidth: theme.sizes.border,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
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
  merchantAmount: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
    textAlign: 'right',
  },
  merchantCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  merchantGroup: {
    gap: theme.spacing.xxs,
  },
  merchantMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.small,
  },
  merchantName: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.label,
  },
  merchantRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    minHeight: theme.sizes.iconButton,
  },
  merchantTypeGroup: {
    borderBottomColor: theme.colors.border,
    borderBottomWidth: theme.sizes.border,
  },
  merchantTypeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    minHeight: theme.sizes.floatingButton,
    paddingVertical: theme.spacing.xs,
  },
  merchantTypeList: {
    gap: theme.spacing.xs,
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
  title: {
    color: theme.colors.text,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
  totalBlock: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  totalLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.label,
  },
  unknownHint: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.small,
    paddingBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
});
