import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Children,
  type ReactNode,
  useCallback,
  useEffect,
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
import { AnalyticsCurrencyPicker } from '../../components/AnalyticsCurrencyPicker';
import { ExpenseMiniRow } from '../../components/ExpenseMiniRow';
import { LoadingScreen } from '../../components/LoadingScreen';
import { PeriodSelector } from '../../components/PeriodSelector';
import { ShareBar } from '../../components/ShareBar';
import { StatusBanner } from '../../components/ds/StatusBanner';
import { useDisplayCurrency } from '../../contexts/DisplayCurrencyContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useColors } from '../../contexts/ThemeContext';
import {
  displayAnalyticsExpenseAmount,
  displayCategoryBreakdown,
  displayFixedVariableBreakdown,
  displayMerchantBreakdown,
} from '../../lib/analyticsDisplay';
import {
  fetchAnchorRatesForRange,
  pickRateOnOrBefore,
  type AnchorRate,
} from '../../lib/anchorRates';
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
import { ANCHOR_DISPLAY } from '../../lib/features';
import { ANCHOR_CURRENCY } from '../../lib/fxDisplay';
import { SUPPORTED_HOME_CURRENCIES } from '../../lib/homeCurrency';
import type { RateLookup } from '../../lib/homeDisplay';
import { localizeCategoryName } from '../../lib/catalog';
import { todayLocalISO } from '../../lib/dates';
import { type Currency, formatMoney, isCurrency } from '../../lib/money';
import {
  type Period,
  periodLabel,
  resolvePeriod,
} from '../../lib/period';
import { theme, type Colors } from '../../lib/theme';

const expensePageSize = 10;
const millisecondsPerDay = 86_400_000;
const topBreakdownCount = 6;
const unknownMerchantKey = 'unknown';

type AnalyticsTab = 'categories' | 'merchants' | 'fixedVariable';
type SortMode = 'amount' | 'count' | 'name';

type RankedCategory = {
  amount: number | null;
  category: CategoryBreakdown;
  color: string;
  share: number;
};

type RankedMerchant = {
  amount: number | null;
  color: string;
  merchant: MerchantBreakdown;
  share: number;
};

type RankedFixedVariableBucket = {
  amount: number | null;
  bucket: FixedVariableBucketBreakdown;
  categories: Array<{
    amount: number | null;
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

type AnchorRateCache = {
  key: string;
  rates: AnchorRate[];
};

const analyticsTabs = [
  { labelKey: 'analytics.tabCategories', value: 'categories' },
  { labelKey: 'analytics.tabMerchants', value: 'merchants' },
  { labelKey: 'analytics.tabFixedVariable', value: 'fixedVariable' },
] as const satisfies readonly {
  labelKey: string;
  value: AnalyticsTab;
}[];

const sortOptions = [
  { labelKey: 'analytics.sortByAmount', value: 'amount' },
  { labelKey: 'analytics.sortByCount', value: 'count' },
  { labelKey: 'analytics.sortByName', value: 'name' },
] as const satisfies readonly {
  labelKey: string;
  value: SortMode;
}[];

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
    return expense.amountEur ?? 0;
  }

  return expense.amountRsd;
}

function formatAnalyticsAmount(amount: number | null): string {
  return amount === null ? '—' : formatMoney(amount);
}

function formatAnalyticsAverage(
  amount: number | null,
  count: number,
): string {
  return amount === null
    ? '—'
    : formatMoney(Math.round(amount / Math.max(count, 1)));
}

type ExpenseDetailsProps = {
  currency: string;
  expenses: AnalyticsExpense[];
  onShowMore: () => void;
  rateAt: RateLookup;
  visibleCount: number;
};

function useAnalyticsTheme() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  return { colors, styles };
}

type TypeTabsProps = {
  value: AnalyticsTab;
  onChange: (value: AnalyticsTab) => void;
};

function TypeTabs({ value, onChange }: TypeTabsProps) {
  const { t } = useLanguage();
  const { styles } = useAnalyticsTheme();

  return (
    <View accessibilityRole="radiogroup" style={styles.typeTabs}>
      {analyticsTabs.map((tab) => {
        const selected = tab.value === value;

        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            key={tab.value}
            onPress={() => onChange(tab.value)}
            style={({ pressed }) => [
              styles.typeTab,
              selected && styles.typeTabSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.typeTabText,
                selected && styles.typeTabTextSelected,
              ]}
            >
              {t(tab.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type SortTabsProps = {
  value: SortMode;
  onChange: (value: SortMode) => void;
};

function SortTabs({ value, onChange }: SortTabsProps) {
  const { t } = useLanguage();
  const { styles } = useAnalyticsTheme();

  return (
    <View
      accessibilityLabel={t('analytics.sortLabel')}
      accessibilityRole="radiogroup"
      style={styles.typeTabs}
    >
      {sortOptions.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.typeTab,
              selected && styles.typeTabSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.typeTabText,
                selected && styles.typeTabTextSelected,
              ]}
            >
              {t(option.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
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
  rateAt,
  visibleCount,
}: ExpenseDetailsProps) {
  const { t } = useLanguage();
  const { styles } = useAnalyticsTheme();
  const visibleExpenses = expenses.slice(0, visibleCount);
  const remaining = expenses.length - visibleExpenses.length;

  return (
    <DrilldownPanel>
      {visibleExpenses.map((expense) => {
        const anchorAmount = ANCHOR_DISPLAY
          ? displayAnalyticsExpenseAmount(expense, currency, rateAt)
          : null;
        const amountCents = ANCHOR_DISPLAY
          ? anchorAmount ?? expense.originalAmountCents
          : amountForExpense(
              expense,
              isCurrency(currency) ? currency : 'RSD',
            );
        const amountCurrency =
          ANCHOR_DISPLAY && anchorAmount === null
            ? expense.originalCurrency
            : currency;

        return (
          <ExpenseMiniRow
            amountCents={amountCents}
            currency={amountCurrency}
            date={expense.occurredOn}
            description={
              expense.description.trim() ||
              localizeCategoryName(expense.categoryName, t)
            }
            key={expense.id}
            merchantName={expense.merchantName}
          />
        );
      })}
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
  const [activeTab, setActiveTab] =
    useState<AnalyticsTab>('categories');
  const [sortMode, setSortMode] = useState<SortMode>('amount');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllMerchants, setShowAllMerchants] = useState(false);
  const { fromISO, toISO } = useMemo(() => resolvePeriod(period), [period]);
  const [breakdown, setBreakdown] =
    useState<MonthlyCategoryBreakdown | null>(null);
  const [merchantBreakdown, setMerchantBreakdown] =
    useState<MonthlyMerchantBreakdown | null>(null);
  const [analyticsExpenses, setAnalyticsExpenses] = useState<
    AnalyticsExpense[]
  >([]);
  const [analyticsExpenseRangeKey, setAnalyticsExpenseRangeKey] =
    useState('');
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
  const [anchorRateCache, setAnchorRateCache] = useState<AnchorRateCache>({
    key: '',
    rates: [],
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setBreakdown(null);
      setMerchantBreakdown(null);
      setAnalyticsExpenses([]);
      setAnalyticsExpenseRangeKey('');
      setExpandedExpenseTypes(new Set());
      setCategoryVisibleCounts({});
      setMerchantVisibleCounts({});
      setErrorMessage('');

      void (async () => {
        if (ANCHOR_DISPLAY) {
          const loadedExpenses = await listExpensesForRange(fromISO, toISO);
          if (active) {
            setAnalyticsExpenses(loadedExpenses);
            setAnalyticsExpenseRangeKey(`${fromISO}:${toISO}`);
          }
          return;
        }

        const [
          loadedBreakdown,
          loadedMerchantBreakdown,
          loadedExpenses,
        ] = await Promise.all([
          categoryBreakdownByRange(fromISO, toISO),
          merchantBreakdownByRange(fromISO, toISO),
          listExpensesForRange(fromISO, toISO),
        ]);
        if (active) {
          setBreakdown(loadedBreakdown);
          setMerchantBreakdown(loadedMerchantBreakdown);
          setAnalyticsExpenses(loadedExpenses);
          setAnalyticsExpenseRangeKey(`${fromISO}:${toISO}`);
        }
      })()
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

  const anchorRateKey = `${fromISO}:${toISO}:${displayCurrency}`;
  const analyticsRangeKey = `${fromISO}:${toISO}`;
  const needsAnchorRates =
    ANCHOR_DISPLAY &&
    analyticsExpenseRangeKey === analyticsRangeKey &&
    displayCurrency !== ANCHOR_CURRENCY &&
    analyticsExpenses.some(
      (expense) =>
        expense.amountEur !== null &&
        expense.originalCurrency.trim().toUpperCase() !== displayCurrency,
    );

  useEffect(() => {
    if (!needsAnchorRates) {
      return;
    }

    let active = true;
    setAnchorRateCache({ key: '', rates: [] });

    void fetchAnchorRatesForRange(displayCurrency, fromISO, toISO)
      .then((rates) => {
        if (active) {
          setAnchorRateCache({ key: anchorRateKey, rates });
        }
      })
      .catch((error: unknown) => {
        console.error('Unable to load analytics anchor FX rates:', error);
        if (active) {
          setAnchorRateCache({ key: anchorRateKey, rates: [] });
        }
      });

    return () => {
      active = false;
    };
  }, [anchorRateKey, displayCurrency, fromISO, needsAnchorRates, toISO]);

  const rateAt = useMemo<RateLookup>(() => {
    if (
      displayCurrency === ANCHOR_CURRENCY ||
      anchorRateCache.key !== anchorRateKey
    ) {
      return () => null;
    }

    return (dateISO) =>
      pickRateOnOrBefore(
        anchorRateCache.rates,
        displayCurrency,
        dateISO,
      )?.ratePerEur ?? null;
  }, [anchorRateCache, anchorRateKey, displayCurrency]);
  const analyticsLoading =
    loading ||
    (ANCHOR_DISPLAY &&
      needsAnchorRates &&
      anchorRateCache.key !== anchorRateKey);

  const legacyDisplayCurrency: Currency = isCurrency(displayCurrency)
    ? displayCurrency
    : 'RSD';
  const anchorCategoryData = useMemo(
    () =>
      ANCHOR_DISPLAY
        ? displayCategoryBreakdown(
            analyticsExpenses,
            displayCurrency,
            rateAt,
          )
        : null,
    [analyticsExpenses, displayCurrency, rateAt],
  );
  const monthTotal = ANCHOR_DISPLAY
    ? anchorCategoryData?.total ?? null
    : breakdown
      ? amountForCurrency(breakdown, legacyDisplayCurrency)
      : 0;
  const spendingPace = useMemo(() => {
    if (monthTotal === null || monthTotal <= 0) {
      return null;
    }

    const rangeDays =
      Math.round(
        (Date.parse(toISO) - Date.parse(fromISO)) / millisecondsPerDay,
      ) + 1;

    if (period.kind === 'thisMonth') {
      const daysElapsed = Number(todayLocalISO().slice(8, 10));
      const daysInMonth = Number(toISO.slice(8, 10));
      const dailyAverage = monthTotal / Math.max(daysElapsed, 1);

      return {
        dailyAverage,
        projectedTotal:
          daysElapsed < daysInMonth
            ? dailyAverage * daysInMonth
            : null,
      };
    }

    return {
      dailyAverage: monthTotal / Math.max(rangeDays, 1),
      projectedTotal: null,
    };
  }, [fromISO, monthTotal, period.kind, toISO]);
  const rankedCategories = useMemo<RankedCategory[]>(() => {
    if (
      ANCHOR_DISPLAY
        ? !anchorCategoryData
        : !breakdown || monthTotal === null || monthTotal <= 0
    ) {
      return [];
    }

    const rows = ANCHOR_DISPLAY
      ? (anchorCategoryData?.categories ?? []).map((category) => ({
          amount: category.amount,
          category: {
            categoryId: category.categoryId,
            count: category.count,
            emoji: category.emoji,
            group: category.group,
            name: category.name,
            totalEur: 0,
            totalRsd: 0,
            totalUsd: 0,
          },
        }))
      : (breakdown?.categories ?? []).map((category) => ({
          amount: amountForCurrency(category, legacyDisplayCurrency),
          category,
        }));

    return rows
      .filter(({ amount }) =>
        ANCHOR_DISPLAY
          ? amount === null || amount > 0
          : (amount ?? 0) > 0,
      )
      .sort((left, right) => {
        if (sortMode === 'count') {
          return (
            right.category.count - left.category.count ||
            (right.amount ?? -1) - (left.amount ?? -1)
          );
        }

        if (sortMode === 'name') {
          const leftName = localizeCategoryName(left.category.name, t);
          const rightName = localizeCategoryName(right.category.name, t);
          return leftName.localeCompare(rightName, locale);
        }

        return (right.amount ?? -1) - (left.amount ?? -1);
      })
      .map((category, index) => ({
        ...category,
        color:
          index < topBreakdownCount
            ? colors.data.categorical[index] ?? colors.data.muted
            : colors.data.muted,
        share:
          category.amount !== null && monthTotal !== null && monthTotal > 0
            ? (category.amount / monthTotal) * 100
            : 0,
      }));
  }, [
    anchorCategoryData,
    breakdown,
    colors.data,
    legacyDisplayCurrency,
    locale,
    monthTotal,
    sortMode,
    t,
  ]);
  const anchorMerchantData = useMemo(
    () =>
      ANCHOR_DISPLAY
        ? displayMerchantBreakdown(
            analyticsExpenses,
            displayCurrency,
            rateAt,
          )
        : null,
    [analyticsExpenses, displayCurrency, rateAt],
  );
  const merchantTotal = ANCHOR_DISPLAY
    ? anchorMerchantData?.total ?? null
    : merchantBreakdown
      ? amountForCurrency(merchantBreakdown, legacyDisplayCurrency)
      : 0;
  const rankedMerchants = useMemo<RankedMerchant[]>(() => {
    if (
      ANCHOR_DISPLAY
        ? !anchorMerchantData
        : !merchantBreakdown || merchantTotal === null || merchantTotal <= 0
    ) {
      return [];
    }

    const rows = ANCHOR_DISPLAY
      ? (anchorMerchantData?.merchants ?? []).map((merchant) => ({
          amount: merchant.amount,
          merchant: {
            count: merchant.count,
            merchantId: merchant.merchantId,
            name: merchant.name,
            totalEur: 0,
            totalRsd: 0,
            totalUsd: 0,
          },
        }))
      : (merchantBreakdown?.merchants ?? []).map((merchant) => ({
          amount: amountForCurrency(merchant, legacyDisplayCurrency),
          merchant,
        }));

    return rows
      .filter(({ amount }) =>
        ANCHOR_DISPLAY
          ? amount === null || amount > 0
          : (amount ?? 0) > 0,
      )
      .sort((left, right) => {
        if (sortMode === 'count') {
          return (
            right.merchant.count - left.merchant.count ||
            (right.amount ?? -1) - (left.amount ?? -1)
          );
        }

        if (sortMode === 'name') {
          const leftUnknown =
            left.merchant.merchantId === null ||
            left.merchant.name === null;
          const rightUnknown =
            right.merchant.merchantId === null ||
            right.merchant.name === null;

          if (leftUnknown !== rightUnknown) {
            return leftUnknown ? 1 : -1;
          }

          const leftName = left.merchant.name ?? t('analytics.noPlace');
          const rightName = right.merchant.name ?? t('analytics.noPlace');
          return leftName.localeCompare(rightName, locale);
        }

        return (right.amount ?? -1) - (left.amount ?? -1);
      })
      .map((merchant, index) => ({
        ...merchant,
        color:
          index < topBreakdownCount
            ? colors.data.categorical[index] ?? colors.data.muted
            : colors.data.muted,
        share:
          merchant.amount !== null &&
          merchantTotal !== null &&
          merchantTotal > 0
            ? (merchant.amount / merchantTotal) * 100
            : 0,
      }));
  }, [
    anchorMerchantData,
    colors.data,
    legacyDisplayCurrency,
    locale,
    merchantBreakdown,
    merchantTotal,
    sortMode,
    t,
  ]);
  const fixedVariableBreakdown = useMemo(
    () => buildFixedVariableBreakdown(analyticsExpenses),
    [analyticsExpenses],
  );
  const anchorFixedVariableData = useMemo(
    () =>
      ANCHOR_DISPLAY
        ? displayFixedVariableBreakdown(
            analyticsExpenses,
            displayCurrency,
            rateAt,
          )
        : null,
    [analyticsExpenses, displayCurrency, rateAt],
  );
  const fixedVariableTotal = ANCHOR_DISPLAY
    ? anchorFixedVariableData?.total ?? null
    : amountForCurrency(fixedVariableBreakdown, legacyDisplayCurrency);
  const rankedFixedVariableBuckets = useMemo<
    RankedFixedVariableBucket[]
  >(
    () => {
      const buckets = ANCHOR_DISPLAY
        ? (anchorFixedVariableData?.buckets ?? []).map((bucket) => ({
            amount: bucket.amount,
            bucket: {
              categories: bucket.categories.map((category) => ({
                categoryId: category.categoryId,
                count: category.count,
                emoji: category.emoji,
                name: category.name,
                totalEur: 0,
                totalRsd: 0,
                totalUsd: 0,
              })),
              count: bucket.count,
              totalEur: 0,
              totalRsd: 0,
              totalUsd: 0,
              type: bucket.type,
            },
            categoryAmounts: new Map(
              bucket.categories.map((category) => [
                category.categoryId,
                category.amount,
              ]),
            ),
          }))
        : fixedVariableBreakdown.buckets.map((bucket) => ({
            amount: amountForCurrency(bucket, legacyDisplayCurrency),
            bucket,
            categoryAmounts: null,
          }));

      return buckets.map(({ amount, bucket, categoryAmounts }) => {
        const presentation = fixedVariablePresentation[bucket.type];
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
              amount: ANCHOR_DISPLAY
                ? categoryAmounts?.get(category.categoryId) ?? null
                : amountForCurrency(category, legacyDisplayCurrency),
              category,
            }))
            .sort(
              (left, right) =>
                (right.amount ?? -1) - (left.amount ?? -1),
            ),
          ...presentation,
          share:
            amount !== null &&
            fixedVariableTotal !== null &&
            fixedVariableTotal > 0
              ? (amount / fixedVariableTotal) * 100
              : 0,
        };
      });
    },
    [
      anchorFixedVariableData,
      colors.data,
      fixedVariableBreakdown,
      fixedVariableTotal,
      legacyDisplayCurrency,
    ],
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
  const topCategories = useMemo(
    () => rankedCategories.slice(0, topBreakdownCount),
    [rankedCategories],
  );
  const topMerchants = useMemo(
    () => rankedMerchants.slice(0, topBreakdownCount),
    [rankedMerchants],
  );
  const otherCategories = useMemo(() => {
    const remainder = rankedCategories.slice(topBreakdownCount);

    if (remainder.length === 0) {
      return null;
    }

    return remainder.reduce<{
      amount: number | null;
      count: number;
      share: number;
    }>(
      (summary, row) => ({
        amount:
          summary.amount === null || row.amount === null
            ? null
            : summary.amount + row.amount,
        count: summary.count + row.category.count,
        share: summary.share + row.share,
      }),
      { amount: 0, count: 0, share: 0 },
    );
  }, [rankedCategories]);
  const otherMerchants = useMemo(() => {
    const remainder = rankedMerchants.slice(topBreakdownCount);

    if (remainder.length === 0) {
      return null;
    }

    return remainder.reduce<{
      amount: number | null;
      count: number;
      share: number;
    }>(
      (summary, row) => ({
        amount:
          summary.amount === null || row.amount === null
            ? null
            : summary.amount + row.amount,
        count: summary.count + row.merchant.count,
        share: summary.share + row.share,
      }),
      { amount: 0, count: 0, share: 0 },
    );
  }, [rankedMerchants]);
  const categoryShareSegments = useMemo(
    () =>
      ANCHOR_DISPLAY && monthTotal === null
        ? []
        : [
            ...topCategories.flatMap(({ amount, category, color }) =>
              amount === null
                ? []
                : [{ id: category.categoryId, amount, color }],
            ),
            ...(otherCategories && otherCategories.amount !== null
              ? [
                  {
                    id: 'category-other',
                    amount: otherCategories.amount,
                    color: colors.data.muted,
                  },
                ]
              : []),
          ],
    [colors.data.muted, monthTotal, otherCategories, topCategories],
  );
  const merchantShareSegments = useMemo(
    () =>
      ANCHOR_DISPLAY && merchantTotal === null
        ? []
        : [
            ...topMerchants.flatMap(({ amount, color, merchant }) =>
              amount === null
                ? []
                : [
                    {
                      id: merchant.merchantId ?? unknownMerchantKey,
                      amount,
                      color,
                    },
                  ],
            ),
            ...(otherMerchants && otherMerchants.amount !== null
              ? [
                  {
                    id: 'merchant-other',
                    amount: otherMerchants.amount,
                    color: colors.data.muted,
                  },
                ]
              : []),
          ],
    [colors.data.muted, merchantTotal, otherMerchants, topMerchants],
  );
  const visibleCategories = showAllCategories
    ? rankedCategories
    : topCategories;
  const visibleMerchants = showAllMerchants
    ? rankedMerchants
    : topMerchants;

  function handleTabChange(tab: AnalyticsTab) {
    if (tab === activeTab) {
      return;
    }

    setActiveTab(tab);
    setShowAllCategories(false);
    setShowAllMerchants(false);
  }

  function handlePeriodSelect(selectedPeriod: Period) {
    setPeriod(selectedPeriod);
    setShowAllCategories(false);
    setShowAllMerchants(false);
    setSheetVisible(false);
  }

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

        {ANCHOR_DISPLAY ? (
          <AnalyticsCurrencyPicker
            accessibilityLabel={t('analytics.currencyA11y')}
            onChange={setDisplayCurrency}
            options={SUPPORTED_HOME_CURRENCIES}
            value={displayCurrency}
          />
        ) : (
          <CurrencySelector
            accessibilityLabel={t('analytics.currencyA11y')}
            onChange={setDisplayCurrency}
            value={legacyDisplayCurrency}
          />
        )}

        <View style={styles.totalBlock}>
          <Text style={styles.totalLabel}>{t('analytics.periodTotal')}</Text>
          <Text style={styles.monthTotal}>
            {formatAnalyticsAmount(monthTotal)} {displayCurrency}
          </Text>
          {!analyticsLoading && !errorMessage && spendingPace ? (
            <Text numberOfLines={1} style={styles.paceLine}>
              {t('analytics.pacePerDay', {
                amount: formatMoney(Math.round(spendingPace.dailyAverage)),
              })}
              {spendingPace.projectedTotal !== null
                ? ` · ${t('analytics.projection', {
                    amount: formatMoney(
                      Math.round(spendingPace.projectedTotal),
                    ),
                  })}`
                : ''}{' '}
              {displayCurrency}
            </Text>
          ) : null}
        </View>

        {errorMessage ? (
          <StatusBanner
            action={{
              label: t('home.retry'),
              onPress: () => setRetryKey((current) => current + 1),
            }}
            message={errorMessage}
            tone="error"
          />
        ) : null}

        {analyticsLoading ? <LoadingScreen compact /> : null}

        {!analyticsLoading && !errorMessage && rankedCategories.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('analytics.empty')}</Text>
          </View>
        ) : null}

        {!analyticsLoading && !errorMessage && rankedCategories.length > 0 ? (
          <>
            <TypeTabs onChange={handleTabChange} value={activeTab} />

            <View style={styles.analyticsBlocks}>
              {activeTab === 'categories' ? (
                <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('analytics.byCategory')}
              </Text>
              <ShareBar
                accessibilityLabel={t('analytics.byCategoryA11y')}
                segments={categoryShareSegments}
              />
              <SortTabs onChange={setSortMode} value={sortMode} />

              <View style={styles.categoryList}>
                {visibleCategories.map(
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
                            amount: formatAnalyticsAmount(amount),
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
                              {t('analytics.shareOpsAvg', {
                                share: formatShare(share),
                                count: category.count,
                                avg: formatAnalyticsAverage(
                                  amount,
                                  category.count,
                                ),
                              })}
                            </Text>
                          </View>
                          <Text style={styles.categoryAmount}>
                            {formatAnalyticsAmount(amount)} {displayCurrency}
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
                            rateAt={rateAt}
                            visibleCount={visibleCount}
                          />
                        ) : null}
                      </View>
                    );
                  },
                )}
                {!showAllCategories && otherCategories ? (
                  <View
                    accessible
                    accessibilityLabel={t('analytics.sliceA11y', {
                      name: t('analytics.otherCategories'),
                      amount: formatAnalyticsAmount(otherCategories.amount),
                      currency: displayCurrency,
                      share: formatShare(otherCategories.share),
                      count: otherCategories.count,
                    })}
                    style={styles.categoryGroup}
                  >
                    <View style={styles.categoryRow}>
                      <View
                        style={[
                          styles.categoryMarker,
                          { backgroundColor: colors.data.muted },
                        ]}
                      />
                      <View style={styles.otherEmojiSpacer} />
                      <View style={styles.categoryCopy}>
                        <Text
                          numberOfLines={1}
                          style={styles.categoryName}
                        >
                          {t('analytics.otherCategories')}
                        </Text>
                        <Text style={styles.categoryMeta}>
                          {t('analytics.shareOpsAvg', {
                            share: formatShare(otherCategories.share),
                            count: otherCategories.count,
                            avg: formatAnalyticsAverage(
                              otherCategories.amount,
                              otherCategories.count,
                            ),
                          })}
                        </Text>
                      </View>
                      <Text style={styles.categoryAmount}>
                        {formatAnalyticsAmount(otherCategories.amount)}{' '}
                        {displayCurrency}
                      </Text>
                    </View>
                  </View>
                ) : null}
                {otherCategories ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      setShowAllCategories((current) => !current)
                    }
                    style={({ pressed }) => [
                      styles.showMoreButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.showMoreText}>
                      {t(
                        showAllCategories
                          ? 'analytics.collapse'
                          : 'analytics.showAll',
                      )}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
                </View>
              ) : null}

              {activeTab === 'merchants' ? (
                <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('analytics.byMerchant')}
              </Text>
              <ShareBar
                accessibilityLabel={t('analytics.byMerchantA11y')}
                segments={merchantShareSegments}
              />
              <SortTabs onChange={setSortMode} value={sortMode} />

              <View style={styles.categoryList}>
                {visibleMerchants.map(
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
                            amount: formatAnalyticsAmount(amount),
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
                              {t('analytics.shareOpsAvg', {
                                share: formatShare(share),
                                count: merchant.count,
                                avg: formatAnalyticsAverage(
                                  amount,
                                  merchant.count,
                                ),
                              })}
                            </Text>
                          </View>
                          <Text style={styles.categoryAmount}>
                            {formatAnalyticsAmount(amount)} {displayCurrency}
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
                            rateAt={rateAt}
                            visibleCount={visibleCount}
                          />
                        ) : null}
                      </View>
                    );
                  },
                )}
                {!showAllMerchants && otherMerchants ? (
                  <View
                    accessible
                    accessibilityLabel={t('analytics.sliceA11y', {
                      name: t('analytics.otherCategories'),
                      amount: formatAnalyticsAmount(otherMerchants.amount),
                      currency: displayCurrency,
                      share: formatShare(otherMerchants.share),
                      count: otherMerchants.count,
                    })}
                    style={styles.categoryGroup}
                  >
                    <View style={styles.categoryRow}>
                      <View
                        style={[
                          styles.categoryMarker,
                          { backgroundColor: colors.data.muted },
                        ]}
                      />
                      <View style={styles.categoryCopy}>
                        <Text
                          numberOfLines={1}
                          style={styles.categoryName}
                        >
                          {t('analytics.otherCategories')}
                        </Text>
                        <Text style={styles.categoryMeta}>
                          {t('analytics.shareOpsAvg', {
                            share: formatShare(otherMerchants.share),
                            count: otherMerchants.count,
                            avg: formatAnalyticsAverage(
                              otherMerchants.amount,
                              otherMerchants.count,
                            ),
                          })}
                        </Text>
                      </View>
                      <Text style={styles.categoryAmount}>
                        {formatAnalyticsAmount(otherMerchants.amount)}{' '}
                        {displayCurrency}
                      </Text>
                    </View>
                  </View>
                ) : null}
                {otherMerchants ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      setShowAllMerchants((current) => !current)
                    }
                    style={({ pressed }) => [
                      styles.showMoreButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.showMoreText}>
                      {t(
                        showAllMerchants
                          ? 'analytics.collapse'
                          : 'analytics.showAll',
                      )}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
                </View>
              ) : null}

              {activeTab === 'fixedVariable' ? (
                <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('analytics.fixedVariable')}
              </Text>
              <ShareBar
                accessibilityLabel={t('analytics.byTypeA11y')}
                segments={
                  ANCHOR_DISPLAY && fixedVariableTotal === null
                    ? []
                    : rankedFixedVariableBuckets.flatMap(
                        ({ amount, bucket, color }) =>
                          amount === null
                            ? []
                            : [{ id: bucket.type, amount, color }],
                      )
                }
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
                            amount: formatAnalyticsAmount(amount),
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
                            {formatAnalyticsAmount(amount)} {displayCurrency}
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
                                    {formatAnalyticsAmount(categoryAmount)}{' '}
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
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>

      <PeriodSelector
        onClose={() => setSheetVisible(false)}
        onSelect={handlePeriodSelect}
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
  paceLine: {
    ...theme.type.captionDefault,
    color: c.text.secondary,
    textAlign: 'center',
  },
  otherEmojiSpacer: {
    width: theme.scale.size.iconSm,
  },
  pressed: {
    opacity: theme.opacity.pressed,
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
  typeTab: {
    alignItems: 'center',
    borderRadius: theme.scale.radius.xs,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.scale.size.iconButton,
    paddingHorizontal: theme.scale.space[2],
  },
  typeTabSelected: {
    backgroundColor: c.bg.base,
  },
  typeTabText: {
    ...theme.type.captionDefault,
    color: c.text.secondary,
    textAlign: 'center',
  },
  typeTabTextSelected: {
    color: c.text.primary,
    fontFamily: theme.type.labelDefault.fontFamily,
  },
  typeTabs: {
    backgroundColor: c.surface.default,
    borderRadius: theme.scale.radius.sm,
    flexDirection: 'row',
    padding: theme.scale.space[1],
  },
});
