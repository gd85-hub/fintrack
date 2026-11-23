'use strict';

// Reproducible EXPORT-05 artifact generator. It loads the production TypeScript
// builders directly, writes deterministic synthetic exports, and records the
// independently-computable integer-cent expectations in manifest.json.
//
// Usage:
//   npm run validate:export -- <output-directory>

// The output directory is temporary audit material and must not be committed.

const fs = require('node:fs');
const os = require('node:os');
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

const {
  buildCsv,
  buildExpensesPdfHtml,
  buildXlsx,
} = require('../lib/export.ts');

const columns = {
  date: 'Дата',
  place: 'Место',
  category: 'Категория',
  group: 'Группа',
  description: 'Описание',
  amount: 'Сумма',
  currency: 'Валюта',
  rsd: 'RSD',
  eur: 'EUR',
  usd: 'USD',
  type: 'Тип',
  total: 'Итого',
};

function meta(periodLabel) {
  return {
    title: 'Fintrack',
    periodLabel,
    totalsLabel: 'Итого',
    unavailableLabel: 'Недоступно',
    pdf: {
      report: 'Отчёт о расходах',
      generated: 'Сформирован для EXPORT-05',
      totalSpending: 'Расходы за период',
      count: 'Покупок',
      average: 'Средний чек',
      activeDays: 'Дней с тратами',
      largest: 'Крупнейшая покупка',
      categories: 'Структура расходов',
      details: 'Детализация',
      other: 'Прочее',
    },
  };
}

function row(overrides) {
  return {
    purchaseKey: 'manual-default',
    dateISO: '2026-11-01',
    dateLabel: '1 ноября',
    place: 'Место',
    category: 'Продукты',
    group: 'Еда',
    description: 'Позиция',
    amountOriginalCents: 123,
    currencyOriginal: 'RSD',
    amountRsdCents: 123,
    amountEurCents: 1,
    amountUsdCents: 2,
    type: 'Переменные',
    ...overrides,
  };
}

const datasets = [
  {
    id: 'a-small',
    periodLabel: 'A Small / Ноябрь:2026',
    rows: [
      row({
        purchaseKey: 'manual-a-1',
        place: 'Булочная',
        description: 'Хлеб',
        amountOriginalCents: 12375,
        amountRsdCents: 12375,
        amountEurCents: 106,
        amountUsdCents: 115,
      }),
    ],
  },
  {
    id: 'b-mixed',
    periodLabel: 'B Mixed / Ноябрь:2026',
    rows: [
      row({
        purchaseKey: 'receipt-b-1',
        place: 'Магазин, «У дома»',
        description: 'Строка 1\nSay "hi"',
        amountOriginalCents: 1,
        amountRsdCents: 1,
        amountEurCents: 1,
        amountUsdCents: 1,
      }),
      row({
        purchaseKey: 'receipt-b-1',
        place: 'Магазин, «У дома»',
        category: 'Кафе и рестораны',
        description: 'Кофе, большой',
        amountOriginalCents: 49,
        amountRsdCents: 49,
        amountEurCents: 1,
        amountUsdCents: 1,
      }),
      row({
        purchaseKey: 'receipt-b-2',
        dateISO: '2026-11-02',
        dateLabel: '2 ноября',
        place: 'Café "Central"',
        category: 'Кафе и рестораны',
        amountOriginalCents: 1234,
        currencyOriginal: 'EUR',
        amountRsdCents: 144678,
        amountEurCents: 1234,
        amountUsdCents: 1345,
      }),
      row({
        purchaseKey: 'receipt-b-2',
        dateISO: '2026-11-02',
        dateLabel: '2 ноября',
        place: 'Café "Central"',
        category: 'Транспорт',
        amountOriginalCents: 5678,
        currencyOriginal: 'EUR',
        amountRsdCents: 665426,
        amountEurCents: 5678,
        amountUsdCents: 6187,
      }),
      row({
        purchaseKey: 'receipt-b-2',
        dateISO: '2026-11-02',
        dateLabel: '2 ноября',
        place: 'Café "Central"',
        category: 'Прочее',
        amountOriginalCents: 50,
        currencyOriginal: 'EUR',
        amountRsdCents: 5863,
        amountEurCents: 50,
        amountUsdCents: 54,
      }),
      row({
        purchaseKey: 'manual-b-1',
        dateISO: '2026-11-03',
        dateLabel: '3 ноября',
        place: 'Online & Co.',
        category: 'Подписки',
        description: '<Premium> plan',
        amountOriginalCents: 12375,
        currencyOriginal: 'USD',
        amountRsdCents: 1345678,
        amountEurCents: 11470,
        amountUsdCents: 12375,
      }),
      row({
        purchaseKey: 'manual-b-2',
        dateISO: '2026-11-04',
        dateLabel: '4 ноября',
        place: 'London Shop',
        category: 'Одежда',
        amountOriginalCents: 123456,
        currencyOriginal: 'GBP',
        amountRsdCents: 16890123,
        amountEurCents: null,
        amountUsdCents: 155432,
      }),
      row({
        purchaseKey: 'manual-b-3',
        dateISO: '2026-11-05',
        dateLabel: '5 ноября',
        place: 'Крупная покупка',
        category: 'Техника',
        amountOriginalCents: 987654321098,
        amountRsdCents: 987654321098,
        amountEurCents: 8437216420,
        amountUsdCents: 9182736450,
      }),
    ],
  },
  {
    id: 'c-large',
    periodLabel: 'C Large / Ноябрь:2026',
    rows: Array.from({ length: 1003 }, (_, index) => {
      const receiptIndex = index < 15 ? Math.floor(index / 3) + 1 : null;
      const originalCurrencies = ['RSD', 'EUR', 'USD', 'GBP'];
      return row({
        purchaseKey: receiptIndex === null
          ? `manual-c-${index}`
          : `receipt-c-${receiptIndex}`,
        dateISO: `2026-11-${String((index % 28) + 1).padStart(2, '0')}`,
        dateLabel: `${(index % 28) + 1} ноября`,
        place: receiptIndex === null
          ? `Место C-${String(index + 1).padStart(4, '0')}`
          : `Чек C-${String(receiptIndex).padStart(2, '0')} / позиция C-${String(index + 1).padStart(4, '0')}`,
        category: `Категория ${(index % 8) + 1}`,
        group: `Группа ${(index % 3) + 1}`,
        description: `Позиция ${index + 1}`,
        amountOriginalCents: 100 + (index % 97),
        currencyOriginal: originalCurrencies[index % originalCurrencies.length],
        amountRsdCents: 101 + index * 7,
        amountEurCents: 33 + (index % 19),
        amountUsdCents: 44 + (index % 23),
        type: index % 2 === 0 ? 'Переменные' : 'Постоянные',
      });
    }),
  },
];

function sum(rows, pick) {
  return rows.reduce((total, current) => total + pick(current), 0);
}

function manifestEntry(dataset, baseName) {
  const missingEurCount = dataset.rows.filter(
    (current) => current.amountEurCents === null,
  ).length;
  return {
    id: dataset.id,
    expenseCount: dataset.rows.length,
    purchaseCount: new Set(dataset.rows.map((current) => current.purchaseKey)).size,
    missingEurCount,
    expectedTotalsCents: {
      rsd: sum(dataset.rows, (current) => current.amountRsdCents),
      eur: missingEurCount === 0
        ? sum(dataset.rows, (current) => current.amountEurCents)
        : null,
      usd: sum(dataset.rows, (current) => current.amountUsdCents),
    },
    expectedRows: dataset.rows,
    files: {
      csv: `${baseName}.csv`,
      xlsx: `${baseName}.xlsx`,
      html: `${baseName}.html`,
      pdf: `${baseName}.pdf`,
    },
  };
}

const outputDirectory = path.resolve(
  process.argv[2] ?? path.join(os.tmpdir(), 'fintrack-export-validation'),
);
fs.mkdirSync(outputDirectory, { recursive: true });

const manifest = [];
for (const dataset of datasets) {
  const baseName = `fintrack-${dataset.id}`;
  const exportMeta = meta(dataset.periodLabel);
  fs.writeFileSync(
    path.join(outputDirectory, `${baseName}.csv`),
    buildCsv(dataset.rows, columns, exportMeta),
    'utf8',
  );
  fs.writeFileSync(
    path.join(outputDirectory, `${baseName}.xlsx`),
    buildXlsx(dataset.rows, columns, exportMeta),
  );
  fs.writeFileSync(
    path.join(outputDirectory, `${baseName}.html`),
    buildExpensesPdfHtml(dataset.rows, columns, exportMeta),
    'utf8',
  );
  manifest.push(manifestEntry(dataset, baseName));
}

fs.writeFileSync(
  path.join(outputDirectory, 'manifest.json'),
  `${JSON.stringify({ generatedBy: 'scripts/export-validation.js', datasets: manifest }, null, 2)}\n`,
  'utf8',
);

process.stdout.write(`${outputDirectory}\n`);
