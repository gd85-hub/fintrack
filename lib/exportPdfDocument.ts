import {
  assertCents,
  type PdfReportDay,
  type PdfReportModel,
} from './exportPdfModel';
import { lightColor } from './theme';

export type PdfDocumentDefinition = {
  pageSize: 'A4';
  pageOrientation: 'portrait';
  pageMargins: readonly [number, number, number, number];
  defaultStyle: Record<string, unknown>;
  styles: Record<string, Record<string, unknown>>;
  content: readonly unknown[];
  header: (currentPage: number) => unknown;
  footer: (currentPage: number, pageCount: number) => unknown;
  info: Record<string, string>;
};

const PDF = {
  ink: lightColor.text.primary,
  secondary: lightColor.text.secondary,
  tertiary: lightColor.text.tertiary,
  accent: lightColor.action.primary.fill,
  surface: lightColor.surface.default,
  tile: lightColor.bg.base,
  line: lightColor.field.disabledBorder,
  warning: lightColor.status.warning.content,
  warningSurface: lightColor.status.warning.container,
  category: lightColor.data.categorical,
} as const;

const PAGE_WIDTH = 595.28;
const PAGE_MARGIN_X = 36;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN_X * 2;
const CATEGORY_BAR_WIDTH = CONTENT_WIDTH;
const DETAIL_CELL_PADDING_X = 7;
const DETAIL_COLUMN_WIDTHS = [130, 105, 137, 95] as const;

function money(valueCents: number): string {
  assertCents(valueCents, 'PDF money');
  const negative = valueCents < 0;
  const absolute = Math.abs(valueCents);
  const whole = String(Math.floor(absolute / 100)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    '\u2009',
  );
  const fraction = String(absolute % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

function sectionTitle(text: string): Record<string, unknown> {
  return {
    columns: [
      {
        canvas: [
          {
            type: 'rect',
            x: 0,
            y: 1,
            w: 3,
            h: 14,
            r: 1.5,
            color: PDF.accent,
          },
        ],
        width: 10,
      },
      { text, style: 'sectionTitle' },
    ],
    margin: [0, 0, 0, 10],
  };
}

function metricCell(
  label: string,
  value: string,
  supportingText = '',
): unknown {
  return {
    stack: [
      { text: label.toUpperCase(), style: 'metricLabel' },
      { text: value, style: 'metricValue', margin: [0, 4, 0, 0] },
      ...(supportingText
        ? [{ text: supportingText, style: 'metricSupporting', margin: [0, 2, 0, 0] }]
        : []),
    ],
    fillColor: PDF.tile,
    margin: [0, 0, 0, 0],
  };
}

function categoryRows(model: PdfReportModel): readonly unknown[] {
  if (model.categories.length === 0) {
    return [{ text: '—', style: 'empty', margin: [0, 0, 0, 6] }];
  }

  return model.categories.map((category, index) => {
    const color = category.isAggregatedOther
      ? PDF.tertiary
      : PDF.category[index % PDF.category.length];
    const fillWidth = Math.max(
      0,
      Math.min(
        CATEGORY_BAR_WIDTH,
        (CATEGORY_BAR_WIDTH * category.relativeWidthPercent) / 100,
      ),
    );

    return {
      stack: [
        {
          columns: [
            {
              columns: [
                {
                  canvas: [
                    {
                      type: 'rect',
                      x: 0,
                      y: 2,
                      w: 8,
                      h: 8,
                      r: 2,
                      color,
                    },
                  ],
                  width: 15,
                },
                { text: category.label, style: 'categoryName' },
              ],
            },
            {
              text: [
                { text: `${money(category.amountRsdCents)} ${model.columns.rsd}` },
                {
                  text: `   ${category.sharePercent.toFixed(1)}%`,
                  color: PDF.tertiary,
                  fontSize: 8.5,
                },
              ],
              alignment: 'right',
              style: 'categoryAmount',
              width: 170,
            },
          ],
        },
        {
          canvas: [
            {
              type: 'rect',
              x: 0,
              y: 0,
              w: CATEGORY_BAR_WIDTH,
              h: 5,
              r: 2.5,
              color: PDF.line,
            },
            {
              type: 'rect',
              x: 0,
              y: 0,
              w: fillWidth,
              h: 5,
              r: 2.5,
              color,
            },
          ],
          margin: [0, 5, 0, 0],
        },
      ],
      margin: [0, 0, 0, 10],
    };
  });
}

const detailTableLayout = {
  hLineWidth: (index: number, node: { table: { body: readonly unknown[] } }) =>
    index === 0 || index === node.table.body.length ? 0 : 0.5,
  vLineWidth: () => 0,
  hLineColor: () => PDF.line,
  paddingLeft: () => DETAIL_CELL_PADDING_X,
  paddingRight: () => DETAIL_CELL_PADDING_X,
  paddingTop: () => 6,
  paddingBottom: () => 6,
} as const;

function detailColumnHeader(model: PdfReportModel): Record<string, unknown> {
  return {
    table: {
      widths: DETAIL_COLUMN_WIDTHS,
      body: [[
        { text: model.columns.place, style: 'tableHeader' },
        { text: model.columns.category, style: 'tableHeader' },
        {
          text: model.columns.amount,
          style: 'tableHeader',
          alignment: 'right',
        },
        {
          text: model.columns.rsd,
          style: 'tableHeader',
          alignment: 'right',
        },
      ]],
    },
    layout: {
      hLineWidth: (index: number) => (index === 1 ? 0.5 : 0),
      vLineWidth: () => 0,
      hLineColor: () => PDF.line,
      paddingLeft: () => DETAIL_CELL_PADDING_X,
      paddingRight: () => DETAIL_CELL_PADDING_X,
      paddingTop: () => 4,
      paddingBottom: () => 6,
    },
  };
}

function detailRow(
  row: PdfReportDay['rows'][number],
  index: number,
): readonly unknown[] {
  const fillColor = index % 2 === 1 ? PDF.tile : PDF.surface;
  return [
    {
      text: row.place || '—',
      style: 'detailPlace',
      fillColor,
    },
    {
      text: row.category,
      style: 'detailCategory',
      fillColor,
    },
    {
      text: `${money(row.amountOriginalCents)} ${row.currencyOriginal}`,
      style: 'detailOriginal',
      alignment: 'right',
      noWrap: true,
      fillColor,
    },
    {
      text: money(row.amountRsdCents),
      style: 'detailRsd',
      alignment: 'right',
      noWrap: true,
      fillColor,
    },
  ];
}

function detailDayTables(
  day: PdfReportDay,
  model: PdfReportModel,
): readonly unknown[] {
  const dayHeader = [
    {
      text: day.dateLabel,
      style: 'dayHeader',
      colSpan: 3,
      fillColor: PDF.tile,
    },
    {},
    {},
    {
      text: `${money(day.totalRsdCents)} ${model.columns.rsd}`,
      style: 'dayTotal',
      alignment: 'right',
      fillColor: PDF.tile,
      noWrap: true,
    },
  ];
  const [firstRow, ...remainingRows] = day.rows.map(detailRow);
  if (!firstRow) {
    return [];
  }

  const lead = {
    table: {
      headerRows: 1,
      keepWithHeaderRows: 1,
      dontBreakRows: true,
      widths: DETAIL_COLUMN_WIDTHS,
      body: [dayHeader, firstRow],
    },
    layout: detailTableLayout,
    margin: [0, 0, 0, remainingRows.length > 0 ? 0 : 11],
  };
  if (remainingRows.length === 0) {
    return [lead];
  }

  return [
    lead,
    {
      table: {
        dontBreakRows: true,
        widths: DETAIL_COLUMN_WIDTHS,
        body: remainingRows,
      },
      layout: detailTableLayout,
      margin: [0, 0, 0, 11],
    },
  ];
}

function details(model: PdfReportModel): readonly unknown[] {
  if (model.days.length === 0) {
    return [{ text: '—', style: 'empty' }];
  }
  return [
    detailColumnHeader(model),
    ...model.days.flatMap((day) => detailDayTables(day, model)),
  ];
}

export function buildPdfDocument(
  model: PdfReportModel,
): PdfDocumentDefinition {
  const totalEur = model.totals.eurCents === null
    ? '—'
    : money(model.totals.eurCents);
  const largest = model.purchases.largest;
  const unavailable = model.totals.unavailableEurCount > 0
    ? {
        table: {
          widths: ['*'],
          body: [[{
            text: `${model.unavailableLabel}: ${model.columns.eur} (${model.totals.unavailableEurCount})`,
            style: 'warning',
            fillColor: PDF.warningSurface,
          }]],
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 9,
          paddingRight: () => 9,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 8, 0, 0],
      }
    : null;

  return {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [PAGE_MARGIN_X, 54, PAGE_MARGIN_X, 40],
    info: {
      title: `${model.title} - ${model.labels.report}`,
      author: model.title,
      subject: model.periodLabel,
    },
    defaultStyle: {
      font: 'Roboto',
      fontSize: 9.5,
      lineHeight: 1.25,
      color: PDF.ink,
    },
    styles: {
      brandName: { fontSize: 17, bold: true, color: PDF.ink },
      eyebrow: {
        fontSize: 8,
        bold: true,
        color: PDF.tertiary,
        characterSpacing: 0.8,
      },
      period: { fontSize: 13.5, bold: true, color: PDF.ink },
      total: { fontSize: 28, bold: true, color: PDF.ink, lineHeight: 1 },
      totalCurrency: { fontSize: 13, bold: true, color: PDF.secondary },
      equivalent: { fontSize: 10, color: PDF.secondary },
      warning: { fontSize: 8.5, color: PDF.warning },
      metricLabel: {
        fontSize: 7.5,
        bold: true,
        color: PDF.tertiary,
        characterSpacing: 0.45,
      },
      metricValue: { fontSize: 12.5, bold: true, color: PDF.ink },
      metricSupporting: { fontSize: 8, color: PDF.tertiary },
      sectionTitle: { fontSize: 12.5, bold: true, color: PDF.ink },
      categoryName: { fontSize: 9.5, bold: true, color: PDF.ink },
      categoryAmount: { fontSize: 9.5, bold: true, color: PDF.ink },
      tableHeader: {
        fontSize: 7.5,
        bold: true,
        color: PDF.tertiary,
        characterSpacing: 0.35,
      },
      dayHeader: { fontSize: 9, bold: true, color: PDF.ink },
      dayTotal: { fontSize: 9, bold: true, color: PDF.ink },
      detailPlace: { fontSize: 8.5, bold: true, color: PDF.ink },
      detailCategory: { fontSize: 8.5, color: PDF.secondary },
      detailOriginal: { fontSize: 8, color: PDF.tertiary },
      detailRsd: { fontSize: 8.5, bold: true, color: PDF.ink },
      empty: { fontSize: 10, color: PDF.tertiary },
      footer: { fontSize: 7.5, color: PDF.tertiary },
    },
    content: [
      {
        table: {
          widths: [30, '*', 190],
          body: [[
            {
              text: 'F',
              bold: true,
              fontSize: 16,
              color: lightColor.text.inverse,
              alignment: 'center',
              margin: [0, 5, 0, 5],
              fillColor: PDF.accent,
            },
            {
              stack: [
                { text: model.title, style: 'brandName' },
                { text: model.labels.report.toUpperCase(), style: 'eyebrow' },
              ],
              margin: [9, 0, 0, 0],
            },
            {
              stack: [
                ...(model.labels.generated
                  ? [{ text: model.labels.generated.toUpperCase(), style: 'eyebrow' }]
                  : []),
                { text: model.periodLabel, style: 'period', margin: [0, 3, 0, 0] },
              ],
              alignment: 'right',
            },
          ]],
        },
        layout: 'noBorders',
      },
      {
        canvas: [{
          type: 'line',
          x1: 0,
          y1: 0,
          x2: CONTENT_WIDTH,
          y2: 0,
          lineWidth: 1.5,
          lineColor: PDF.ink,
        }],
        margin: [0, 12, 0, 18],
      },
      { text: model.labels.totalSpending.toUpperCase(), style: 'eyebrow' },
      {
        text: [
          { text: money(model.totals.rsdCents), style: 'total' },
          { text: `  ${model.columns.rsd}`, style: 'totalCurrency' },
        ],
        margin: [0, 4, 0, 0],
      },
      {
        text: [
          { text: '≈ ', color: PDF.tertiary },
          { text: totalEur, bold: true, color: PDF.ink },
          { text: ` ${model.columns.eur}   ·   ` },
          { text: money(model.totals.usdCents), bold: true, color: PDF.ink },
          { text: ` ${model.columns.usd}` },
        ],
        style: 'equivalent',
        margin: [0, 7, 0, 0],
      },
      ...(unavailable ? [unavailable] : []),
      {
        table: {
          widths: ['*', '*', '*', '*'],
          body: [[
            metricCell(model.labels.count, String(model.purchases.count)),
            metricCell(
              model.labels.average,
              `${money(model.purchases.averageRsdCents)} ${model.columns.rsd}`,
            ),
            metricCell(
              model.labels.activeDays,
              `${model.period.daysWithSpend} / ${model.period.daysInPeriod}`,
            ),
            metricCell(
              model.labels.largest,
              largest
                ? `${money(largest.amountRsdCents)} ${model.columns.rsd}`
                : '—',
              largest ? largest.place || largest.category : '',
            ),
          ]],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 4,
          hLineColor: () => PDF.line,
          vLineColor: () => PDF.surface,
          paddingLeft: () => 9,
          paddingRight: () => 9,
          paddingTop: () => 9,
          paddingBottom: () => 9,
        },
        margin: [0, 15, 0, 0],
      },
      { ...sectionTitle(model.labels.categories), margin: [0, 22, 0, 10] },
      ...categoryRows(model),
      {
        ...sectionTitle(model.labels.details),
        margin: [0, 17, 0, 10],
        ...(model.rows.length > 20 ? { pageBreak: 'before' } : {}),
      },
      ...details(model),
    ],
    header: (currentPage: number) =>
      currentPage < (model.rows.length > 20 ? 3 : 2)
        ? { text: '' }
        : {
            ...detailColumnHeader(model),
            margin: [PAGE_MARGIN_X, 24, PAGE_MARGIN_X, 0],
          },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: model.title, style: 'footer' },
        { text: model.periodLabel, style: 'footer', alignment: 'center' },
        {
          text: `${currentPage} / ${pageCount}`,
          style: 'footer',
          alignment: 'right',
        },
      ],
      margin: [PAGE_MARGIN_X, 0, PAGE_MARGIN_X, 0],
    }),
  };
}
