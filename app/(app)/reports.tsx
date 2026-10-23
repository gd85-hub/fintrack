import Feather from '@expo/vector-icons/Feather';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MonthPicker } from '../../components/MonthPicker';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useLanguage } from '../../contexts/LanguageContext';
import { localizeCategoryName, localizeGroup } from '../../lib/catalog';
import { formatDayMonth, formatMonthTitle, todayLocalISO } from '../../lib/dates';
import {
  listCategoriesForManagement,
  listExpensesByMonth,
  type Expense,
  type ExpenseCategoryType,
} from '../../lib/db';
import {
  buildCsv,
  buildExpensesPdfHtml,
  buildXlsx,
  type ExportColumns,
  type ExportMeta,
  type ExportRow,
} from '../../lib/export';
import {
  deliverBinary,
  deliverPdf,
  deliverText,
  ShareUnavailableError,
} from '../../lib/exportDelivery';
import { theme } from '../../lib/theme';

type CategoryMeta = { group: string; type: ExpenseCategoryType };

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export default function ReportsScreen() {
  const { t, locale } = useLanguage();
  const currentMonth = todayLocalISO().slice(0, 7);
  const [visibleMonth, setVisibleMonth] = useState(currentMonth);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categoryMeta, setCategoryMeta] = useState<Map<string, CategoryMeta>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setLoadError('');
      setExportError('');

      void Promise.all([
        listExpensesByMonth(visibleMonth),
        listCategoriesForManagement(),
      ])
        .then(([loadedExpenses, categories]) => {
          if (!active) {
            return;
          }
          setExpenses(loadedExpenses);
          setCategoryMeta(
            new Map(
              categories.map((category) => [
                category.id,
                { group: category.group, type: category.type },
              ]),
            ),
          );
        })
        .catch((error: unknown) => {
          console.error('Unable to load expenses for export:', error);
          if (active) {
            setLoadError(t('export.failed'));
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
    }, [t, visibleMonth]),
  );

  const hasExpenses = expenses.length > 0;

  function typeLabel(type: ExpenseCategoryType | undefined): string {
    if (type === 'fixed') {
      return t('cat.typeFixed');
    }
    if (type === 'variable') {
      return t('cat.typeVariable');
    }
    return '';
  }

  function buildRows(): ExportRow[] {
    return expenses.map((expense) => {
      const meta = categoryMeta.get(expense.categoryId);
      return {
        dateISO: expense.occurredOn,
        dateLabel: formatDayMonth(expense.occurredOn, locale),
        place: expense.merchantName ?? '',
        category: localizeCategoryName(expense.categoryName, t),
        group: localizeGroup(meta?.group ?? '', t),
        description:
          expense.description.trim() || expense.rawName?.trim() || '',
        amountOriginal: expense.originalAmountCents / 100,
        currencyOriginal: expense.originalCurrency,
        amountRsd: expense.amountRsdCents / 100,
        amountEur: expense.amountEurCents / 100,
        amountUsd: expense.amountUsdCents / 100,
        type: typeLabel(meta?.type),
      };
    });
  }

  function buildColumns(): ExportColumns {
    return {
      date: t('common.date'),
      place: t('common.place'),
      category: t('common.category'),
      group: t('cat.group'),
      description: t('common.description'),
      amount: t('common.amount'),
      currency: t('common.currency'),
      rsd: 'RSD',
      eur: 'EUR',
      usd: 'USD',
      type: t('cat.type'),
      total: t('common.total'),
    };
  }

  function buildMeta(rows: readonly ExportRow[]): ExportMeta {
    const byCategory = new Map<string, number>();
    for (const row of rows) {
      byCategory.set(
        row.category,
        (byCategory.get(row.category) ?? 0) + row.amountRsd,
      );
    }
    const topCategories = [...byCategory.entries()]
      .map(([label, amountRsd]) => ({ label, amountRsd }))
      .sort((left, right) => right.amountRsd - left.amountRsd)
      .slice(0, 5);

    return {
      title: 'Fintrack',
      periodLabel: formatMonthTitle(visibleMonth, locale),
      totalsLabel: t('common.total'),
      summaryTitle: t('export.topCategories'),
      topCategories,
    };
  }

  async function runExport(
    deliver: (
      rows: ExportRow[],
      columns: ExportColumns,
      meta: ExportMeta,
    ) => Promise<void>,
  ) {
    if (!hasExpenses || exporting) {
      return;
    }
    setExporting(true);
    setExportError('');
    try {
      const rows = buildRows();
      await deliver(rows, buildColumns(), buildMeta(rows));
    } catch (error: unknown) {
      console.error('Unable to export expenses:', error);
      setExportError(
        error instanceof ShareUnavailableError
          ? t('export.shareUnavailable')
          : t('export.failed'),
      );
    } finally {
      setExporting(false);
    }
  }

  const exportCsv = () =>
    void runExport((rows, columns, meta) =>
      deliverText(
        `fintrack-${visibleMonth}.csv`,
        buildCsv(rows, columns, meta),
        'text/csv',
      ),
    );
  const exportExcel = () =>
    void runExport((rows, columns, meta) =>
      deliverBinary(
        `fintrack-${visibleMonth}.xlsx`,
        buildXlsx(rows, columns, meta),
        XLSX_MIME,
      ),
    );
  const exportPdf = () =>
    void runExport((rows, columns, meta) =>
      deliverPdf(
        buildExpensesPdfHtml(rows, columns, meta),
        `fintrack-${visibleMonth}.pdf`,
      ),
    );

  const buttonsDisabled = !hasExpenses || exporting || loading;

  return (
    <View style={styles.screen}>
      <ScreenHeader title={t('nav.reports')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>{t('export.subtitle')}</Text>

        <Pressable
          accessibilityLabel={t('home.selectMonth')}
          accessibilityRole="button"
          onPress={() => setMonthPickerVisible(true)}
          style={({ pressed }) => [
            styles.monthButton,
            pressed && styles.pressed,
          ]}
        >
          <Text numberOfLines={1} style={styles.monthTitle}>
            {formatMonthTitle(visibleMonth, locale)}
          </Text>
          <Feather
            color={theme.color.icon.primary}
            name="chevron-down"
            size={theme.scale.size.iconMd}
          />
        </Pressable>

        {loading ? <ActivityIndicator color={theme.colors.accent} /> : null}

        {loadError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {loadError}
          </Text>
        ) : null}

        {!loading && !loadError && !hasExpenses ? (
          <Text style={styles.emptyText}>{t('export.empty')}</Text>
        ) : null}

        {!loading && !loadError ? (
          <View style={styles.exportBlock}>
            <Text style={styles.sectionTitle}>{t('settings.export')}</Text>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                disabled={buttonsDisabled}
                onPress={exportCsv}
                style={({ pressed }) => [
                  styles.exportButton,
                  (pressed || buttonsDisabled) && styles.disabled,
                ]}
              >
                <Text style={styles.exportButtonText}>CSV</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={buttonsDisabled}
                onPress={exportExcel}
                style={({ pressed }) => [
                  styles.exportButton,
                  (pressed || buttonsDisabled) && styles.disabled,
                ]}
              >
                <Text style={styles.exportButtonText}>Excel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={buttonsDisabled}
                onPress={exportPdf}
                style={({ pressed }) => [
                  styles.exportButton,
                  (pressed || buttonsDisabled) && styles.disabled,
                ]}
              >
                <Text style={styles.exportButtonText}>PDF</Text>
              </Pressable>
            </View>

            {exporting ? (
              <View style={styles.exportingRow}>
                <ActivityIndicator color={theme.colors.accent} size="small" />
                <Text style={styles.exportingText}>
                  {t('export.exporting')}
                </Text>
              </View>
            ) : null}

            {exportError ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {exportError}
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <MonthPicker
        currentMonth={currentMonth}
        onClose={() => setMonthPickerVisible(false)}
        onSelect={setVisibleMonth}
        selectedMonth={visibleMonth}
        visible={monthPickerVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  content: {
    alignSelf: 'center',
    gap: theme.spacing.lg,
    maxWidth: theme.sizes.maxContentWidth,
    padding: theme.spacing.lg,
    width: '100%',
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.body,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.fontSizes.label,
  },
  exportBlock: {
    gap: theme.spacing.md,
  },
  exportButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.button,
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    minWidth: theme.sizes.iconButton,
    paddingHorizontal: theme.spacing.lg,
  },
  exportButtonText: {
    color: theme.colors.white,
    fontSize: theme.fontSizes.button,
    fontWeight: '700',
  },
  exportingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  exportingText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.body,
  },
  monthButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.scale.space[2],
    paddingVertical: theme.scale.space[1],
  },
  monthTitle: {
    ...theme.type.titleScreen,
    color: theme.color.text.primary,
    flexShrink: 1,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  screen: {
    backgroundColor: theme.color.bg.base,
    flex: 1,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.body,
  },
});
