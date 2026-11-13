import Feather from '@expo/vector-icons/Feather';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ExpenseMiniRow } from '../../components/ExpenseMiniRow';
import { LoadingScreen } from '../../components/LoadingScreen';
import { MonthPicker } from '../../components/MonthPicker';
import { ListRow } from '../../components/ds/ListRow';
import { StatusBanner } from '../../components/ds/StatusBanner';
import { useHomeCurrency } from '../../contexts/HomeCurrencyContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSecondaryCurrency } from '../../contexts/SecondaryCurrencyContext';
import { useColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import {
  ensureAnchorRatesForRange,
  pickRateOnOrBefore,
  type AnchorRate,
} from '../../lib/anchorRates';
import { localizeCategoryName } from '../../lib/catalog';
import {
  deleteExpense,
  deleteReceipt,
  listExpensesByMonth,
  type Expense,
} from '../../lib/db';
import {
  formatDayHeader,
  formatMonthName,
  formatMonthPrepositional,
  monthBounds,
  todayLocalISO,
} from '../../lib/dates';
import { ANCHOR_DISPLAY } from '../../lib/features';
import { ANCHOR_CURRENCY } from '../../lib/fxDisplay';
import {
  sumExpenseDisplayAmounts,
  type RateLookup,
} from '../../lib/homeDisplay';
import {
  collapseIdenticalPurchaseItems,
  decideHomeRowPresentation,
  resolveHomeRowHeader,
} from '../../lib/homeRowPresentation';
import { type Currency, formatMoney } from '../../lib/money';
import { theme, type Colors } from '../../lib/theme';

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
  dayTotal: number | null;
  units: PurchaseUnit[];
};

type PendingPurchaseDelete = {
  expenseCount: number;
  expenseIds: string[];
  receiptId: string | null;
  unitKey: string;
};

type AnchorRateCache = {
  key: string;
  rates: AnchorRate[];
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
    return expense.amountEurCents ?? 0;
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

function anchorPurchaseDisplayAmount(
  expenses: readonly Expense[],
  displayCurrency: string,
  rateAt: RateLookup,
) {
  const firstExpense = expenses[0];
  const usesOneUnconvertedCurrency =
    firstExpense !== undefined &&
    expenses.every(
      (expense) =>
        expense.amountEurCents === null &&
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

  const amountCents = sumExpenseDisplayAmounts(
    expenses,
    displayCurrency,
    rateAt,
  );
  if (amountCents !== null) {
    return { amountCents, currency: displayCurrency };
  }

  return {
    amountCents: expenses.reduce(
      (sum, expense) => sum + expense.originalAmountCents,
      0,
    ),
    currency: firstExpense?.originalCurrency ?? displayCurrency,
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

type PurchaseRowProps = {
  anchorRatesLoading: boolean;
  displayCurrency: string;
  expanded: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
  onOpenExpense: (expenseId: string) => void;
  onShowMore?: () => void;
  onToggle?: () => void;
  rateAt: RateLookup;
  unit: PurchaseUnit;
  visibleCount: number;
};

function PurchaseRow({
  anchorRatesLoading,
  displayCurrency,
  expanded,
  onDelete,
  onEdit,
  onOpenExpense,
  onShowMore,
  onToggle,
  rateAt,
  unit,
  visibleCount,
}: PurchaseRowProps) {
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const displayAmount = ANCHOR_DISPLAY
    ? anchorPurchaseDisplayAmount(unit.expenses, displayCurrency, rateAt)
    : purchaseDisplayAmount(unit.expenses, 'RSD');
  const firstExpense = unit.expenses[0];
  const header = resolveHomeRowHeader(unit.expenses);
  const iconEmoji = unit.expenses
    .find((expense) => expense.categoryEmoji.trim())
    ?.categoryEmoji.trim();
  const expandable = decideHomeRowPresentation(
    unit.expenses.length,
  ).expandable;
  const rowExpanded = expandable && expanded;
  const positionLabel = t('home.itemCount', { count: unit.expenses.length });
  const collapsedItems = collapseIdenticalPurchaseItems(unit.expenses);
  const visibleItems = collapsedItems.slice(0, visibleCount);
  const remaining = collapsedItems.length - visibleItems.length;
  const amountNeedsAnchorRate = expensesNeedAnchorRate(
    unit.expenses,
    displayCurrency,
  );

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
        amountLoading={anchorRatesLoading && amountNeedsAnchorRate}
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
              {t('home.receiptItems')}
            </Text>
            {onEdit && onDelete ? (
              <View style={styles.purchaseActionButtons}>
                <Pressable
                  accessibilityLabel={t('home.editPurchaseA11y')}
                  accessibilityRole="button"
                  onPress={onEdit}
                  style={({ pressed }) => [
                    styles.editPurchaseButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.editPurchaseText}>
                    {t('home.editPurchase')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={t('home.deletePurchaseA11y', {
                    count: unit.expenses.length,
                  })}
                  accessibilityRole="button"
                  onPress={onDelete}
                  style={({ pressed }) => [
                    styles.deletePurchaseButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.deletePurchaseText}>
                    {t('home.deletePurchase')}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {visibleItems.map((item) => {
            const expense = item.firstExpense;
            const itemAmount = ANCHOR_DISPLAY
              ? anchorPurchaseDisplayAmount(
                  item.expenses,
                  displayCurrency,
                  rateAt,
                )
              : purchaseDisplayAmount(item.expenses, 'RSD');
            const displayName = `${item.displayName}${
              item.count > 1 ? ` ×${item.count}` : ''
            }`;

            return (
              <Pressable
                accessibilityLabel={t('home.openItemA11y', {
                  name: displayName,
                })}
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
                  amountLoading={
                    anchorRatesLoading &&
                    expensesNeedAnchorRate(item.expenses, displayCurrency)
                  }
                  categoryLabel={`${expense.categoryEmoji} ${localizeCategoryName(expense.categoryName, t)}`.trim()}
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
              accessibilityLabel={t('home.showMoreItemsA11y', {
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
        </View>
      ) : null}
    </View>
  );
}

function DayCardSeparator() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);

  return <View style={styles.dayCardGap} />;
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

function expensesNeedAnchorRate(
  expenses: readonly Expense[],
  displayCurrency: string,
): boolean {
  return expenses.some(
    (expense) =>
      expense.amountEurCents !== null &&
      expense.originalCurrency.trim().toUpperCase() !== displayCurrency,
  );
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
  const { t, locale } = useLanguage();
  const { homeCurrency, loading: homeCurrencyLoading } = useHomeCurrency();
  const { secondaryCurrency } = useSecondaryCurrency();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const toast = useToast();
  const params = useLocalSearchParams<{ month?: string | string[] }>();
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
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [anchorRateCache, setAnchorRateCache] = useState<AnchorRateCache>({
    key: '',
    rates: [],
  });
  const [anchorRatesLoading, setAnchorRatesLoading] = useState(false);
  const [secondaryRateCache, setSecondaryRateCache] =
    useState<AnchorRateCache>({
      key: '',
      rates: [],
    });
  const [secondaryRatesLoading, setSecondaryRatesLoading] = useState(false);

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
  const anchorRateKey = `${visibleMonth}:${homeCurrency}`;
  const neededAnchorRateDates = useMemo(
    () => [
      ...new Set(
        visibleExpenses
          .filter((expense) =>
            expensesNeedAnchorRate([expense], homeCurrency),
          )
          .map((expense) => expense.occurredOn),
      ),
    ],
    [homeCurrency, visibleExpenses],
  );
  const neededAnchorRateDatesKey = neededAnchorRateDates.join(',');
  const needsAnchorRates =
    ANCHOR_DISPLAY &&
    !homeCurrencyLoading &&
    homeCurrency !== ANCHOR_CURRENCY &&
    neededAnchorRateDates.length > 0;

  useEffect(() => {
    if (!needsAnchorRates) {
      setAnchorRatesLoading(false);
      return;
    }

    let active = true;
    setAnchorRateCache({ key: '', rates: [] });
    setAnchorRatesLoading(true);

    void ensureAnchorRatesForRange(homeCurrency, neededAnchorRateDates)
      .then((rates) => {
        if (active) {
          setAnchorRateCache({ key: anchorRateKey, rates });
        }
      })
      .catch((error: unknown) => {
        console.error('Unable to load Home anchor FX rates:', error);
        if (active) {
          setAnchorRateCache({ key: anchorRateKey, rates: [] });
        }
      })
      .finally(() => {
        if (active) {
          setAnchorRatesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    anchorRateKey,
    homeCurrency,
    neededAnchorRateDatesKey,
    needsAnchorRates,
  ]);

  const showSecondaryCurrency =
    ANCHOR_DISPLAY &&
    secondaryCurrency !== null &&
    secondaryCurrency !== homeCurrency;
  const secondaryRateKey = `${visibleMonth}:${secondaryCurrency ?? 'off'}`;
  const neededSecondaryRateDates = useMemo(() => {
    if (!secondaryCurrency) {
      return [];
    }

    return [
      ...new Set(
        expenses
          .filter((expense) =>
            expensesNeedAnchorRate([expense], secondaryCurrency),
          )
          .map((expense) => expense.occurredOn),
      ),
    ];
  }, [expenses, secondaryCurrency]);
  const neededSecondaryRateDatesKey = neededSecondaryRateDates.join(',');
  const needsSecondaryRates =
    showSecondaryCurrency &&
    secondaryCurrency !== ANCHOR_CURRENCY &&
    neededSecondaryRateDates.length > 0;

  useEffect(() => {
    if (!needsSecondaryRates || !secondaryCurrency) {
      setSecondaryRatesLoading(false);
      return;
    }

    let active = true;
    setSecondaryRateCache({ key: '', rates: [] });
    setSecondaryRatesLoading(true);

    void ensureAnchorRatesForRange(
      secondaryCurrency,
      neededSecondaryRateDates,
    )
      .then((rates) => {
        if (active) {
          setSecondaryRateCache({ key: secondaryRateKey, rates });
        }
      })
      .catch((error: unknown) => {
        console.error('Unable to load secondary Home FX rates:', error);
        if (active) {
          setSecondaryRateCache({ key: secondaryRateKey, rates: [] });
        }
      })
      .finally(() => {
        if (active) {
          setSecondaryRatesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    neededSecondaryRateDatesKey,
    needsSecondaryRates,
    secondaryCurrency,
    secondaryRateKey,
  ]);

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
            setErrorMessage(t('home.errorLoad'));
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

  const groups = useMemo(
    () => groupExpenses(visibleExpenses),
    [visibleExpenses],
  );
  const rateAt = useMemo<RateLookup>(() => {
    if (
      homeCurrency === ANCHOR_CURRENCY ||
      anchorRateCache.key !== anchorRateKey
    ) {
      return () => null;
    }

    return (dateISO) =>
      pickRateOnOrBefore(
        anchorRateCache.rates,
        homeCurrency,
        dateISO,
      )?.ratePerEur ?? null;
  }, [anchorRateCache, anchorRateKey, homeCurrency]);
  const secondaryRateAt = useMemo<RateLookup>(() => {
    if (
      secondaryCurrency === null ||
      secondaryCurrency === ANCHOR_CURRENCY ||
      secondaryRateCache.key !== secondaryRateKey
    ) {
      return () => null;
    }

    return (dateISO) =>
      pickRateOnOrBefore(
        secondaryRateCache.rates,
        secondaryCurrency,
        dateISO,
      )?.ratePerEur ?? null;
  }, [secondaryCurrency, secondaryRateCache, secondaryRateKey]);
  const sections = useMemo(
    () => {
      if (!ANCHOR_DISPLAY) {
        return buildDaySections(groups, collapsedDays, 'RSD');
      }

      return groups.map((group) => {
        const units = buildPurchaseUnits(group.expenses);
        return {
          data: collapsedDays.has(group.date) ? [] : units,
          date: group.date,
          dayTotal: sumExpenseDisplayAmounts(
            group.expenses,
            homeCurrency,
            rateAt,
          ),
          units,
        };
      });
    },
    [collapsedDays, groups, homeCurrency, rateAt],
  );
  const monthTotals = useMemo(
    () => ({
      rsd: expenses.reduce(
        (sum, expense) =>
          sum + amountForCurrency(expense, 'RSD'),
        0,
      ),
      eur: expenses.reduce(
        (sum, expense) => sum + amountForCurrency(expense, 'EUR'),
        0,
      ),
      usd: expenses.reduce(
        (sum, expense) => sum + amountForCurrency(expense, 'USD'),
        0,
      ),
    }),
    [expenses],
  );
  const anchorMonthTotal = useMemo(
    () =>
      ANCHOR_DISPLAY
        ? sumExpenseDisplayAmounts(expenses, homeCurrency, rateAt)
        : null,
    [expenses, homeCurrency, rateAt],
  );
  const secondaryMonthTotal = useMemo(
    () =>
      showSecondaryCurrency && secondaryCurrency
        ? sumExpenseDisplayAmounts(
            expenses,
            secondaryCurrency,
            secondaryRateAt,
          )
        : null,
    [
      expenses,
      secondaryCurrency,
      secondaryRateAt,
      showSecondaryCurrency,
    ],
  );
  const secondaryRatesPending =
    needsSecondaryRates &&
    (secondaryRatesLoading ||
      secondaryRateCache.key !== secondaryRateKey);
  const monthName = formatMonthName(visibleMonth, locale);
  const monthPrepositional = formatMonthPrepositional(visibleMonth, locale);

  const listHeaderElement = useMemo(
    () => (
      <View style={styles.listHeader}>
        <View style={styles.balanceGroup}>
          <View style={styles.homeHeader}>
            <Pressable
              accessibilityLabel={t('home.selectMonth')}
              accessibilityRole="button"
              onPress={() => setMonthPickerVisible(true)}
              style={({ pressed }) => [
                styles.monthPickerButton,
                pressed && styles.pressed,
              ]}
            >
              <Text numberOfLines={1} style={styles.headerMonth}>
                {monthName}
              </Text>
              <Feather
                color={colors.icon.primary}
                name="chevron-down"
                size={theme.scale.size.iconMd}
              />
            </Pressable>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.hero}>
              <Text style={styles.heroTitle}>
                {t('home.spentIn', { month: monthPrepositional })}
              </Text>
              {anchorRatesLoading ? (
                <ActivityIndicator
                  color={colors.icon.secondary}
                  size="small"
                />
              ) : (
                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={styles.heroAmount}
                >
                  {ANCHOR_DISPLAY
                    ? anchorMonthTotal === null
                      ? '—'
                      : formatMoney(anchorMonthTotal)
                    : formatMoney(monthTotals.rsd)}
                  <Text style={styles.heroCurrency}>
                    {ANCHOR_DISPLAY ? ` ${homeCurrency}` : ' RSD'}
                  </Text>
                </Text>
              )}
              {!ANCHOR_DISPLAY ? (
                <Text numberOfLines={1} style={styles.heroEquivalents}>
                  {`≈ ${formatMoney(monthTotals.eur)} €   ·   ≈ ${formatMoney(monthTotals.usd)} $`}
                </Text>
              ) : showSecondaryCurrency ? (
                secondaryRatesPending ? (
                  <ActivityIndicator
                    color={colors.icon.secondary}
                    size="small"
                  />
                ) : secondaryMonthTotal !== null ? (
                  <Text numberOfLines={1} style={styles.heroEquivalents}>
                    {formatMoney(secondaryMonthTotal)} {secondaryCurrency}
                  </Text>
                ) : null
              ) : null}
            </View>
          </View>
        </View>

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
              {t('home.needsReview', {
                count: needsAttentionExpenses.length,
              })}
            </Text>
          </Pressable>
        ) : null}

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

        {purchaseErrorMessage ? (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>{purchaseErrorMessage}</Text>
          </View>
        ) : null}

        {loading ? <LoadingScreen compact /> : null}
      </View>
    ),
    [
      errorMessage,
      anchorMonthTotal,
      anchorRatesLoading,
      homeCurrency,
      loading,
      monthName,
      monthPrepositional,
      monthTotals,
      needsAttentionExpenses.length,
      needsAttentionOnly,
      purchaseErrorMessage,
      secondaryCurrency,
      secondaryMonthTotal,
      secondaryRatesPending,
      showSecondaryCurrency,
      colors.icon.primary,
      colors.icon.secondary,
      styles,
      t,
    ],
  );

  const listEmptyElement = useMemo(
    () =>
      !loading && !errorMessage && sections.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t('home.emptyTitle')}</Text>
          <Text style={styles.emptyHint}>{t('home.emptySubtitle')}</Text>
        </View>
      ) : null,
    [errorMessage, loading, sections.length, styles, t],
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

    if (!deletionFailed) {
      toast.success(t('toast.expenseDeleted'));
    }

    try {
      const refreshedExpenses = await listExpensesByMonth(visibleMonth);
      setExpenses(refreshedExpenses);
      if (deletionFailed) {
        setPurchaseErrorMessage(t('home.deleteErrorPartial'));
      }
    } catch (error: unknown) {
      console.error('Unable to refresh expenses after deletion:', error);
      setErrorMessage(
        deletionFailed
          ? t('home.deleteErrorBoth')
          : t('home.deleteErrorRefresh'),
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
      <FlatList<HomeDaySection>
        contentContainerStyle={styles.content}
        data={listSections}
        ItemSeparatorComponent={DayCardSeparator}
        keyExtractor={(section) => section.date}
        ListEmptyComponent={listEmptyElement}
        ListHeaderComponent={listHeaderElement}
        renderItem={({ item: section }) => {
          const collapsed = collapsedDays.has(section.date);

          return (
            <View style={styles.dayCard}>
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
                  {formatDayHeader(section.date, locale)}
                </Text>
                {anchorRatesLoading &&
                expensesNeedAnchorRate(
                  section.units.flatMap((unit) => unit.expenses),
                  homeCurrency,
                ) ? (
                  <ActivityIndicator
                    color={colors.icon.secondary}
                    size="small"
                  />
                ) : (
                  <Text numberOfLines={1} style={styles.dayTotal}>
                    {ANCHOR_DISPLAY
                      ? `${
                          section.dayTotal === null
                            ? '—'
                            : formatMoney(section.dayTotal)
                        } ${homeCurrency}`
                      : `${formatMoney(section.dayTotal ?? 0)} RSD`}
                  </Text>
                )}
              </Pressable>

              {!collapsed
                ? section.units.map((unit, index) => {
                    const expense = unit.expenses[0];

                    if (!expense) {
                      return null;
                    }

                    const receiptId = unit.receiptId;

                    return (
                      <View key={unit.key}>
                        <PurchaseRow
                          anchorRatesLoading={anchorRatesLoading}
                          displayCurrency={homeCurrency}
                          expanded={expandedUnitKeys.has(unit.key)}
                          onDelete={() => requestPurchaseDelete(unit)}
                          onEdit={
                            receiptId !== null
                              ? () =>
                                  router.push(
                                    `/(app)/receipt/review?receiptId=${encodeURIComponent(receiptId)}`,
                                  )
                              : () =>
                                  router.push(
                                    `/(app)/expense/${expense.id}`,
                                  )
                          }
                          onOpenExpense={(expenseId) =>
                            router.push(`/(app)/expense/${expenseId}`)
                          }
                          onShowMore={() => showMoreUnit(unit.key)}
                          onToggle={() => toggleUnit(unit.key)}
                          rateAt={rateAt}
                          unit={unit}
                          visibleCount={
                            unitVisibleCounts[unit.key] ?? expensePageSize
                          }
                        />
                        {index < section.units.length - 1 ? (
                          <View style={styles.purchaseRowSeparator} />
                        ) : null}
                      </View>
                    );
                  })
                : null}
            </View>
          );
        }}
        style={styles.list}
      />

      <MonthPicker
        currentMonth={currentMonth}
        onClose={() => setMonthPickerVisible(false)}
        onSelect={setVisibleMonth}
        selectedMonth={visibleMonth}
        visible={monthPickerVisible}
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
            ? t('home.confirmDeleteTitle', {
                count: pendingPurchaseDelete.expenseCount,
              })
            : ''
        }
        visible={pendingPurchaseDelete !== null}
      />
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  balanceGroup: {
    gap: theme.scale.space[2],
  },
  content: {
    alignSelf: 'center',
    maxWidth: theme.sizes.maxContentWidth,
    paddingBottom: theme.spacing.listBottom,
    paddingHorizontal: theme.scale.space[4],
    paddingTop: theme.spacing.lg,
    width: '100%',
  },
  dayCard: {
    backgroundColor: c.surface.raised,
    borderColor: c.border.subtle,
    borderRadius: theme.scale.radius.lg,
    borderWidth: theme.scale.stroke.hairline,
    overflow: 'hidden',
  },
  dayCardGap: {
    height: theme.scale.space[4],
  },
  dayHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.scale.space[3],
    justifyContent: 'space-between',
    paddingBottom: theme.scale.space[2],
    paddingHorizontal: theme.scale.space[4],
    paddingTop: theme.scale.space[4],
  },
  dayTitle: {
    ...theme.type.captionDefault,
    color: c.text.secondary,
    flex: 1,
  },
  dayTotal: {
    ...theme.type.amountSecondary,
    color: c.text.secondary,
    fontVariant: [...theme.type.amountSecondary.fontVariant],
    textAlign: 'right',
  },
  deletePurchaseButton: {
    justifyContent: 'center',
    minHeight: theme.sizes.iconButton,
  },
  deletePurchaseText: {
    color: c.status.error.content,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  editPurchaseButton: {
    justifyContent: 'center',
    minHeight: theme.sizes.iconButton,
  },
  editPurchaseText: {
    color: c.action.link.rest,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  emptyHint: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.label,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xxl,
  },
  emptyTitle: {
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
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
  headerMonth: {
    ...theme.type.titleScreen,
    color: c.text.primary,
    flexShrink: 1,
  },
  hero: {
    gap: theme.scale.space[1],
  },
  heroAmount: {
    ...theme.type.displayHero,
    color: c.text.primary,
  },
  heroCurrency: {
    ...theme.type.titleSection,
    color: c.text.secondary,
  },
  heroEquivalents: {
    ...theme.type.amountSecondary,
    color: c.text.secondary,
    fontVariant: [...theme.type.amountSecondary.fontVariant],
  },
  heroTitle: {
    ...theme.type.captionDefault,
    color: c.text.secondary,
  },
  heroCard: {
    backgroundColor: c.surface.raised,
    borderColor: c.border.subtle,
    borderRadius: theme.scale.radius.lg,
    borderWidth: theme.scale.stroke.hairline,
    padding: theme.scale.space[4],
  },
  homeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.scale.space[2],
    paddingVertical: theme.scale.space[1],
  },
  list: {
    flex: 1,
  },
  listHeader: {
    gap: theme.scale.space[4],
    marginBottom: theme.scale.space[4],
  },
  monthPickerButton: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: theme.scale.space[2],
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
    backgroundColor: c.surface.default,
    borderRadius: theme.radii.card,
    marginBottom: theme.spacing.sm,
    marginLeft: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xxs,
  },
  purchaseDetailsTitle: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  purchaseItem: {
    borderBottomColor: c.border.default,
    borderBottomWidth: theme.sizes.border,
  },
  purchaseRowSeparator: {
    backgroundColor: c.separatorInset,
    height: theme.scale.stroke.hairline,
    marginLeft: purchaseRowTextOffset,
  },
  purchaseUnit: {
    width: '100%',
  },
  rowPressed: {
    backgroundColor: c.surface.default,
  },
  screen: {
    backgroundColor: c.bg.base,
    flex: 1,
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
  triageChip: {
    alignSelf: 'center',
    borderColor: c.action.primary.fill,
    borderRadius: theme.radii.chip,
    borderWidth: theme.sizes.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  triageChipSelected: {
    backgroundColor: c.action.primary.fill,
  },
  triageChipText: {
    color: c.action.link.rest,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  triageChipTextSelected: {
    color: c.action.primary.content,
  },
});
