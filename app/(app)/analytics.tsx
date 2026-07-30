import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CurrencySelector } from '../../components/CurrencySelector';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ShareBar } from '../../components/ShareBar';
import { useDisplayCurrency } from '../../contexts/DisplayCurrencyContext';
import {
  categoryBreakdownByMonth,
  type CategoryBreakdown,
  type MerchantBreakdown,
  merchantBreakdownByMonth,
  type MerchantTypeBreakdown,
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
  const [expandedTypeKeys, setExpandedTypeKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setBreakdown(null);
      setMerchantBreakdown(null);
      setExpandedTypeKeys(new Set());
      setErrorMessage('');

      void Promise.all([
        categoryBreakdownByMonth(visibleMonth),
        merchantBreakdownByMonth(visibleMonth),
      ])
        .then(([loadedBreakdown, loadedMerchantBreakdown]) => {
          if (active) {
            setBreakdown(loadedBreakdown);
            setMerchantBreakdown(loadedMerchantBreakdown);
          }
        })
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
  const canMoveForward = visibleMonth < currentMonth;

  function openMonthOnHome() {
    router.replace({
      pathname: '/(app)',
      params: { month: visibleMonth },
    });
  }

  function toggleType(typeId: string | null) {
    const typeKey = typeId ?? 'unknown';
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
          <>
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
                  ({ amount, category, color, share }) => (
                    <Pressable
                      accessibilityLabel={`${category.name}, ${formatMoney(amount)} ${displayCurrency}, ${formatShare(share)}, операций: ${category.count}`}
                      accessibilityRole="button"
                      key={category.categoryId}
                      onPress={openMonthOnHome}
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
                        <Text numberOfLines={1} style={styles.categoryName}>
                          {category.name}
                        </Text>
                        <Text style={styles.categoryMeta}>
                          {formatShare(share)} · Операций: {category.count}
                        </Text>
                      </View>
                      <Text style={styles.categoryAmount}>
                        {formatMoney(amount)} {displayCurrency}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>По местам</Text>
              <ShareBar
                accessibilityLabel="Доли трат по типам мест"
                segments={rankedMerchantTypes.map(
                  ({ amount, color, type }) => ({
                    id: type.typeId ?? 'unknown',
                    amount,
                    color,
                  }),
                )}
              />

              <View style={styles.merchantTypeList}>
                {rankedMerchantTypes.map(
                  ({ amount, color, merchants, share, type }) => {
                    const typeKey = type.typeId ?? 'unknown';
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
                          <Text style={styles.expandIcon}>
                            {expanded ? '⌄' : '›'}
                          </Text>
                        </Pressable>

                        {type.typeId === null ? (
                          <Text style={styles.unknownHint}>
                            Можно уточнить, отредактировав трату
                          </Text>
                        ) : null}

                        {expanded ? (
                          <View style={styles.merchantList}>
                            {merchants.map(({ amount: merchantAmount, merchant }) => (
                              <View
                                key={merchant.merchantId ?? 'unknown'}
                                style={styles.merchantRow}
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
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    );
                  },
                )}
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    borderBottomColor: theme.colors.border,
    borderBottomWidth: theme.sizes.border,
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
  expandIcon: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.body,
    textAlign: 'center',
    width: theme.spacing.md,
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
  merchantList: {
    borderLeftColor: theme.colors.border,
    borderLeftWidth: theme.sizes.border,
    gap: theme.spacing.xxs,
    marginLeft: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
    paddingLeft: theme.spacing.lg,
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
