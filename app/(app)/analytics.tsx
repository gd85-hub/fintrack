import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { LoadingScreen } from '../../components/LoadingScreen';
import { useDisplayCurrency } from '../../contexts/DisplayCurrencyContext';
import {
  categoryBreakdownByMonth,
  type CategoryBreakdown,
  type MonthlyCategoryBreakdown,
} from '../../lib/db';
import {
  formatMonthTitle,
  shiftMonth,
  todayLocalISO,
} from '../../lib/dates';
import { type Currency, formatMoney } from '../../lib/money';
import { theme } from '../../lib/theme';

type RankedCategory = {
  amount: number;
  category: CategoryBreakdown;
  color: (typeof theme.categoryPalette)[number];
  share: number;
};

function amountForCurrency(
  value: CategoryBreakdown | MonthlyCategoryBreakdown,
  currency: Currency,
) {
  if (currency === 'USD') {
    return value.totalUsd;
  }

  if (currency === 'EUR') {
    return value.totalEur;
  }

  return value.totalRsd;
}

function colorForCategory(categoryId: string) {
  let hash = 0;
  for (const character of categoryId) {
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
  const { currency: displayCurrency } = useDisplayCurrency();
  const currentMonth = todayLocalISO().slice(0, 7);
  const [visibleMonth, setVisibleMonth] = useState(currentMonth);
  const [breakdown, setBreakdown] =
    useState<MonthlyCategoryBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setBreakdown(null);
      setErrorMessage('');

      void categoryBreakdownByMonth(visibleMonth)
        .then((loadedBreakdown) => {
          if (active) {
            setBreakdown(loadedBreakdown);
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
        color: colorForCategory(category.categoryId),
      }))
      .filter(({ amount }) => amount > 0)
      .sort((left, right) => right.amount - left.amount)
      .map((category) => ({
        ...category,
        share: (category.amount / monthTotal) * 100,
      }));
  }, [breakdown, displayCurrency, monthTotal]);
  const canMoveForward = visibleMonth < currentMonth;

  function openMonthOnHome() {
    router.replace({
      pathname: '/(app)',
      params: { month: visibleMonth },
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
            <View
              accessibilityLabel="Доли трат по категориям"
              accessibilityRole="image"
              style={styles.shareBar}
            >
              {rankedCategories.map(({ amount, category, color }) => (
                <View
                  key={category.categoryId}
                  style={[
                    styles.shareSegment,
                    { backgroundColor: color, flexGrow: amount },
                  ]}
                />
              ))}
            </View>

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
  shareBar: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.round,
    flexDirection: 'row',
    height: theme.spacing.md,
    overflow: 'hidden',
    width: '100%',
  },
  shareSegment: {
    flexBasis: 0,
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
});
