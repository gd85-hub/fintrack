'use strict';

// Generates real vector PDFs through the production PdfReportModel ->
// document builder -> Web pdfmake adapter path. Outputs are temporary audit
// artifacts and must not be committed.
// Usage: node scripts/pdf-report-validation.js <output-directory>

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  });
  module._compile(compiled.outputText, filename);
};

const { buildPdfReportModel } = require('../lib/exportPdfModel.ts');
const { generateWebPdfReportBlob } = require('../lib/exportPdfReport.web.ts');

const outputDirectory = process.argv[2]
  ? path.resolve(process.argv[2])
  : null;
if (outputDirectory === null) {
  throw new Error('Provide a temporary output directory.');
}

const columns = {
  date: 'Дата',
  place: 'Место',
  category: 'Категория',
  group: 'Группа',
  description: 'Описание',
  amount: 'Исходная сумма',
  currency: 'Валюта',
  rsd: 'RSD',
  eur: 'EUR',
  usd: 'USD',
  type: 'Тип',
  total: 'Итого',
};

const meta = {
  title: 'Fintrack',
  periodLabel: 'Октябрь 2026',
  totalsLabel: 'Итого',
  unavailableLabel: 'Недоступно',
  pdf: {
    report: 'Отчёт о расходах',
    generated: 'Сформирован 24.11.2026',
    totalSpending: 'Расходы за период',
    count: 'Покупок',
    average: 'Средний чек',
    activeDays: 'Дней с тратами',
    largest: 'Крупнейшая покупка',
    categories: 'Структура расходов',
    details: 'Детализация',
    other: 'Остальные категории',
  },
};

function makeRow(index, overrides = {}) {
  const amountRsdCents = overrides.amountRsdCents ?? 10000 + index;
  return {
    purchaseKey: `manual-${index}`,
    dateISO: '2026-10-01',
    dateLabel: '1 октября',
    place: `Row-${String(index).padStart(4, '0')}`,
    category: 'Продукты',
    group: 'Еда',
    description: `Synthetic ${index}`,
    amountOriginalCents: amountRsdCents,
    currencyOriginal: 'RSD',
    amountRsdCents,
    amountEurCents: Math.round(amountRsdCents / 117),
    amountUsdCents: Math.round(amountRsdCents / 108),
    type: 'Переменные',
    ...overrides,
  };
}

const datasets = [
  { name: 'empty', rows: [], rowTokens: [] },
  {
    name: 'single',
    rows: [makeRow(1, {
      place: 'Магазин «У дома»',
      category: 'Продукты',
      amountRsdCents: 123456,
      amountOriginalCents: 123456,
      amountEurCents: 1050,
      amountUsdCents: 1125,
    })],
    rowTokens: ['Магазин «У дома»'],
  },
  {
    name: 'receipt-lines',
    rows: [1, 2, 3].map((index) => makeRow(index, {
      purchaseKey: 'receipt-shared',
      place: 'Receipt Market',
      category: `ReceiptCategory-${index}`,
      amountRsdCents: index * 1111,
      amountOriginalCents: index * 1111,
    })),
    rowTokens: ['ReceiptCategory-1', 'ReceiptCategory-2', 'ReceiptCategory-3'],
  },
  {
    name: 'mixed-currencies',
    rows: [
      makeRow(1, {
        place: 'Mixed-RSD',
        amountOriginalCents: 100050,
        currencyOriginal: 'RSD',
        amountRsdCents: 100050,
      }),
      makeRow(2, {
        place: 'Mixed-EUR',
        amountOriginalCents: 12345,
        currencyOriginal: 'EUR',
        amountRsdCents: 1444365,
        amountEurCents: 12345,
      }),
      makeRow(3, {
        place: 'Mixed-USD',
        amountOriginalCents: 6789,
        currencyOriginal: 'USD',
        amountRsdCents: 733212,
      }),
    ],
    rowTokens: ['Mixed-RSD', 'Mixed-EUR', 'Mixed-USD'],
  },
  {
    name: 'nullable-eur',
    rows: [
      makeRow(1, { place: 'EUR-available' }),
      makeRow(2, { place: 'EUR-unavailable', amountEurCents: null }),
    ],
    rowTokens: ['EUR-available', 'EUR-unavailable'],
  },
  {
    name: 'unicode',
    rows: [
      makeRow(1, {
        place: 'Кафе «Солнце» & Friends',
        category: 'Еда / Dining',
      }),
      makeRow(2, {
        place: 'Књижара Čitaonica',
        category: 'Книги & Books',
      }),
    ],
    rowTokens: ['Кафе «Солнце» & Friends', 'Књижара Čitaonica'],
  },
  {
    name: 'long-labels',
    rows: [
      makeRow(1, {
        place: `LONG-PLACE-START ${'Очень длинное название магазина '.repeat(6)} LONG-PLACE-END`,
        category: `LONG-CATEGORY-START ${'Категория с подробным названием '.repeat(4)} LONG-CATEGORY-END`,
      }),
    ],
    rowTokens: ['LONG-PLACE-START', 'LONG-PLACE-END', 'LONG-CATEGORY-START', 'LONG-CATEGORY-END'],
  },
  {
    name: 'other-categories',
    rows: [1000, 900, 800, 700, 600, 500, 400, 300].map(
      (amountRsdCents, index) => makeRow(index + 1, {
        place: `OtherRow-${index + 1}`,
        category: index === 0 ? 'Other' : `Category ${index + 1}`,
        amountRsdCents,
        amountOriginalCents: amountRsdCents,
      }),
    ),
    rowTokens: Array.from({ length: 8 }, (_, index) => `OtherRow-${index + 1}`),
  },
  {
    name: 'large-1003',
    rows: Array.from({ length: 1003 }, (_, index) => {
      const day = (index % 17) + 1;
      const token = `LargeRow-${String(index + 1).padStart(4, '0')}`;
      return makeRow(index + 1, {
        dateISO: `2026-10-${String(day).padStart(2, '0')}`,
        dateLabel: `${day} октября`,
        place: token,
        category: `Category ${(index % 9) + 1}`,
        amountRsdCents: 10000 + (index % 97),
        amountOriginalCents: 10000 + (index % 97),
      });
    }),
    rowTokens: Array.from(
      { length: 1003 },
      (_, index) => `LargeRow-${String(index + 1).padStart(4, '0')}`,
    ),
  },
  {
    name: 'one-day-overflow',
    rows: Array.from({ length: 180 }, (_, index) => {
      const token = `OverflowRow-${String(index + 1).padStart(3, '0')}`;
      return makeRow(index + 1, {
        dateISO: '2026-10-15',
        dateLabel: '15 октября',
        place: token,
        category: `Overflow category ${(index % 5) + 1}`,
      });
    }),
    rowTokens: Array.from(
      { length: 180 },
      (_, index) => `OverflowRow-${String(index + 1).padStart(3, '0')}`,
    ),
  },
];

function money(valueCents) {
  const negative = valueCents < 0;
  const absolute = Math.abs(valueCents);
  const whole = String(Math.floor(absolute / 100)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    '\u2009',
  );
  const fraction = String(absolute % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

function manifestEntry(dataset, model, byteLength) {
  const requiredText = [
    model.title,
    model.labels.report.toUpperCase(),
    model.periodLabel,
    model.labels.totalSpending.toUpperCase(),
    money(model.totals.rsdCents),
    money(model.totals.usdCents),
    model.labels.categories,
    model.labels.details,
    ...model.days.flatMap((day) => [day.dateLabel, money(day.totalRsdCents)]),
    ...model.categories.flatMap((category) => [
      ...(category.label.length <= 100 ? [category.label] : []),
      money(category.amountRsdCents),
    ]),
  ];
  if (model.totals.eurCents === null) {
    requiredText.push(
      `${model.unavailableLabel}: ${model.columns.eur} (${model.totals.unavailableEurCount})`,
    );
  } else {
    requiredText.push(money(model.totals.eurCents));
  }

  return {
    name: dataset.name,
    file: `${dataset.name}.pdf`,
    byteLength,
    rowCount: model.rows.length,
    purchaseCount: model.purchases.count,
    totals: model.totals,
    days: model.days.map((day) => ({
      dateISO: day.dateISO,
      totalRsdCents: day.totalRsdCents,
      rowCount: day.rows.length,
    })),
    categories: model.categories.map((category) => ({
      label: category.label,
      amountRsdCents: category.amountRsdCents,
      isAggregatedOther: category.isAggregatedOther,
    })),
    rowTokens: dataset.rowTokens,
    requiredText: [...new Set(requiredText)],
  };
}

async function main() {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const manifest = [];

  for (const dataset of datasets) {
    const model = buildPdfReportModel(dataset.rows, columns, meta);
    const blob = await generateWebPdfReportBlob(model);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const signature = Buffer.from(bytes.subarray(0, 5)).toString('ascii');
    if (signature !== '%PDF-') {
      throw new Error(`${dataset.name}: invalid PDF signature ${signature}.`);
    }
    fs.writeFileSync(path.join(outputDirectory, `${dataset.name}.pdf`), bytes);
    manifest.push(manifestEntry(dataset, model, bytes.length));
    process.stdout.write(
      `${dataset.name}: ${bytes.length} bytes, ${model.rows.length} rows\n`,
    );
  }

  fs.writeFileSync(
    path.join(outputDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
