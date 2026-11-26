import Feather from '@expo/vector-icons/Feather';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Button } from '../../components/ds/Button';
import { StatusBanner } from '../../components/ds/StatusBanner';
import { useLanguage } from '../../contexts/LanguageContext';
import { useColors } from '../../contexts/ThemeContext';
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
  buildXlsx,
  type ExportColumns,
  type ExportMeta,
  type ExportRow,
} from '../../lib/export';
import {
  deliverBinary,
  deliverText,
  ShareUnavailableError,
} from '../../lib/exportDelivery';
import {
  beginPdfExport,
  disposePreparedPdf,
  savePreparedPdf,
  type PreparedPdfExport,
} from '../../lib/exportPdfIntegration';
import {
  createPreparedPdfLifecycle,
  type PreparedPdfLifecycle,
} from '../../lib/exportPdfLifecycle';
import { theme, type Colors } from '../../lib/theme';

type CategoryMeta = { group: string; type: ExpenseCategoryType };

// The export operation currently running, so its in-progress message names the
// format rather than a generic one. PDF is often slower, so it reads differently.
type ExportFormat = 'csv' | 'xlsx' | 'pdf';

const EXPORTING_MESSAGE_KEY: Record<ExportFormat, string> = {
  csv: 'export.preparingCsv',
  xlsx: 'export.preparingXlsx',
  pdf: 'export.generatingPdf',
};

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export default function ReportsScreen() {
  const { t, locale } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const currentMonth = todayLocalISO().slice(0, 7);
  const [visibleMonth, setVisibleMonth] = useState(currentMonth);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categoryMeta, setCategoryMeta] = useState<Map<string, CategoryMeta>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [activeFormat, setActiveFormat] = useState<ExportFormat | null>(null);
  // Derived, so there is a single source of truth for "an export is running".
  const exporting = activeFormat !== null;
  const [exportError, setExportError] = useState('');
  const [preparedPdf, setPreparedPdf] = useState<PreparedPdfExport | null>(
    null,
  );
  const [savingPdf, setSavingPdf] = useState(false);
  const exportingRef = useRef(false);
  const savingPdfRef = useRef(false);
  const pdfLifecycleRef = useRef<PreparedPdfLifecycle<PreparedPdfExport> | null>(
    null,
  );
  if (pdfLifecycleRef.current === null) {
    pdfLifecycleRef.current = createPreparedPdfLifecycle(disposePreparedPdf);
  }

  const invalidatePreparedPdf = useCallback(() => {
    pdfLifecycleRef.current?.invalidate();
    setPreparedPdf(null);
  }, []);

  useEffect(
    () => () => {
      pdfLifecycleRef.current?.invalidate();
    },
    [],
  );

  useFocusEffect(
    useCallback(
      () => () => {
        invalidatePreparedPdf();
      },
      [invalidatePreparedPdf],
    ),
  );

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
            setLoadError(t('export.loadFailed'));
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
    }, [retryKey, t, visibleMonth]),
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
        purchaseKey: expense.receiptId ?? expense.id,
        dateISO: expense.occurredOn,
        dateLabel: formatDayMonth(expense.occurredOn, locale),
        place: expense.merchantName ?? '',
        category: localizeCategoryName(expense.categoryName, t),
        group: localizeGroup(meta?.group ?? '', t),
        description:
          expense.description.trim() || expense.rawName?.trim() || '',
        amountOriginalCents: expense.originalAmountCents,
        currencyOriginal: expense.originalCurrency,
        amountRsdCents: expense.amountRsdCents,
        amountEurCents: expense.amountEurCents,
        amountUsdCents: expense.amountUsdCents,
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

  function buildMeta(_rows: readonly ExportRow[]): ExportMeta {
    const generatedDate = new Date().toLocaleDateString(
      locale.startsWith('ru') ? 'ru-RU' : 'en-GB',
    );
    return {
      title: 'Fintrack',
      periodLabel: formatMonthTitle(visibleMonth, locale),
      totalsLabel: t('common.total'),
      unavailableLabel: t('export.unavailable'),
      pdf: {
        report: t('export.pdf.report'),
        generated: `${t('export.pdf.generated')} ${generatedDate}`,
        totalSpending: t('export.pdf.totalSpending'),
        count: t('export.pdf.count'),
        average: t('export.pdf.average'),
        activeDays: t('export.pdf.activeDays'),
        largest: t('export.pdf.largest'),
        categories: t('export.pdf.categories'),
        details: t('export.pdf.details'),
        other: t('export.pdf.other'),
      },
    };
  }

  async function runExport(
    format: ExportFormat,
    deliver: (
      rows: ExportRow[],
      columns: ExportColumns,
      meta: ExportMeta,
    ) => Promise<void>,
  ) {
    if (!hasExpenses || exportingRef.current) {
      return;
    }
    exportingRef.current = true;
    setActiveFormat(format);
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
      exportingRef.current = false;
      setActiveFormat(null);
    }
  }

  const exportCsv = () =>
    void runExport('csv', (rows, columns, meta) =>
      deliverText(
        `fintrack-${visibleMonth}.csv`,
        buildCsv(rows, columns, meta),
        'text/csv;charset=utf-8',
      ),
    );
  const exportExcel = () =>
    void runExport('xlsx', (rows, columns, meta) =>
      deliverBinary(
        `fintrack-${visibleMonth}.xlsx`,
        buildXlsx(rows, columns, meta),
        XLSX_MIME,
      ),
    );
  const exportPdf = () => {
    if (!hasExpenses || exportingRef.current) {
      return;
    }
    const generation = pdfLifecycleRef.current?.begin() ?? 0;
    setPreparedPdf(null);
    exportingRef.current = true;
    setActiveFormat('pdf');
    setExportError('');
    const rows = buildRows();
    const filename = `fintrack-${visibleMonth}.pdf`;

    void beginPdfExport({
      rows,
      columns: buildColumns(),
      meta: buildMeta(rows),
      filename,
    })
      .then((prepared) => {
        if (!prepared) {
          return;
        }
        if (pdfLifecycleRef.current?.accept(generation, prepared)) {
          setPreparedPdf(prepared);
        }
      })
      .catch((error: unknown) => {
        console.error('Unable to generate PDF export:', error);
        setExportError(t('export.failed'));
      })
      .finally(() => {
        exportingRef.current = false;
        setActiveFormat(null);
      });
  };

  const savePdf = () => {
    const prepared = pdfLifecycleRef.current?.current();
    if (!prepared || savingPdfRef.current) {
      return;
    }
    savingPdfRef.current = true;
    setSavingPdf(true);
    setExportError('');
    void savePreparedPdf(prepared)
      .catch((error: unknown) => {
        console.error('Unable to save prepared PDF export:', error);
        setExportError(
          error instanceof ShareUnavailableError
            ? t('export.shareUnavailable')
            : t('export.failed'),
        );
      })
      .finally(() => {
        savingPdfRef.current = false;
        setSavingPdf(false);
      });
  };

  const buttonsDisabled = !hasExpenses || exporting || savingPdf || loading;

  const selectMonth = (month: string) => {
    invalidatePreparedPdf();
    setVisibleMonth(month);
  };

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
            color={colors.icon.primary}
            name="chevron-down"
            size={theme.scale.size.iconMd}
          />
        </Pressable>

        {loading ? (
          <ActivityIndicator color={colors.action.primary.fill} />
        ) : null}

        {loadError ? (
          <StatusBanner
            action={{
              label: t('home.retry'),
              onPress: () => setRetryKey((current) => current + 1),
            }}
            message={loadError}
            tone="error"
          />
        ) : null}

        {!loading && !loadError && !hasExpenses ? (
          <Text style={styles.emptyText}>{t('export.empty')}</Text>
        ) : null}

        {!loading && !loadError ? (
          <View style={styles.exportBlock}>
            <Text style={styles.sectionTitle}>{t('settings.export')}</Text>
            <View style={styles.actions}>
              <View style={styles.actionItem}>
                <Button
                  disabled={buttonsDisabled}
                  fullWidth
                  label="CSV"
                  onPress={exportCsv}
                  size="medium"
                  variant="primary"
                />
              </View>
              <View style={styles.actionItem}>
                <Button
                  disabled={buttonsDisabled}
                  fullWidth
                  label="Excel"
                  onPress={exportExcel}
                  size="medium"
                  variant="primary"
                />
              </View>
              <View style={styles.actionItem}>
                <Button
                  disabled={buttonsDisabled}
                  fullWidth
                  label="PDF"
                  onPress={exportPdf}
                  size="medium"
                  variant="primary"
                />
              </View>
            </View>

            {activeFormat ? (
              <View style={styles.exportingRow}>
                <ActivityIndicator
                  color={colors.action.primary.fill}
                  size="small"
                />
                <Text style={styles.exportingText}>
                  {t(EXPORTING_MESSAGE_KEY[activeFormat])}
                </Text>
              </View>
            ) : null}

            {preparedPdf ? (
              <Button
                disabled={exporting}
                fullWidth
                label={t('export.savePdf')}
                loading={savingPdf}
                onPress={savePdf}
                size="medium"
                variant="primary"
              />
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
        onSelect={selectMonth}
        selectedMonth={visibleMonth}
        visible={monthPickerVisible}
      />
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  actionItem: {
    // Each DS Button owns its own height and min width; the wrapper only
    // carries the row/wrap layout the screen needs. flexBasis 0 + flexGrow 1
    // makes CSV | Excel | PDF share the row as equal columns on a wide screen,
    // while the control min width lets them wrap on a narrow one.
    flexBasis: 0,
    flexGrow: 1,
    minWidth: theme.scale.size.controlMinWidth,
  },
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
  emptyText: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.body,
  },
  errorText: {
    color: c.status.error.content,
    fontSize: theme.fontSizes.label,
  },
  exportBlock: {
    gap: theme.spacing.md,
  },
  exportingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  exportingText: {
    color: c.text.secondary,
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
    color: c.text.primary,
    flexShrink: 1,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  screen: {
    backgroundColor: c.bg.base,
    flex: 1,
  },
  sectionTitle: {
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
  subtitle: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.body,
  },
});
