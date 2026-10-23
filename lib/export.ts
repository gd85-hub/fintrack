import * as XLSX from 'xlsx';

// Pure export builders: take already-prepared, already-localized rows plus
// localized column headers / meta, and produce CSV / XLSX / PDF-HTML. No React,
// no Platform, no file IO, no i18n, no FX recompute — the caller (EXPORT-2)
// resolves labels and money and does the native print/share wiring.

export type ExportRow = {
  dateISO: string; // 'YYYY-MM-DD' — for CSV/Excel (sortable)
  dateLabel: string; // localized, e.g. '29 July' — for PDF
  place: string; // merchant name, or '' if none
  category: string; // already localized (system via catalog, user as-is)
  group: string; // already localized
  description: string; // item/expense description, may be ''
  amountOriginal: number; // major units, e.g. 1234.56
  currencyOriginal: string; // e.g. 'RSD','EUR'
  amountRsd: number; // major units
  amountEur: number;
  amountUsd: number;
  type: string; // already localized 'Fixed'/'Variable' (or '')
};

export type ExportColumns = {
  date: string;
  place: string;
  category: string;
  group: string;
  description: string;
  amount: string;
  currency: string;
  rsd: string;
  eur: string;
  usd: string;
  type: string;
  total: string;
};

export type ExportMeta = {
  title: string; // e.g. 'Fintrack'
  periodLabel: string; // e.g. 'Октябрь 2026' / 'October 2026'
  totalsLabel: string; // localized 'Итого' / 'Total'
  summaryTitle?: string; // PDF only, e.g. 'Топ категорий' / 'Top categories'
  topCategories?: { label: string; amountRsd: number }[]; // PDF summary
};

// Round to 2 decimals, dot separator, no grouping. For CSV/Excel values.
function money2(value: number): string {
  return value.toFixed(2);
}

function sumBy(
  rows: readonly ExportRow[],
  pick: (row: ExportRow) => number,
): number {
  // Round the running sum to cents to avoid float drift in the totals cell.
  return Math.round(rows.reduce((total, row) => total + pick(row), 0) * 100) / 100;
}

// ---------- CSV ----------

const CSV_BOM = '﻿';

function csvCell(value: string | number): string {
  const text = typeof value === 'number' ? money2(value) : value;
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv(
  rows: readonly ExportRow[],
  columns: ExportColumns,
  meta: ExportMeta,
): string {
  const header = [
    columns.date,
    columns.place,
    columns.category,
    columns.group,
    columns.description,
    columns.amount,
    columns.currency,
    columns.rsd,
    columns.eur,
    columns.usd,
    columns.type,
  ];

  const lines: string[][] = [header];

  for (const row of rows) {
    lines.push([
      row.dateISO,
      row.place,
      row.category,
      row.group,
      row.description,
      money2(row.amountOriginal),
      row.currencyOriginal,
      money2(row.amountRsd),
      money2(row.amountEur),
      money2(row.amountUsd),
      row.type,
    ]);
  }

  lines.push([
    meta.totalsLabel,
    '',
    '',
    '',
    '',
    '',
    '',
    money2(sumBy(rows, (row) => row.amountRsd)),
    money2(sumBy(rows, (row) => row.amountEur)),
    money2(sumBy(rows, (row) => row.amountUsd)),
    '',
  ]);

  const body = lines
    .map((cells) => cells.map(csvCell).join(','))
    .join('\r\n');

  return `${CSV_BOM}${body}`;
}

// ---------- XLSX ----------

function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, ' ').trim();
  return (cleaned || 'Sheet').slice(0, 31);
}

export function buildXlsx(
  rows: readonly ExportRow[],
  columns: ExportColumns,
  meta: ExportMeta,
): Uint8Array {
  const header = [
    columns.date,
    columns.place,
    columns.category,
    columns.group,
    columns.description,
    columns.amount,
    columns.currency,
    columns.rsd,
    columns.eur,
    columns.usd,
    columns.type,
  ];

  const aoa: (string | number)[][] = [header];

  for (const row of rows) {
    aoa.push([
      row.dateISO,
      row.place,
      row.category,
      row.group,
      row.description,
      row.amountOriginal,
      row.currencyOriginal,
      row.amountRsd,
      row.amountEur,
      row.amountUsd,
      row.type,
    ]);
  }

  aoa.push([
    meta.totalsLabel,
    '',
    '',
    '',
    '',
    '',
    '',
    sumBy(rows, (row) => row.amountRsd),
    sumBy(rows, (row) => row.amountEur),
    sumBy(rows, (row) => row.amountUsd),
    '',
  ]);

  const sheet = XLSX.utils.aoa_to_sheet(aoa);

  // Numeric format on the amount columns: amount(5), rsd(7), eur(8), usd(9).
  const numericColumns = [5, 7, 8, 9];
  for (let rowIndex = 1; rowIndex < aoa.length; rowIndex += 1) {
    for (const columnIndex of numericColumns) {
      const ref = XLSX.utils.encode_cell({ c: columnIndex, r: rowIndex });
      const cell = sheet[ref] as XLSX.CellObject | undefined;
      if (cell && cell.t === 'n') {
        cell.z = '#,##0.00';
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    sheet,
    sanitizeSheetName(meta.periodLabel),
  );

  // xlsx returns an ArrayBuffer for type 'array'; normalize to a Uint8Array
  // so EXPORT-2 can hand it straight to file/share APIs.
  const written = XLSX.write(workbook, {
    type: 'array',
    bookType: 'xlsx',
  }) as ArrayBuffer;
  return new Uint8Array(written);
}

// ---------- PDF (HTML) ----------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Display formatting for the PDF only: 2 decimals + a thin-space thousands
// separator. Not used for CSV/Excel (those stay machine-parseable).
function moneyDisplay(value: number): string {
  const fixed = value.toFixed(2);
  const negative = fixed.startsWith('-');
  const unsigned = negative ? fixed.slice(1) : fixed;
  const [intPart, decimals] = unsigned.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${negative ? '-' : ''}${grouped}.${decimals}`;
}

export function buildExpensesPdfHtml(
  rows: readonly ExportRow[],
  columns: ExportColumns,
  meta: ExportMeta,
): string {
  const rsdLabel = escapeHtml(columns.rsd);
  const grandTotalRsd = sumBy(rows, (row) => row.amountRsd);

  const summaryLines: string[] = [
    `<p class="total">${escapeHtml(meta.totalsLabel)}: ${moneyDisplay(
      grandTotalRsd,
    )} ${rsdLabel}</p>`,
  ];

  if (meta.topCategories && meta.topCategories.length > 0) {
    const items = meta.topCategories
      .map(
        (entry) =>
          `<li>${escapeHtml(entry.label)} · ${moneyDisplay(
            entry.amountRsd,
          )} ${rsdLabel}</li>`,
      )
      .join('');
    const summaryTitle = meta.summaryTitle
      ? `<h2>${escapeHtml(meta.summaryTitle)}</h2>`
      : '';
    summaryLines.push(`${summaryTitle}<ul class="top">${items}</ul>`);
  }

  const headerCells = [
    columns.date,
    columns.place,
    columns.category,
    columns.amount,
    columns.rsd,
  ]
    .map((label) => `<th>${escapeHtml(label)}</th>`)
    .join('');

  const bodyRows = rows
    .map((row) => {
      const amountCell = `${moneyDisplay(row.amountOriginal)} ${escapeHtml(
        row.currencyOriginal,
      )}`;
      return (
        '<tr>' +
        `<td>${escapeHtml(row.dateLabel)}</td>` +
        `<td>${escapeHtml(row.place)}</td>` +
        `<td>${escapeHtml(row.category)}</td>` +
        `<td class="num">${amountCell}</td>` +
        `<td class="num">${moneyDisplay(row.amountRsd)}</td>` +
        '</tr>'
      );
    })
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif;
    color: #1a1a1a;
    margin: 24px;
    font-size: 12px;
  }
  h1 { font-size: 18px; margin: 0; }
  .period { color: #6b6b6b; font-size: 12px; margin: 2px 0 16px; }
  .total { font-weight: 600; margin: 0 0 4px; }
  h2 { font-size: 12px; color: #6b6b6b; margin: 12px 0 4px; font-weight: 600; }
  ul.top { margin: 0 0 16px; padding-left: 16px; color: #333; }
  ul.top li { margin: 1px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td {
    text-align: left;
    padding: 6px 8px;
    border-bottom: 1px solid #e3e3e3;
    vertical-align: top;
  }
  th {
    font-size: 11px;
    color: #6b6b6b;
    font-weight: 600;
    border-bottom: 1px solid #bdbdbd;
  }
  td.num, th:nth-child(4), th:nth-child(5) { text-align: right; white-space: nowrap; }
  tbody tr:nth-child(even) { background: #fafafa; }
</style>
</head>
<body>
<h1>${escapeHtml(meta.title)}</h1>
<div class="period">${escapeHtml(meta.periodLabel)}</div>
${summaryLines.join('\n')}
<table>
<thead><tr>${headerCells}</tr></thead>
<tbody>${bodyRows}</tbody>
</table>
</body>
</html>`;
}
