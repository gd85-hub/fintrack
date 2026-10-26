import * as XLSX from 'xlsx';

import { lightColor } from './theme';

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

export type ExportPdfLabels = {
  report: string;
  generated: string;
  totalSpending: string;
  count: string;
  average: string;
  activeDays: string;
  largest: string;
  categories: string;
  details: string;
  other: string;
};

export type ExportMeta = {
  title: string; // e.g. 'Fintrack'
  periodLabel: string; // e.g. 'Октябрь 2026' / 'October 2026'
  totalsLabel: string; // localized 'Итого' / 'Total'
  summaryTitle?: string; // PDF only, e.g. 'Топ категорий' / 'Top categories'
  topCategories?: { label: string; amountRsd: number }[]; // PDF summary
  pdf?: ExportPdfLabels;
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

const PDF = {
  ink: lightColor.text.primary,
  sub: lightColor.text.secondary,
  faint: lightColor.text.tertiary,
  line: lightColor.border.default,
  hair: lightColor.border.subtle,
  accent: lightColor.action.primary.fill,
  tile: lightColor.bg.base,
  cat: lightColor.data.categorical,
} as const;

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

// Whole RSD with space thousands — for the statement's RSD figures.
function moneyWhole(value: number): string {
  const n = Math.round(value);
  const negative = n < 0;
  const grouped = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${negative ? '-' : ''}${grouped}`;
}

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
  other: 'Other',
};

export function buildExpensesPdfHtml(
  rows: readonly ExportRow[],
  columns: ExportColumns,
  meta: ExportMeta,
): string {
  const L = meta.pdf ?? PDF_FALLBACK;
  const rsd = escapeHtml(columns.rsd);
  const eur = escapeHtml(columns.eur);
  const usd = escapeHtml(columns.usd);

  const totalRsd = sumBy(rows, (r) => r.amountRsd);
  const totalEur = sumBy(rows, (r) => r.amountEur);
  const totalUsd = sumBy(rows, (r) => r.amountUsd);
  const count = rows.length;
  const avg = count > 0 ? totalRsd / count : 0;
  const maxRow = rows.reduce<ExportRow | null>(
    (m, r) => (m === null || r.amountRsd > m.amountRsd ? r : m),
    null,
  );

  // ---- by category (top 6 + "Прочее") ----
  const catMap = new Map<string, number>();
  for (const r of rows) {
    catMap.set(r.category, (catMap.get(r.category) ?? 0) + r.amountRsd);
  }
  const cats = [...catMap.entries()]
    .map(([label, amt]) => ({ label, amt, other: false }))
    .sort((a, b) => b.amt - a.amt);
  const MAX_ROWS = 7;
  let shown = cats;
  if (cats.length > MAX_ROWS) {
    const head = cats.slice(0, MAX_ROWS - 1);
    const restAmt = cats.slice(MAX_ROWS - 1).reduce((t, c) => t + c.amt, 0);
    shown = [...head, { label: L.other, amt: restAmt, other: true }];
  }
  const catMax = Math.max(...shown.map((c) => c.amt), 1);

  // ---- active days + detail groups ----
  const dayMap = new Map<string, number>();
  for (const r of rows) {
    dayMap.set(r.dateISO, (dayMap.get(r.dateISO) ?? 0) + r.amountRsd);
  }
  const daysWithSpend = dayMap.size;
  const firstISO = rows.map((r) => r.dateISO).sort()[0] ?? '1970-01-01';
  const [yy, mm] = firstISO.split('-').map((p) => Number(p));
  const daysInMonth = new Date(yy, mm, 0).getDate();

  const groups = [...dayMap.keys()].sort().map((iso) => {
    const groupRows = rows.filter((r) => r.dateISO === iso);
    return {
      dateLabel: groupRows[0].dateLabel,
      total: sumBy(groupRows, (r) => r.amountRsd),
      rows: groupRows,
    };
  });

  // ---- render pieces ----
  const tiles = [
    { label: L.count, value: String(count) },
    { label: L.average, value: `${moneyWhole(avg)} ${rsd}` },
    { label: L.activeDays, value: `${daysWithSpend} / ${daysInMonth}` },
    {
      label: L.largest,
      value: maxRow ? `${moneyWhole(maxRow.amountRsd)} ${rsd}` : '—',
      sub: maxRow ? escapeHtml(maxRow.place || maxRow.category) : '',
    },
  ]
    .map(
      (t) =>
        `<div class="stat"><div class="stat-label">${escapeHtml(
          t.label,
        )}</div><div class="stat-value">${t.value}</div>${
          t.sub ? `<div class="stat-sub">${t.sub}</div>` : ''
        }</div>`,
    )
    .join('');

  const catRows = shown
    .map((c, i) => {
      const pct = totalRsd > 0 ? (c.amt / totalRsd) * 100 : 0;
      const w = (c.amt / catMax) * 100;
      const color = c.other ? PDF.faint : PDF.cat[i % PDF.cat.length];
      return (
        `<div class="catrow"><div class="cat-top">` +
        `<span class="cat-name"><span class="dot" style="background:${color}"></span>${escapeHtml(
          c.label,
        )}</span>` +
        `<span class="cat-amt">${moneyWhole(c.amt)} ${rsd}<span class="cat-pct">${pct.toFixed(
          1,
        )}%</span></span></div>` +
        `<div class="track"><div class="fill" style="width:${w.toFixed(
          1,
        )}%;background:${color}"></div></div></div>`
      );
    })
    .join('');

  const detail = groups
    .map((g) => {
      const items = g.rows
        .map(
          (r, i) =>
            `<tr class="${i % 2 ? 'odd' : ''}">` +
            `<td class="place">${escapeHtml(r.place || '—')}</td>` +
            `<td class="cat">${escapeHtml(r.category)}</td>` +
            `<td class="num orig">${moneyDisplay(r.amountOriginal)} ${escapeHtml(
              r.currencyOriginal,
            )}</td>` +
            `<td class="num rsd">${moneyWhole(r.amountRsd)}</td></tr>`,
        )
        .join('');
      return (
        `<tbody class="daygroup"><tr class="dayhead">` +
        `<td colspan="3"><span class="daydate">${escapeHtml(
          g.dateLabel,
        )}</span></td>` +
        `<td class="num daytot">${moneyWhole(g.total)} ${rsd}</td></tr>` +
        `${items}</tbody>`
      );
    })
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { size: A4; margin: 14mm 13mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: ${PDF.ink}; font-size: 11px; line-height: 1.45;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .eyebrow { font-size: 8.5px; letter-spacing: .14em; text-transform: uppercase; color: ${PDF.faint}; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid ${PDF.ink}; }
  .brand { display: flex; align-items: center; gap: 9px; }
  .mark { width: 26px; height: 26px; border-radius: 7px; background: ${PDF.accent}; color: #fff; font-weight: 800; font-size: 15px; display: flex; align-items: center; justify-content: center; }
  .brand .name { font-size: 16px; font-weight: 800; letter-spacing: -.01em; }
  .head .right { text-align: right; }
  .head .period { font-size: 15px; font-weight: 700; margin-top: 3px; }
  .hero { margin: 18px 0 6px; }
  .hero .total-num { font-size: 30px; font-weight: 800; letter-spacing: -.02em; line-height: 1; }
  .hero .total-num .cur { font-size: 15px; font-weight: 700; color: ${PDF.sub}; margin-left: 6px; }
  .hero .equiv { color: ${PDF.sub}; font-size: 11px; margin-top: 6px; }
  .hero .equiv b { color: ${PDF.ink}; font-weight: 600; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0 4px; }
  .stat { background: ${PDF.tile}; border: 1px solid ${PDF.hair}; border-radius: 9px; padding: 9px 11px; }
  .stat-label { font-size: 8.5px; letter-spacing: .08em; text-transform: uppercase; color: ${PDF.faint}; }
  .stat-value { font-size: 14px; font-weight: 700; margin-top: 3px; }
  .stat-sub { font-size: 9px; color: ${PDF.faint}; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .section { margin-top: 22px; }
  .section-title { font-size: 12px; font-weight: 700; margin: 0 0 10px; display: flex; align-items: center; gap: 7px; }
  .section-title::before { content: ''; width: 3px; height: 13px; border-radius: 2px; background: ${PDF.accent}; display: inline-block; }
  .catrow { margin-bottom: 9px; }
  .cat-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 3px; }
  .cat-name { font-size: 11px; font-weight: 500; display: flex; align-items: center; gap: 7px; }
  .dot { width: 8px; height: 8px; border-radius: 2.5px; display: inline-block; }
  .cat-amt { font-size: 11px; font-weight: 600; white-space: nowrap; }
  .cat-pct { color: ${PDF.faint}; font-weight: 500; margin-left: 8px; }
  .track { height: 6px; background: ${PDF.hair}; border-radius: 4px; overflow: hidden; }
  .fill { height: 100%; border-radius: 4px; }
  table { width: 100%; border-collapse: collapse; }
  thead.cols th { font-size: 8.5px; letter-spacing: .08em; text-transform: uppercase; color: ${PDF.faint}; font-weight: 600; text-align: left; padding: 0 8px 6px; border-bottom: 1px solid ${PDF.line}; }
  thead.cols th.num { text-align: right; }
  tbody.daygroup { break-inside: avoid; }
  tr.dayhead td { background: ${PDF.tile}; padding: 6px 8px; border-top: 1px solid ${PDF.hair}; }
  .daydate { font-size: 10px; font-weight: 700; }
  .daytot { font-weight: 700; font-size: 10.5px; }
  tbody.daygroup td { padding: 5px 8px; vertical-align: top; }
  tbody.daygroup tr.odd td { background: #fafbfc; }
  td.place { font-weight: 500; }
  td.cat { color: ${PDF.sub}; }
  td.num { text-align: right; white-space: nowrap; }
  td.orig { color: ${PDF.faint}; font-size: 10px; }
  td.rsd { font-weight: 600; }
  .foot { margin-top: 18px; padding-top: 9px; border-top: 1px solid ${PDF.hair}; display: flex; justify-content: space-between; font-size: 8.5px; color: ${PDF.faint}; }
</style>
</head>
<body>
  <div class="head">
    <div class="brand">
      <div class="mark">F</div>
      <div>
        <div class="name">${escapeHtml(meta.title)}</div>
        <div class="eyebrow">${escapeHtml(L.report)}</div>
      </div>
    </div>
    <div class="right">
      ${L.generated ? `<div class="eyebrow">${escapeHtml(L.generated)}</div>` : ''}
      <div class="period">${escapeHtml(meta.periodLabel)}</div>
    </div>
  </div>

  <div class="hero">
    <div class="eyebrow">${escapeHtml(L.totalSpending)}</div>
    <div class="total-num">${moneyWhole(totalRsd)}<span class="cur">${rsd}</span></div>
    <div class="equiv">≈ <b>${moneyWhole(totalEur)}</b> ${eur} · <b>${moneyWhole(totalUsd)}</b> ${usd}</div>
  </div>

  <div class="stats">${tiles}</div>

  <div class="section">
    <div class="section-title">${escapeHtml(L.categories)}</div>
    ${catRows}
  </div>

  <div class="section">
    <div class="section-title">${escapeHtml(L.details)}</div>
    <table>
      <thead class="cols"><tr>
        <th>${escapeHtml(columns.place)}</th>
        <th>${escapeHtml(columns.category)}</th>
        <th class="num">${escapeHtml(columns.amount)}</th>
        <th class="num">${rsd}</th>
      </tr></thead>
      ${detail}
    </table>
  </div>

  <div class="foot">
    <span>${escapeHtml(meta.title)}</span>
    <span>${escapeHtml(meta.periodLabel)}</span>
  </div>
</body>
</html>`;
}
