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
  unavailableLabel: 'Unavailable',
  summaryTitle: 'Top categories',
  topCategories: [{ label: 'Groceries', amountRsd: 199.99 }],
};

const rows: ExportRow[] = [
  {
    purchaseKey: 'expense-1',
    dateISO: '2026-10-05',
    dateLabel: '5 October',
    place: 'Lidl',
    category: 'Groceries',
    group: 'Food',
    description: 'Bread',
    amountOriginalCents: 19999,
    currencyOriginal: 'RSD',
    amountRsdCents: 19999,
    amountEurCents: 171,
    amountUsdCents: 185,
    type: 'Variable',
  },
  {
    purchaseKey: 'expense-2',
    dateISO: '2026-10-06',
    dateLabel: '6 October',
    place: 'Cafe, Bar',
    category: 'Cafés & restaurants',
    group: 'Food',
    description: 'Coffee',
    amountOriginalCents: 25000,
    currencyOriginal: 'RSD',
    amountRsdCents: 25000,
    amountEurCents: 214,
    amountUsdCents: 231,
    type: 'Variable',
  },
];

function parseCsv(csv: string): string[][] {
  const source = csv.startsWith('﻿') ? csv.slice(1) : csv;
  const parsed: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\r' && source[index + 1] === '\n') {
      row.push(cell);
      parsed.push(row);
      row = [];
      cell = '';
      index += 1;
    } else {
      cell += character;
    }
  }

  row.push(cell);
  parsed.push(row);
  return parsed;
}

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
        amountRsdCents: -1250,
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

  it('sums integer cents exactly', () => {
    const csvRows: ExportRow[] = [
      {
        ...rows[0],
        amountRsdCents: 10,
        amountEurCents: 0,
        amountUsdCents: 0,
      },
      {
        ...rows[1],
        amountRsdCents: 20,
        amountEurCents: 0,
        amountUsdCents: 0,
      },
    ];

    const csv = buildCsv(csvRows, columns, meta);
    const totals = csv.slice(1).split('\r\n').at(-1)?.split(',');

    expect(totals?.[7]).toBe('0.30');
  });

  it('round-trips Unicode, quotes, commas, and embedded newlines independently', () => {
    const csvRows: ExportRow[] = [
      {
        ...rows[0],
        place: 'Магазин, «У дома»',
        description: 'Строка 1\nSay "hi"',
      },
    ];

    const parsed = parseCsv(buildCsv(csvRows, columns, meta));

    expect(parsed).toHaveLength(3);
    expect(parsed[1][1]).toBe('Магазин, «У дома»');
    expect(parsed[1][4]).toBe('Строка 1\nSay "hi"');
    expect(parsed[1][5]).toBe('199.99');
  });

  it('keeps unavailable EUR cells and the EUR total empty and adds a warning', () => {
    const csvRows: ExportRow[] = [{ ...rows[0], amountEurCents: null }];
    const parsed = parseCsv(buildCsv(csvRows, columns, meta));

    expect(parsed[1][8]).toBe('');
    expect(parsed[2][8]).toBe('');
    expect(parsed[3][0]).toBe('Unavailable: EUR (1)');
  });

  it('exports 1,001 rows with an exact row count and exact totals', () => {
    const manyRows = Array.from({ length: 1001 }, (_, index) => ({
      ...rows[0],
      description: `Позиция ${index + 1}`,
      amountOriginalCents: 123,
      amountRsdCents: 123,
      amountEurCents: 1,
      amountUsdCents: 2,
    }));
    const parsed = parseCsv(buildCsv(manyRows, columns, meta));

    expect(parsed).toHaveLength(1003);
    expect(parsed[1002][7]).toBe('1231.23');
    expect(parsed[1002][8]).toBe('10.01');
    expect(parsed[1002][9]).toBe('20.02');
  });

  it('serializes a large safe-integer amount without grouping or precision drift', () => {
    const csvRows: ExportRow[] = [
      {
        ...rows[0],
        amountOriginalCents: 987654321098,
        amountRsdCents: 987654321098,
      },
    ];
    const parsed = parseCsv(buildCsv(csvRows, columns, meta));

    expect(parsed[1][5]).toBe('9876543210.98');
    expect(parsed[2][7]).toBe('9876543210.98');
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

  it('returns a ZIP-based XLSX binary with a valid end-of-central-directory record', () => {
    const bytes = buildXlsx(rows, columns, meta);
    const binary = Buffer.from(bytes);

    expect(binary.subarray(0, 4).toString('hex')).toBe('504b0304');
    expect(binary.lastIndexOf(Buffer.from('504b0506', 'hex'))).toBeGreaterThan(0);
    expect(() => XLSX.read(bytes, { type: 'array' })).not.toThrow();
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
    expect(sheet.F2.v).toBe(rows[0].amountOriginalCents / 100);
  });

  it('keeps EUR and USD totals as numeric cells', () => {
    const bytes = buildXlsx(rows, columns, meta);
    const workbook = XLSX.read(bytes, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const totalsRowNumber = rows.length + 2;

    expect(sheet[`I${totalsRowNumber}`].t).toBe('n');
    expect(sheet[`J${totalsRowNumber}`].t).toBe('n');
  });

  it('keeps unavailable EUR cells and the EUR total empty and adds a warning', () => {
    const bytes = buildXlsx([{ ...rows[0], amountEurCents: null }], columns, meta);
    const workbook = XLSX.read(bytes, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    expect(sheet.I2.v).toBe('');
    expect(sheet.I3.v).toBe('');
    expect(sheet.A4.v).toBe('Unavailable: EUR (1)');
  });

  it('reopens a 1,001-row Unicode workbook with the expected range and totals', () => {
    const manyRows = Array.from({ length: 1001 }, (_, index) => ({
      ...rows[0],
      place: `Место ${index + 1}`,
      amountOriginalCents: 123,
      amountRsdCents: 123,
      amountEurCents: 1,
      amountUsdCents: 2,
    }));
    const bytes = buildXlsx(manyRows, columns, meta);
    const workbook = XLSX.read(bytes, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    expect(sheet['!ref']).toBe('A1:K1003');
    expect(sheet.B1002.v).toBe('Место 1001');
    expect(sheet.H1003.v).toBeCloseTo(1231.23, 2);
    expect(sheet.I1003.v).toBeCloseTo(10.01, 2);
    expect(sheet.J1003.v).toBeCloseTo(20.02, 2);
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

  it('shows unavailable EUR honestly instead of rendering a zero equivalent', () => {
    const html = buildExpensesPdfHtml(
      [{ ...rows[0], amountEurCents: null }],
      columns,
      meta,
    );

    expect(html).toContain('<b>—</b> EUR');
    expect(html).toContain('Unavailable: EUR (1)');
    expect(html).not.toContain('<b>0</b> EUR');
    expect(html).toContain('199.99<span class="cur">RSD</span>');
    expect(html).toContain('<b>1.85</b> USD');
  });

  it.each([
    [1, '0.01'],
    [49, '0.49'],
    [50, '0.50'],
    [12375, '123.75'],
    [123456, '1\u2009234.56'],
  ])('renders %i cents exactly in PDF detail rows', (amountCents, expected) => {
    const html = buildExpensesPdfHtml(
      [
        {
          ...rows[0],
          amountOriginalCents: amountCents,
          amountRsdCents: amountCents,
        },
      ],
      columns,
      meta,
    );

    expect(html).toContain(
      `<td class="num orig">${expected} RSD</td><td class="num rsd">${expected}</td>`,
    );
    expect(html).toContain(
      `<div class="total-num">${expected}<span class="cur">RSD</span></div>`,
    );
  });

  it('preserves cents in equivalents and uses thin-space grouping for a large total', () => {
    const html = buildExpensesPdfHtml(
      [
        {
          ...rows[0],
          amountOriginalCents: 987654321098,
          amountRsdCents: 987654321098,
          amountEurCents: 49,
          amountUsdCents: 50,
        },
      ],
      columns,
      meta,
    );

    expect(html).toContain(
      '<div class="total-num">9\u2009876\u2009543\u2009210.98<span class="cur">RSD</span></div>',
    );
    expect(html).toContain('<div class="equiv">≈ <b>0.49</b> EUR · <b>0.50</b> USD</div>');
  });

  it('keeps category and day totals equal to their exact fractional row sum', () => {
    const html = buildExpensesPdfHtml(
      [
        {
          ...rows[0],
          purchaseKey: 'manual-1',
          amountOriginalCents: 12375,
          amountRsdCents: 12375,
        },
        {
          ...rows[0],
          purchaseKey: 'manual-2',
          amountOriginalCents: 50,
          amountRsdCents: 50,
        },
      ],
      columns,
      meta,
    );

    expect(html).toContain('<span class="cat-amt">124.25 RSD');
    expect(html).toContain('<td class="num daytot">124.25 RSD</td>');
    expect(html).toContain('<td class="num rsd">123.75</td>');
    expect(html).toContain('<td class="num rsd">0.50</td>');
    expect(html).toContain(
      '<div class="total-num">124.25<span class="cur">RSD</span></div>',
    );
  });

  it('preserves cents when lower-ranked categories are combined into Other', () => {
    const categoryAmounts = [800, 700, 600, 500, 400, 300, 225, 150];
    const html = buildExpensesPdfHtml(
      categoryAmounts.map((amountRsdCents, index) => ({
        ...rows[0],
        purchaseKey: `manual-${index}`,
        category: `Category ${index + 1}`,
        amountRsdCents,
      })),
      columns,
      meta,
    );

    expect(html).toContain('>Other</span>');
    expect(html).toContain('<span class="cat-amt">3.75 RSD');
  });

  it('counts purchases and aggregates receipt lines for average and largest metrics', () => {
    const pdfMeta: ExportMeta = {
      ...meta,
      pdf: {
        report: 'Report',
        generated: '',
        totalSpending: 'Total spending',
        count: 'Purchases',
        average: 'Average purchase',
        activeDays: 'Active days',
        largest: 'Largest purchase',
        categories: 'Categories',
        details: 'Details',
        other: 'Other',
      },
    };
    const pdfRows: ExportRow[] = [
      {
        ...rows[0],
        purchaseKey: 'receipt-1',
        place: 'Receipt shop',
        amountRsdCents: 10001,
      },
      {
        ...rows[0],
        purchaseKey: 'receipt-1',
        place: 'Receipt shop',
        amountRsdCents: 5000,
      },
      {
        ...rows[1],
        purchaseKey: 'manual-expense-1',
        place: 'Manual shop',
        amountRsdCents: 19999,
      },
      {
        ...rows[1],
        purchaseKey: 'manual-expense-2',
        place: 'Small manual shop',
        amountRsdCents: 1,
      },
      {
        ...rows[1],
        purchaseKey: 'manual-expense-3',
        place: 'Another manual shop',
        amountRsdCents: 1,
      },
    ];
    const html = buildExpensesPdfHtml(pdfRows, columns, pdfMeta);

    expect(html).toContain(
      '<div class="stat-label">Purchases</div><div class="stat-value">4</div>',
    );
    expect(html).toContain(
      '<div class="stat-label">Average purchase</div><div class="stat-value">87.51 RSD</div>',
    );
    expect(html).toContain(
      '<div class="stat-label">Largest purchase</div><div class="stat-value">199.99 RSD</div><div class="stat-sub">Manual shop</div>',
    );
  });
});
