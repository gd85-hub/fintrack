import { describe, expect, it } from '@jest/globals';

import {
  buildPdfReportModel,
  type PdfReportModel,
} from '../exportPdfModel';
import type { ExportColumns, ExportMeta, ExportRow } from '../export';

const columns: ExportColumns = {
  date: 'Date',
  place: 'Place',
  category: 'Category',
  group: 'Group',
  description: 'Description',
  amount: 'Amount',
  currency: 'Currency',
  rsd: 'RSD',
  eur: 'EUR',
  usd: 'USD',
  type: 'Type',
  total: 'Total',
};

const meta: ExportMeta = {
  title: 'Fintrack',
  periodLabel: 'October 2026',
  totalsLabel: 'Total',
  unavailableLabel: 'Unavailable',
  pdf: {
    report: 'Expense report',
    generated: 'Generated now',
    totalSpending: 'Total spending',
    count: 'Purchases',
    average: 'Average purchase',
    activeDays: 'Active days',
    largest: 'Largest purchase',
    categories: 'Categories',
    details: 'Details',
    other: 'Other categories',
  },
};

const baseRow: ExportRow = {
  purchaseKey: 'manual-default',
  dateISO: '2026-10-01',
  dateLabel: '1 October',
  place: 'Place',
  category: 'Groceries',
  group: 'Food',
  description: 'Item',
  amountOriginalCents: 100,
  currencyOriginal: 'RSD',
  amountRsdCents: 100,
  amountEurCents: 1,
  amountUsdCents: 1,
  type: 'Variable',
};

function row(overrides: Partial<ExportRow>): ExportRow {
  return { ...baseRow, ...overrides };
}

function build(rows: readonly ExportRow[]): PdfReportModel {
  return buildPdfReportModel(rows, columns, meta);
}

describe('buildPdfReportModel', () => {
  it('reconciles row, category, and day totals in integer cents', () => {
    const model = build([
      row({
        purchaseKey: 'manual-1',
        dateISO: '2026-10-01',
        category: 'Food',
        amountRsdCents: 12375,
      }),
      row({
        purchaseKey: 'manual-2',
        dateISO: '2026-10-02',
        category: 'Transport',
        amountRsdCents: 50,
      }),
      row({
        purchaseKey: 'manual-3',
        dateISO: '2026-10-02',
        category: 'Food',
        amountRsdCents: 1,
      }),
    ]);

    expect(model.totals.rsdCents).toBe(12426);
    expect(model.totals.eurCents).toBe(3);
    expect(model.totals.usdCents).toBe(3);
    expect(
      model.categories.reduce(
        (total, category) => total + category.amountRsdCents,
        0,
      ),
    ).toBe(model.totals.rsdCents);
    expect(
      model.days.reduce((total, day) => total + day.totalRsdCents, 0),
    ).toBe(model.totals.rsdCents);
  });

  it('counts receipt lines as one purchase and manual expenses separately', () => {
    const model = build([
      row({
        purchaseKey: 'receipt-1',
        place: 'Receipt shop',
        amountRsdCents: 10001,
      }),
      row({
        purchaseKey: 'receipt-1',
        place: 'Receipt shop',
        amountRsdCents: 5000,
      }),
      row({
        purchaseKey: 'manual-1',
        place: 'Manual shop',
        amountRsdCents: 19999,
      }),
      row({
        purchaseKey: 'manual-2',
        place: 'Small manual shop',
        amountRsdCents: 1,
      }),
    ]);

    expect(model.purchases.count).toBe(3);
    expect(model.purchases.averageRsdCents).toBe(11667);
    expect(model.purchases.largest).toEqual({
      amountRsdCents: 19999,
      place: 'Manual shop',
      category: 'Groceries',
    });
  });

  it('preserves unavailable EUR as null and reports its row count', () => {
    const model = build([
      row({ amountEurCents: 10 }),
      row({ purchaseKey: 'manual-2', amountEurCents: null }),
    ]);

    expect(model.totals.eurCents).toBeNull();
    expect(model.totals.unavailableEurCount).toBe(1);
    expect(model.totals.rsdCents).toBe(200);
    expect(model.totals.usdCents).toBe(2);
  });

  it('keeps a real Other category separate from the aggregated remainder', () => {
    const amounts = [1000, 900, 800, 700, 600, 500, 400, 300];
    const model = build(
      amounts.map((amountRsdCents, index) =>
        row({
          purchaseKey: `manual-${index}`,
          category: index === 0 ? 'Other' : `Category ${index + 1}`,
          amountRsdCents,
        }),
      ),
    );

    expect(model.categories).toHaveLength(7);
    expect(model.categories[0]).toMatchObject({
      label: 'Other',
      amountRsdCents: 1000,
      isAggregatedOther: false,
    });
    expect(model.categories[6]).toMatchObject({
      label: 'Other categories',
      amountRsdCents: 700,
      isAggregatedOther: true,
    });
    expect(
      model.categories.reduce(
        (total, category) => total + category.amountRsdCents,
        0,
      ),
    ).toBe(model.totals.rsdCents);
    expect(
      model.categories.reduce(
        (total, category) => total + category.sharePercent,
        0,
      ),
    ).toBeCloseTo(100, 10);
  });

  it('sorts day groups by date but preserves input order inside each day', () => {
    const firstLateDayRow = row({
      purchaseKey: 'late-1',
      dateISO: '2026-10-02',
      dateLabel: '2 October',
      description: 'first on second day',
    });
    const earlyDayRow = row({
      purchaseKey: 'early',
      dateISO: '2026-10-01',
      dateLabel: '1 October',
      description: 'only on first day',
    });
    const secondLateDayRow = row({
      purchaseKey: 'late-2',
      dateISO: '2026-10-02',
      dateLabel: '2 October',
      description: 'second on second day',
    });
    const input = [firstLateDayRow, earlyDayRow, secondLateDayRow];
    const model = build(input);

    expect(model.days.map((day) => day.dateISO)).toEqual([
      '2026-10-01',
      '2026-10-02',
    ]);
    expect(model.days[1].rows.map((item) => item.description)).toEqual([
      'first on second day',
      'second on second day',
    ]);
    expect(model.rows).toEqual(input);
    expect(model.period).toEqual({ daysWithSpend: 2, daysInPeriod: 31 });
  });

  it('keeps user strings raw and original amounts paired with their currencies', () => {
    const input = [
      row({
        purchaseKey: 'manual-rsd',
        place: '<Store & "Co">',
        category: 'Other <personal>',
        description: 'Say "hi" & pay',
        amountOriginalCents: 12345,
        currencyOriginal: 'RSD',
      }),
      row({
        purchaseKey: 'manual-eur',
        amountOriginalCents: 6789,
        currencyOriginal: 'EUR',
      }),
    ];
    const model = build(input);

    expect(model.rows[0]).toMatchObject({
      place: '<Store & "Co">',
      category: 'Other <personal>',
      description: 'Say "hi" & pay',
    });
    expect(
      model.rows.map(({ amountOriginalCents, currencyOriginal }) => ({
        amountOriginalCents,
        currencyOriginal,
      })),
    ).toEqual([
      { amountOriginalCents: 12345, currencyOriginal: 'RSD' },
      { amountOriginalCents: 6789, currencyOriginal: 'EUR' },
    ]);
    expect(model.title).toBe('Fintrack');
    expect(model.periodLabel).toBe('October 2026');
    expect(model.labels).toBe(meta.pdf);
  });
});
