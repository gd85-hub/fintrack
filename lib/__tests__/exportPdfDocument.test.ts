import { describe, expect, it } from '@jest/globals';

import type { ExportColumns, ExportMeta, ExportRow } from '../export';
import { buildPdfDocument } from '../exportPdfDocument';
import { buildPdfReportModel } from '../exportPdfModel';

const columns: ExportColumns = {
  date: 'Date',
  place: 'Place',
  category: 'Category',
  group: 'Group',
  description: 'Description',
  amount: 'Original amount',
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
    generated: 'Generated 24/11/2026',
    totalSpending: 'Total spending',
    count: 'Purchases',
    average: 'Average purchase',
    activeDays: 'Spending days',
    largest: 'Largest purchase',
    categories: 'Spending by category',
    details: 'Details',
    other: 'Other categories',
  },
};

const baseRow: ExportRow = {
  purchaseKey: 'manual-1',
  dateISO: '2026-10-01',
  dateLabel: '1 October',
  place: 'Магазин «У дома»',
  category: 'Groceries',
  group: 'Food',
  description: 'Milk',
  amountOriginalCents: 123456,
  currencyOriginal: 'RSD',
  amountRsdCents: 123456,
  amountEurCents: 1050,
  amountUsdCents: 1125,
  type: 'Variable',
};

function row(overrides: Partial<ExportRow>): ExportRow {
  return { ...baseRow, ...overrides };
}

function build(rows: readonly ExportRow[]) {
  return buildPdfDocument(buildPdfReportModel(rows, columns, meta));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectText(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectText);
  }
  if (!isRecord(value)) {
    return [];
  }
  return Object.values(value).flatMap(collectText);
}

function collectRecords(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectRecords);
  }
  if (!isRecord(value)) {
    return [];
  }
  return [value, ...Object.values(value).flatMap(collectRecords)];
}

describe('buildPdfDocument', () => {
  it('renders the complete report hierarchy from the prepared model', () => {
    const document = build([
      baseRow,
      row({
        purchaseKey: 'receipt-1',
        dateISO: '2026-10-02',
        dateLabel: '2 October',
        place: 'Cafe',
        category: 'Dining',
        amountOriginalCents: 987,
        amountRsdCents: 987,
        amountEurCents: 8,
        amountUsdCents: 9,
      }),
    ]);
    const text = collectText(document.content).join('\n');

    expect(document.pageSize).toBe('A4');
    expect(document.pageOrientation).toBe('portrait');
    expect(text).toContain('Fintrack');
    expect(text).toContain('EXPENSE REPORT');
    expect(text).toContain('October 2026');
    expect(text).toContain('TOTAL SPENDING');
    expect(text).toContain('1\u2009244.43');
    expect(text).toContain('1\u2009234.56 RSD');
    expect(text).toContain('Магазин «У дома»');
    expect(text).toContain('Spending by category');
    expect(text).toContain('Details');
    expect(text).toContain('9.87 RSD');
    expect(text).toContain('9.87');
  });

  it('preserves nullable EUR as an unavailable warning, never zero', () => {
    const document = build([
      row({ amountEurCents: null }),
      row({ purchaseKey: 'manual-2', amountEurCents: 100 }),
    ]);
    const text = collectText(document.content).join('\n');

    expect(text).toContain('Unavailable: EUR (1)');
    expect(text).toContain('—');
    expect(text).not.toContain('0.00 EUR');
  });

  it('keeps a real Other separate from aggregated Other categories', () => {
    const amounts = [1000, 900, 800, 700, 600, 500, 400, 300];
    const document = build(
      amounts.map((amountRsdCents, index) =>
        row({
          purchaseKey: `manual-${index}`,
          category: index === 0 ? 'Other' : `Category ${index + 1}`,
          amountRsdCents,
        }),
      ),
    );
    const text = collectText(document.content);

    expect(text).toContain('Other');
    expect(text).toContain('Other categories');
    expect(text).toContain('10.00 RSD');
    expect(text).toContain('7.00 RSD');
  });

  it('keeps each day heading with its first row while the remainder stays breakable', () => {
    const document = build(
      Array.from({ length: 80 }, (_, index) =>
        row({
          purchaseKey: `manual-${index}`,
          place: `Row-${String(index + 1).padStart(3, '0')}`,
        }),
      ),
    );
    const records = collectRecords(document.content);
    const dayLead = records.find((record) => {
      const table = record.table;
      return isRecord(table) && table.headerRows === 1 && table.keepWithHeaderRows === 1;
    });
    const leadTable = dayLead?.table;
    const remainder = records.find((record) => {
      const table = record.table;
      return isRecord(table) && Array.isArray(table.body) && table.body.length === 79;
    });

    expect(isRecord(leadTable)).toBe(true);
    if (!isRecord(leadTable)) {
      throw new Error('Expected a day lead table.');
    }
    expect(leadTable.headerRows).toBe(1);
    expect(leadTable.keepWithHeaderRows).toBe(1);
    expect(leadTable.dontBreakRows).toBe(true);
    expect((leadTable.body as readonly unknown[]).length).toBe(2);
    expect(remainder).toBeDefined();
    expect(isRecord(remainder?.table) && remainder.table.dontBreakRows).toBe(true);
    expect(collectText(document.header(2))).toEqual(expect.arrayContaining([
      'Place',
      'Category',
      'Original amount',
      'RSD',
    ]));
  });

  it('renders an empty period without inventing financial values', () => {
    const document = build([]);
    const text = collectText(document.content).join('\n');

    expect(text).toContain('0.00');
    expect(text).toContain('0 / 31');
    expect(text).toContain('—');
    expect(document.footer(1, 1)).toEqual(expect.objectContaining({
      columns: expect.any(Array),
    }));
  });
});
