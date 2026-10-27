import Feather from '@expo/vector-icons/Feather';
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
import { PeriodSelector } from '../../components/PeriodSelector';
import { ShareBar } from '../../components/ShareBar';
import { useDisplayCurrency } from '../../contexts/DisplayCurrencyContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useColors } from '../../contexts/ThemeContext';
import {
  type AnalyticsExpense,
  buildFixedVariableBreakdown,
  categoryBreakdownByRange,
  type CategoryBreakdown,
  type ExpenseCategoryType,
  type FixedVariableBucketBreakdown,
  type FixedVariableCategoryBreakdown,
  type MerchantBreakdown,
  merchantBreakdownByRange,
  listExpensesForRange,
  type MonthlyCategoryBreakdown,
  type MonthlyMerchantBreakdown,
} from '../../lib/db';
import { localizeCategoryName } from '../../lib/catalog';
import { type Currency, formatMoney } from '../../lib/money';
import {
  type Period,
  periodLabel,
  resolvePeriod,
} from '../../lib/period';
import { theme, type Colors } from '../../lib/theme';

const expensePageSize = 10;
const unknownMerchantKey = 'unknown';

type RankedCategory = {
  amount: number;
  category: CategoryBreakdown;
  color: string;
  share: number;
};

type RankedMerchant = {
  amount: number;
  color: string;
  merchant: MerchantBreakdown;
  share: number;
};

type RankedFixedVariableBucket = {
  amount: number;
  bucket: FixedVariableBucketBreakdown;
  categories: Array<{
    amount: number;
    category: FixedVariableCategoryBreakdown;
  }>;
  color: string;
  emoji: string;
  labelKey: string;
  share: number;
};

type CurrencyTotals = {
  totalRsd: number;
  totalUsd: number;
  totalEur: number;
};

const fixedVariablePresentation = {
  fixed: {
    emoji: '🔒',
    labelKey: 'analytics.fixedLabel',
  },
  variable: {
    emoji: '🔁',
    labelKey: 'analytics.variableLabel',
  },
} satisfies Record<
  ExpenseCategoryType,
  {
    emoji: string;
    labelKey: string;
  }
>;

function amountForCurrency(value: CurrencyTotals, currency: Currency) {
  if (currency === 'USD') {
    return value.totalUsd;
  }

  if (currency === 'EUR') {
    return value.totalEur;
  }

  return value.totalRsd;
}

function colorForKey(
  key: string | null,
  categorical: readonly string[],
  muted: string,
) {
  if (key === null) {
    return muted;
  }

  let hash = 0;
  for (const character of key) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return categorical[hash % categorical.length] ?? muted;
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

function useAnalyticsTheme() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  return { colors, styles };
}

function DrilldownPanel({ children }: { children: ReactNode }) {
  const { styles } = useAnalyticsTheme();
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
  const { t } = useLanguage();
  const { styles } = useAnalyticsTheme();
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
            expense.description.trim() ||
            localizeCategoryName(expense.categoryName, t)
          }
          key={expense.id}
          merchantName={expense.merchantName}
        />
      ))}
      {remaining > 0 ? (
        <Pressable
          accessibilityLabel={t('analytics.showMoreA11y', {
            count: Math.min(expensePageSize, remaining),
          })}
          accessibilityRole="button"
          onPress={onShowMore}
          style={({ pressed }) => [
            styles.showMoreButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.showMoreText}>
            {t('home.showMore', {
              count: Math.min(expensePageSize, remaining),
            })}
          </Text>
        </Pressable>
      ) : null}
    </DrilldownPanel>
  );
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const { colors, styles } = useAnalyticsTheme();
  const {
    currency: displayCurrency,
    setCurrency: setDisplayCurrency,
  } = useDisplayCurrency();
  const [period, setPeriod] = useState<Period>({ kind: 'thisMonth' });
  const [sheetVisible, setSheetVisible] = useState(false);
  const { fromISO, toISO } = useMemo(() => resolvePeriod(period), [period]);
  const [breakdown, setBreakdown] =
    useState<MonthlyCategoryBreakdown | null>(null);
  const [merchantBreakdown, setMerchantBreakdown] =
    useState<MonthlyMerchantBreakdown | null>(null);
  const [analyticsExpenses, setAnalyticsExpenses] = useState<
    AnalyticsExpense[]
  >([]);
  const [expandedExpenseTypes, setExpandedExpenseTypes] = useState<
    Set<ExpenseCategoryType>
  >(() => new Set());
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
      setExpandedExpenseTypes(new Set());
      setCategoryVisibleCounts({});
      setMerchantVisibleCounts({});
      setErrorMessage('');

      void Promise.all([
        categoryBreakdownByRange(fromISO, toISO),
        merchantBreakdownByRange(fromISO, toISO),
        listExpensesForRange(fromISO, toISO),
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
            setErrorMessage(t('analytics.loadFailed'));
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
    }, [fromISO, retryKey, toISO]),
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
        color: colorForKey(
          category.categoryId,
          colors.data.categorical,
          colors.data.muted,
        ),
      }))
      .filter(({ amount }) => amount > 0)
      .sort((left, right) => right.amount - left.amount)
      .map((category) => ({
        ...category,
        share: (category.amount / monthTotal) * 100,
      }));
  }, [breakdown, colors.data, displayCurrency, monthTotal]);
  const merchantTotal = merchantBreakdown
    ? amountForCurrency(merchantBreakdown, displayCurrency)
    : 0;
  const rankedMerchants = useMemo<RankedMerchant[]>(() => {
    if (!merchantBreakdown || merchantTotal <= 0) {
      return [];
    }

    return merchantBreakdown.merchants
      .map((merchant) => ({
        amount: amountForCurrency(merchant, displayCurrency),
        color: colorForKey(
          merchant.merchantId,
          colors.data.categorical,
          colors.data.muted,
        ),
        merchant,
      }))
      .filter(({ amount }) => amount > 0)
      .sort((left, right) => right.amount - left.amount)
      .map((merchant) => ({
        ...merchant,
        share: (merchant.amount / merchantTotal) * 100,
      }));
  }, [colors.data, displayCurrency, merchantBreakdown, merchantTotal]);
  const fixedVariableBreakdown = useMemo(
    () => buildFixedVariableBreakdown(analyticsExpenses),
    [analyticsExpenses],
  );
  const fixedVariableTotal = amountForCurrency(
    fixedVariableBreakdown,
    displayCurrency,
  );
  const rankedFixedVariableBuckets = useMemo<
    RankedFixedVariableBucket[]
  >(
    () =>
      fixedVariableBreakdown.buckets.map((bucket) => {
        const presentation = fixedVariablePresentation[bucket.type];
        const amount = amountForCurrency(bucket, displayCurrency);
        const color =
          bucket.type === 'fixed'
            ? colors.data.categorical[2]
            : colors.data.selection;

        return {
          amount,
          bucket,
          color,
          categories: bucket.categories
            .map((category) => ({
              amount: amountForCurrency(category, displayCurrency),
              category,
            }))
            .sort((left, right) => right.amount - left.amount),
          ...presentation,
          share:
            fixedVariableTotal > 0
              ? (amount / fixedVariableTotal) * 100
              : 0,
        };
      }),
    [colors.data, displayCurrency, fixedVariableBreakdown, fixedVariableTotal],
  );
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
  function openMonthOnHome() {
    if (period.kind !== 'thisMonth' && period.kind !== 'lastMonth') {
      return;
    }

    router.replace({
      pathname: '/(app)',
      params: { month: fromISO.slice(0, 7) },
    });
  }

  function toggleExpenseType(type: ExpenseCategoryType) {
    setExpandedExpenseTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
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
        {period.kind === 'thisMonth' || period.kind === 'lastMonth' ? (
          <Pressable
            accessibilityLabel={t('analytics.backA11y')}
            accessibilityRole="button"
            onPress={openMonthOnHome}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.backText}>←</Text>
          </Pressable>
        ) : null}
        <Text style={styles.title}>{t('nav.analytics')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityLabel={t('period.title')}
          accessibilityRole="button"
          onPress={() => setSheetVisible(true)}
          style={({ pressed }) => [
            styles.periodButton,
            pressed && styles.pressed,
          ]}
        >
          <Text numberOfLines={1} style={styles.periodTitle}>
            {periodLabel(period, locale, t)}
          </Text>
          <Feather
            color={colors.icon.primary}
            name="chevron-down"
            size={theme.scale.size.iconMd}
          />
        </Pressable>

        <CurrencySelector
          accessibilityLabel={t('analytics.currencyA11y')}
          onChange={setDisplayCurrency}
          value={displayCurrency}
        />

        <View style={styles.totalBlock}>
          <Text style={styles.totalLabel}>{t('analytics.monthTotal')}</Text>
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
              <Text style={styles.retryText}>{t('home.retry')}</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? <LoadingScreen compact /> : null}

        {!loading && !errorMessage && rankedCategories.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('analytics.empty')}</Text>
          </View>
        ) : null}

        {!loading && !errorMessage && rankedCategories.length > 0 ? (
          <View style={styles.analyticsBlocks}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('analytics.byCategory')}
              </Text>
              <ShareBar
                accessibilityLabel={t('analytics.byCategoryA11y')}
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
                          accessibilityLabel={t('analytics.sliceA11y', {
                            name: localizeCategoryName(category.name, t),
                            amount: formatMoney(amount),
                            currency: displayCurrency,
                            share: formatShare(share),
                            count: category.count,
                          })}
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
                              {localizeCategoryName(category.name, t)}
                            </Text>
                            <Text style={styles.categoryMeta}>
                              {t('analytics.shareOps', {
                                share: formatShare(share),
                                count: category.count,
                              })}
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
              <Text style={styles.sectionTitle}>
                {t('analytics.byMerchant')}
              </Text>
              <ShareBar
                accessibilityLabel={t('analytics.byMerchantA11y')}
                segments={rankedMerchants.map(
                  ({ amount, color, merchant }) => ({
                    id: merchant.merchantId ?? unknownMerchantKey,
                    amount,
                    color,
                  }),
                )}
              />

              <View style={styles.categoryList}>
                {rankedMerchants.map(
                  ({ amount, color, merchant, share }) => {
                    const merchantKey =
                      merchant.merchantId ?? unknownMerchantKey;
                    const visibleCount =
                      merchantVisibleCounts[merchantKey];
                    const expanded = visibleCount !== undefined;
                    const merchantExpenses =
                      expensesByMerchant.get(merchantKey) ?? [];

                    return (
                      <View
                        key={merchantKey}
                        style={styles.categoryGroup}
                      >
                        <Pressable
                          accessibilityLabel={t('analytics.sliceA11y', {
                            name: merchant.name ?? t('analytics.noPlace'),
                            amount: formatMoney(amount),
                            currency: displayCurrency,
                            share: formatShare(share),
                            count: merchant.count,
                          })}
                          accessibilityRole="button"
                          accessibilityState={{ expanded }}
                          onPress={() =>
                            toggleMerchant(merchant.merchantId)
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
                          <View style={styles.categoryCopy}>
                            <Text
                              numberOfLines={1}
                              style={styles.categoryName}
                            >
                              {merchant.name ?? t('analytics.noPlace')}
                            </Text>
                            <Text style={styles.categoryMeta}>
                              {t('analytics.shareOps', {
                                share: formatShare(share),
                                count: merchant.count,
                              })}
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
                            expenses={merchantExpenses}
                            onShowMore={() =>
                              showMoreMerchant(merchant.merchantId)
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
              <Text style={styles.sectionTitle}>
                {t('analytics.fixedVariable')}
              </Text>
              <ShareBar
                accessibilityLabel={t('analytics.byTypeA11y')}
                segments={rankedFixedVariableBuckets.map(
                  ({ amount, bucket, color }) => ({
                    id: bucket.type,
                    amount,
                    color,
                  }),
                )}
              />

              <View style={styles.categoryList}>
                {rankedFixedVariableBuckets.map(
                  ({
                    amount,
                    bucket,
                    categories,
                    color,
                    emoji,
                    labelKey,
                    share,
                  }) => {
                    const expanded = expandedExpenseTypes.has(
                      bucket.type,
                    );
                    const label = t(labelKey);

                    return (
                      <View
                        key={bucket.type}
                        style={styles.categoryGroup}
                      >
                        <Pressable
                          accessibilityLabel={t('analytics.sliceA11y', {
                            name: label,
                            amount: formatMoney(amount),
                            currency: displayCurrency,
                            share: formatShare(share),
                            count: bucket.count,
                          })}
                          accessibilityRole="button"
                          accessibilityState={{ expanded }}
                          onPress={() =>
                            toggleExpenseType(bucket.type)
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
                          <Text style={styles.emoji}>{emoji}</Text>
                          <View style={styles.categoryCopy}>
                            <Text
                              numberOfLines={1}
                              style={styles.categoryName}
                            >
                              {label}
                            </Text>
                            <Text style={styles.categoryMeta}>
                              {t('analytics.shareOps', {
                                share: formatShare(share),
                                count: bucket.count,
                              })}
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

                        {expanded && categories.length > 0 ? (
                          <DrilldownPanel>
                            {categories.map(
                              ({ amount: categoryAmount, category }) => (
                                <View
                                  key={category.categoryId}
                                  style={styles.merchantRow}
                                >
                                  <Text style={styles.emoji}>
                                    {category.emoji}
                                  </Text>
                                  <View style={styles.merchantCopy}>
                                    <Text
                                      numberOfLines={1}
                                      style={styles.merchantName}
                                    >
                                      {localizeCategoryName(category.name, t)}
                                    </Text>
                                    <Text style={styles.merchantMeta}>
                                      {t('analytics.operations', {
                                        count: category.count,
                                      })}
                                    </Text>
                                  </View>
                                  <Text style={styles.merchantAmount}>
                                    {formatMoney(categoryAmount)}{' '}
                                    {displayCurrency}
                                  </Text>
                                </View>
                              ),
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

      <PeriodSelector
        onClose={() => setSheetVisible(false)}
        onSelect={(selectedPeriod) => {
          setPeriod(selectedPeriod);
          setSheetVisible(false);
        }}
        period={period}
        visible={sheetVisible}
      />
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
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
    color: c.text.primary,
    fontSize: theme.fontSizes.title,
  },
  categoryAmount: {
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
    textAlign: 'right',
  },
  categoryCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  categoryGroup: {
    borderBottomColor: c.border.default,
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
    color: c.text.secondary,
    fontSize: theme.fontSizes.caption,
  },
  categoryName: {
    color: c.text.primary,
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
  emoji: {
    fontSize: theme.fontSizes.body,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyText: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.body,
    textAlign: 'center',
  },
  errorState: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  errorText: {
    color: c.status.error.content,
    fontSize: theme.fontSizes.caption,
    textAlign: 'center',
  },
  drilldownItemDivider: {
    borderBottomColor: c.border.default,
    borderBottomWidth: theme.sizes.border,
  },
  drilldownPanel: {
    backgroundColor: c.surface.default,
    borderRadius: theme.radii.card,
    marginBottom: theme.spacing.sm,
    marginLeft: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xxs,
  },
  expandIcon: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.body,
    textAlign: 'center',
    width: theme.spacing.md,
  },
  expandIconExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  header: {
    alignItems: 'center',
    borderBottomColor: c.border.default,
    borderBottomWidth: theme.sizes.border,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  periodButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.scale.space[2],
    paddingVertical: theme.scale.space[1],
  },
  periodTitle: {
    ...theme.type.titleScreen,
    color: c.text.primary,
    flexShrink: 1,
  },
  merchantAmount: {
    color: c.text.primary,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
    textAlign: 'right',
  },
  merchantCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  merchantMeta: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.small,
  },
  merchantName: {
    color: c.text.primary,
    fontSize: theme.fontSizes.label,
  },
  merchantRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    minHeight: theme.sizes.iconButton,
  },
  monthTotal: {
    color: c.text.primary,
    fontSize: theme.fontSizes.monthTotal,
    fontWeight: '700',
    textAlign: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  retryText: {
    color: c.action.link.rest,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  rowPressed: {
    backgroundColor: c.surface.default,
  },
  screen: {
    backgroundColor: c.bg.base,
    flex: 1,
  },
  section: {
    gap: theme.spacing.md,
  },
  sectionTitle: {
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
  showMoreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.sizes.iconButton,
  },
  showMoreText: {
    color: c.action.link.rest,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  title: {
    color: c.text.primary,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
  totalBlock: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  totalLabel: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.label,
  },
});
