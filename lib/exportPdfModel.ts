import type {
  ExportColumns,
  ExportMeta,
  ExportPdfLabels,
  ExportRow,
} from './export';

export type PdfReportPurchase = {
  amountRsdCents: number;
  place: string;
  category: string;
};

export type PdfReportCategory = {
  label: string;
  amountRsdCents: number;
  sharePercent: number;
  relativeWidthPercent: number;
  isAggregatedOther: boolean;
};

export type PdfReportDay = {
  dateISO: string;
  dateLabel: string;
  totalRsdCents: number;
  rows: readonly ExportRow[];
};

export type PdfReportModel = {
  title: string;
  periodLabel: string;
  labels: ExportPdfLabels;
  unavailableLabel: string;
  columns: ExportColumns;
  totals: {
    rsdCents: number;
    eurCents: number | null;
    usdCents: number;
    unavailableEurCount: number;
  };
  purchases: {
    count: number;
    averageRsdCents: number;
    largest: PdfReportPurchase | null;
  };
  period: {
    daysWithSpend: number;
    daysInPeriod: number;
  };
  categories: readonly PdfReportCategory[];
  days: readonly PdfReportDay[];
  rows: readonly ExportRow[];
};

const PDF_FALLBACK: ExportPdfLabels = {
  report: 'Expense report',
  generated: '',
  totalSpending: 'Total spending',
  count: 'Transactions',
  average: 'Average',
  activeDays: 'Spending days',
  largest: 'Largest expense',
  categories: 'Spending by category',
  details: 'Details',
  other: 'Other categories',
};

export function assertCents(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be an integer number of cents.`);
  }
}

export function sumCents(
  rows: readonly ExportRow[],
  pick: (row: ExportRow) => number,
): number {
  return rows.reduce((total, row) => {
    const value = pick(row);
    assertCents(value, 'Money');
    const next = total + value;
    if (!Number.isSafeInteger(next)) {
      throw new Error('Money total exceeds the safe integer range.');
    }
    return next;
  }, 0);
}

export function buildPdfReportModel(
  rows: readonly ExportRow[],
  columns: ExportColumns,
  meta: ExportMeta,
): PdfReportModel {
  const labels = meta.pdf ?? PDF_FALLBACK;
  const totalRsdCents = sumCents(rows, (row) => row.amountRsdCents);
  const unavailableEurCount = rows.filter(
    (row) => row.amountEurCents === null,
  ).length;
  const totalEurCents = unavailableEurCount === 0
    ? sumCents(rows, (row) => row.amountEurCents ?? 0)
    : null;
  const totalUsdCents = sumCents(rows, (row) => row.amountUsdCents);

  const purchaseMap = new Map<string, PdfReportPurchase>();
  for (const row of rows) {
    const current = purchaseMap.get(row.purchaseKey);
    const amountRsdCents = (current?.amountRsdCents ?? 0) + row.amountRsdCents;
    assertCents(amountRsdCents, 'Purchase total');
    purchaseMap.set(row.purchaseKey, {
      amountRsdCents,
      place: current?.place || row.place,
      category: current?.category || row.category,
    });
  }
  const purchaseCount = purchaseMap.size;
  const averageRsdCents = purchaseCount > 0
    ? Math.round(totalRsdCents / purchaseCount)
    : 0;
  const largest = [...purchaseMap.values()].reduce<PdfReportPurchase | null>(
    (currentLargest, purchase) =>
      currentLargest === null ||
      purchase.amountRsdCents > currentLargest.amountRsdCents
        ? purchase
        : currentLargest,
    null,
  );

  const categoryMap = new Map<string, number>();
  for (const row of rows) {
    categoryMap.set(
      row.category,
      (categoryMap.get(row.category) ?? 0) + row.amountRsdCents,
    );
  }
  const sortedCategories = [...categoryMap.entries()]
    .map(([label, amountRsdCents]) => ({
      label,
      amountRsdCents,
      isAggregatedOther: false,
    }))
    .sort((a, b) => b.amountRsdCents - a.amountRsdCents);
  const maximumCategoryRows = 7;
  let shownCategories = sortedCategories;
  if (sortedCategories.length > maximumCategoryRows) {
    const head = sortedCategories.slice(0, maximumCategoryRows - 1);
    const aggregatedAmountRsdCents = sortedCategories
      .slice(maximumCategoryRows - 1)
      .reduce((total, category) => total + category.amountRsdCents, 0);
    shownCategories = [
      ...head,
      {
        label: labels.other,
        amountRsdCents: aggregatedAmountRsdCents,
        isAggregatedOther: true,
      },
    ];
  }
  const maximumCategoryAmount = Math.max(
    ...shownCategories.map((category) => category.amountRsdCents),
    1,
  );
  const categories = shownCategories.map((category) => ({
    ...category,
    sharePercent: totalRsdCents > 0
      ? (category.amountRsdCents / totalRsdCents) * 100
      : 0,
    relativeWidthPercent:
      (category.amountRsdCents / maximumCategoryAmount) * 100,
  }));

  const dayTotals = new Map<string, number>();
  for (const row of rows) {
    dayTotals.set(
      row.dateISO,
      (dayTotals.get(row.dateISO) ?? 0) + row.amountRsdCents,
    );
  }
  const firstISO = rows.map((row) => row.dateISO).sort()[0] ?? '1970-01-01';
  const [year, month] = firstISO.split('-').map((part) => Number(part));
  const daysInPeriod = new Date(year, month, 0).getDate();
  const days = [...dayTotals.keys()].sort().map((dateISO) => {
    const dayRows = rows.filter((row) => row.dateISO === dateISO);
    return {
      dateISO,
      dateLabel: dayRows[0].dateLabel,
      totalRsdCents: sumCents(dayRows, (row) => row.amountRsdCents),
      rows: dayRows,
    };
  });

  return {
    title: meta.title,
    periodLabel: meta.periodLabel,
    labels,
    unavailableLabel: meta.unavailableLabel ?? 'Unavailable',
    columns,
    totals: {
      rsdCents: totalRsdCents,
      eurCents: totalEurCents,
      usdCents: totalUsdCents,
      unavailableEurCount,
    },
    purchases: {
      count: purchaseCount,
      averageRsdCents,
      largest,
    },
    period: {
      daysWithSpend: dayTotals.size,
      daysInPeriod,
    },
    categories,
    days,
    rows: [...rows],
  };
}
