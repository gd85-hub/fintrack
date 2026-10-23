import { describe, expect, it } from '@jest/globals';
import * as XLSX from 'xlsx';

import {
  buildCsv,
  buildExpensesPdfHtml,
  buildXlsx,
  type ExportColumns,
  type ExportMeta,
  type ExportRow,
} from '../export';

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
  summaryTitle: 'Top categories',
  topCategories: [{ label: 'Groceries', amountRsd: 199.99 }],
};

const rows: ExportRow[] = [
  {
    dateISO: '2026-10-05',
    dateLabel: '5 October',
    place: 'Lidl',
    category: 'Groceries',
    group: 'Food',
    description: 'Bread',
    amountOriginal: 199.99,
    currencyOriginal: 'RSD',
    amountRsd: 199.99,
    amountEur: 1.71,
    amountUsd: 1.85,
    type: 'Variable',
  },
  {
    dateISO: '2026-10-06',
    dateLabel: '6 October',
    place: 'Cafe, Bar',
    category: 'Cafés & restaurants',
    group: 'Food',
    description: 'Coffee',
    amountOriginal: 250,
    currencyOriginal: 'RSD',
    amountRsd: 250,
    amountEur: 2.14,
    amountUsd: 2.31,
    type: 'Variable',
  },
];

describe('buildCsv', () => {
  it('writes a BOM, exact header, quoted fields, dot decimals, and totals', () => {
    const csv = buildCsv(rows, columns, meta);

    expect(csv.startsWith('﻿')).toBe(true);

    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe(
      'Date,Place,Category,Group,Description,Amount,Currency,RSD,EUR,USD,Type',
    );
    expect(lines[1]).toBe(
      '2026-10-05,Lidl,Groceries,Food,Bread,199.99,RSD,199.99,1.71,1.85,Variable',
    );
    // Place with a comma must be quoted.
    expect(lines[2]).toBe(
      '2026-10-06,"Cafe, Bar",Cafés & restaurants,Food,Coffee,250.00,RSD,250.00,2.14,2.31,Variable',
    );
    // Totals: label in the date cell, summed rsd/eur/usd, other cells empty.
    expect(lines[3]).toBe('Total,,,,,,,449.99,3.85,4.16,');
  });
});

describe('buildXlsx', () => {
  it('returns a non-empty workbook with the date header and a numeric totals cell', () => {
    const bytes = buildXlsx(rows, columns, meta);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);

    const workbook = XLSX.read(bytes, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // A1 is the first (date) header.
    expect(sheet.A1.v).toBe('Date');
    // Totals RSD cell (column H, row 4 = header + 2 data rows) is a real number.
    expect(sheet.H4.t).toBe('n');
    expect(sheet.H4.v).toBeCloseTo(449.99, 2);
  });
});

describe('buildExpensesPdfHtml', () => {
  it('is self-contained, includes the period, and escapes data', () => {
    const htmlRows: ExportRow[] = [
      {
        ...rows[0],
        place: 'A & B',
        category: '<x>',
      },
    ];
    const html = buildExpensesPdfHtml(htmlRows, columns, meta);

    expect(html).toContain('October 2026');
    expect(html).toContain('A &amp; B');
    expect(html).toContain('&lt;x&gt;');
    // No unescaped markup leaked from data.
    expect(html).not.toContain('<x>');
  });
});
