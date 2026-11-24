import * as XLSX from 'xlsx';

import {
  assertCents,
  buildPdfReportModel,
  sumCents,
} from './exportPdfModel';
import { lightColor } from './theme';

// Pure export builders: take already-prepared, already-localized rows plus
// localized column headers / meta, and produce CSV / XLSX / PDF-HTML. No React,
// no Platform, no file IO, no i18n, no FX recompute — the caller (EXPORT-2)
// resolves labels and money and does the native print/share wiring.

export type ExportRow = {
  purchaseKey: string; // receipt id for receipt rows, expense id for manual rows
  dateISO: string; // 'YYYY-MM-DD' — for CSV/Excel (sortable)
  dateLabel: string; // localized, e.g. '29 July' — for PDF
  place: string; // merchant name, or '' if none
  category: string; // already localized (system via catalog, user as-is)
  group: string; // already localized
  description: string; // item/expense description, may be ''
  amountOriginalCents: number;
  currencyOriginal: string; // e.g. 'RSD','EUR'
  amountRsdCents: number;
  amountEurCents: number | null;
  amountUsdCents: number;
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
  unavailableLabel?: string; // localized 'Недоступно' / 'Unavailable'
  summaryTitle?: string; // PDF only, e.g. 'Топ категорий' / 'Top categories'
  topCategories?: { label: string; amountRsd: number }[]; // PDF summary
  pdf?: ExportPdfLabels;
};

// Exact dot-decimal serialization without floating-point money arithmetic.
function cents2(value: number): string {
  assertCents(value, 'Money');
  const negative = value < 0;
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

function centsNumber(value: number): number {
  return Number(cents2(value));
}

// ---------- CSV ----------

const CSV_BOM = '﻿';

function csvCell(value: string | number): string {
  const text = typeof value === 'number' ? cents2(value) : value;
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
  const missingEurCount = rows.filter(
    (row) => row.amountEurCents === null,
  ).length;

  for (const row of rows) {
    lines.push([
      row.dateISO,
      row.place,
      row.category,
      row.group,
      row.description,
      cents2(row.amountOriginalCents),
      row.currencyOriginal,
      cents2(row.amountRsdCents),
      row.amountEurCents === null ? '' : cents2(row.amountEurCents),
      cents2(row.amountUsdCents),
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
    cents2(sumCents(rows, (row) => row.amountRsdCents)),
    missingEurCount === 0
      ? cents2(sumCents(rows, (row) => row.amountEurCents ?? 0))
      : '',
    cents2(sumCents(rows, (row) => row.amountUsdCents)),
    '',
  ]);

  if (missingEurCount > 0) {
    lines.push([
      `${meta.unavailableLabel ?? 'Unavailable'}: EUR (${missingEurCount})`,
      '', '', '', '', '', '', '', '', '', '',
    ]);
  }

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
  const missingEurCount = rows.filter(
    (row) => row.amountEurCents === null,
  ).length;

  for (const row of rows) {
    aoa.push([
      row.dateISO,
      row.place,
      row.category,
      row.group,
      row.description,
      centsNumber(row.amountOriginalCents),
      row.currencyOriginal,
      centsNumber(row.amountRsdCents),
      row.amountEurCents === null ? '' : centsNumber(row.amountEurCents),
      centsNumber(row.amountUsdCents),
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
    centsNumber(sumCents(rows, (row) => row.amountRsdCents)),
    missingEurCount === 0
      ? centsNumber(sumCents(rows, (row) => row.amountEurCents ?? 0))
      : '',
    centsNumber(sumCents(rows, (row) => row.amountUsdCents)),
    '',
  ]);

  if (missingEurCount > 0) {
    aoa.push([
      `${meta.unavailableLabel ?? 'Unavailable'}: EUR (${missingEurCount})`,
      '', '', '', '', '', '', '', '', '', '',
    ]);
  }

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
function moneyDisplayCents(value: number): string {
  const fixed = cents2(value);
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
  const model = buildPdfReportModel(rows, columns, meta);
  const L = model.labels;
  const rsd = escapeHtml(columns.rsd);
  const eur = escapeHtml(columns.eur);
  const usd = escapeHtml(columns.usd);
  const totalRsd = model.totals.rsdCents;
  const totalEur = model.totals.eurCents;
  const totalUsd = model.totals.usdCents;
  const unavailableNote = model.totals.unavailableEurCount > 0
    ? `<div class="unavailable">${escapeHtml(
        model.unavailableLabel,
      )}: ${eur} (${model.totals.unavailableEurCount})</div>`
    : '';

  // ---- render pieces ----
  const tiles = [
    { label: L.count, value: String(model.purchases.count) },
    {
      label: L.average,
      value: `${moneyDisplayCents(model.purchases.averageRsdCents)} ${rsd}`,
    },
    {
      label: L.activeDays,
      value: `${model.period.daysWithSpend} / ${model.period.daysInPeriod}`,
    },
    {
      label: L.largest,
      value: model.purchases.largest
        ? `${moneyDisplayCents(model.purchases.largest.amountRsdCents)} ${rsd}`
        : '—',
      sub: model.purchases.largest
        ? escapeHtml(
            model.purchases.largest.place || model.purchases.largest.category,
          )
        : '',
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

  const catRows = model.categories
    .map((c, i) => {
      const color = c.isAggregatedOther
        ? PDF.faint
        : PDF.cat[i % PDF.cat.length];
      return (
        `<div class="catrow"><div class="cat-top">` +
        `<span class="cat-name"><span class="dot" style="background:${color}"></span>${escapeHtml(
          c.label,
        )}</span>` +
        `<span class="cat-amt">${moneyDisplayCents(c.amountRsdCents)} ${rsd}<span class="cat-pct">${c.sharePercent.toFixed(
          1,
        )}%</span></span></div>` +
        `<div class="track"><div class="fill" style="width:${c.relativeWidthPercent.toFixed(
          1,
        )}%;background:${color}"></div></div></div>`
      );
    })
    .join('');

  const detail = model.days
    .map((g) => {
      const items = g.rows
        .map(
          (r, i) =>
            `<tr class="${i % 2 ? 'odd' : ''}">` +
            `<td class="place">${escapeHtml(r.place || '—')}</td>` +
            `<td class="cat">${escapeHtml(r.category)}</td>` +
            `<td class="num orig">${moneyDisplayCents(r.amountOriginalCents)} ${escapeHtml(
              r.currencyOriginal,
            )}</td>` +
            `<td class="num rsd">${moneyDisplayCents(r.amountRsdCents)}</td></tr>`,
        )
        .join('');
      return (
        `<tbody class="daygroup"><tr class="dayhead">` +
        `<td colspan="3"><span class="daydate">${escapeHtml(
          g.dateLabel,
        )}</span></td>` +
        `<td class="num daytot">${moneyDisplayCents(g.totalRsdCents)} ${rsd}</td></tr>` +
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
  .hero .unavailable { color: ${PDF.sub}; font-size: 9px; margin-top: 7px; }
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
    <div class="total-num">${moneyDisplayCents(totalRsd)}<span class="cur">${rsd}</span></div>
    <div class="equiv">≈ <b>${totalEur === null ? '—' : moneyDisplayCents(totalEur)}</b> ${eur} · <b>${moneyDisplayCents(totalUsd)}</b> ${usd}</div>
    ${unavailableNote}
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
