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

  it('doubles quotes inside a quoted description cell', () => {
    const csvRows: ExportRow[] = [
      {
        ...rows[0],
        description: 'Say "hi"',
      },
    ];

    const csv = buildCsv(csvRows, columns, meta);

    expect(csv.includes('"Say ""hi"""')).toBe(true);
  });

  it('preserves an embedded newline inside a quoted place cell', () => {
    const csvRows: ExportRow[] = [
      {
        ...rows[0],
        place: 'Line1\nLine2',
      },
    ];

    const csv = buildCsv(csvRows, columns, meta);

    expect(csv.includes('"Line1\nLine2"')).toBe(true);
  });

  it('writes only the header and zero totals for empty rows', () => {
    const csv = buildCsv([], columns, meta);
    const lines = csv.slice(1).split('\r\n');

    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('Total,,,,,,,0.00,0.00,0.00,');
  });

  it('formats a negative amount with two dot-decimal places', () => {
    const csvRows: ExportRow[] = [
      {
        ...rows[0],
        amountRsd: -12.5,
      },
    ];

    const csv = buildCsv(csvRows, columns, meta);

    expect(csv).toContain('-12.50');
  });

  it('passes Cyrillic text through without unnecessary quoting', () => {
    const csvRows: ExportRow[] = [
      {
        ...rows[0],
        category: 'Продукты',
      },
    ];

    const csv = buildCsv(csvRows, columns, meta);

    expect(csv).toContain(',Продукты,');
  });

  it('rounds floating-point totals to cents', () => {
    const csvRows: ExportRow[] = [
      {
        ...rows[0],
        amountRsd: 0.1,
        amountEur: 0,
        amountUsd: 0,
      },
      {
        ...rows[1],
        amountRsd: 0.2,
        amountEur: 0,
        amountUsd: 0,
      },
    ];

    const csv = buildCsv(csvRows, columns, meta);
    const totals = csv.slice(1).split('\r\n').at(-1)?.split(',');

    expect(totals?.[7]).toBe('0.30');
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

  it('sanitizes forbidden characters in the sheet name', () => {
    const bytes = buildXlsx(rows, columns, {
      ...meta,
      periodLabel: 'Q1 2026 / Report:final',
    });
    const workbook = XLSX.read(bytes, { type: 'array' });
    const sheetName = workbook.SheetNames[0];

    expect(sheetName).not.toContain('/');
    expect(sheetName).not.toContain(':');
    expect(sheetName.length).toBeLessThanOrEqual(31);
  });

  it('uses the default sheet name for an empty period label', () => {
    const bytes = buildXlsx(rows, columns, {
      ...meta,
      periodLabel: '',
    });
    const workbook = XLSX.read(bytes, { type: 'array' });

    expect(workbook.SheetNames[0]).toBe('Sheet');
  });

  it('keeps the original amount as a numeric cell', () => {
    const bytes = buildXlsx(rows, columns, meta);
    const workbook = XLSX.read(bytes, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    expect(sheet.F2.t).toBe('n');
    expect(sheet.F2.v).toBe(rows[0].amountOriginal);
  });

  it('keeps EUR and USD totals as numeric cells', () => {
    const bytes = buildXlsx(rows, columns, meta);
    const workbook = XLSX.read(bytes, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const totalsRowNumber = rows.length + 2;

    expect(sheet[`I${totalsRowNumber}`].t).toBe('n');
    expect(sheet[`J${totalsRowNumber}`].t).toBe('n');
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
