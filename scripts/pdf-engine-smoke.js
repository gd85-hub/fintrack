'use strict';

// Generates a deterministic proof-of-concept PDF through the production
// Web-only adapter. The output path is caller-provided temporary audit material.
// Usage: node scripts/pdf-engine-smoke.js <output.pdf>

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

const { generateWebPdfBlob } = require('../lib/exportPdfEngine.web.ts');

const outputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : null;

if (outputPath === null || path.extname(outputPath).toLowerCase() !== '.pdf') {
  throw new Error('Provide a temporary output path ending in .pdf.');
}

const wrappedRows = Array.from({ length: 12 }, (_, index) => [
  `${index + 1}. Длинная строка магазина для проверки переноса текста / wrapped shop row`,
  `${(1000 + index * 17).toFixed(2)} RSD`,
]);

const documentDefinition = {
  pageSize: 'A4',
  pageMargins: [40, 40, 40, 40],
  defaultStyle: { font: 'Roboto', fontSize: 10 },
  content: [
    { text: 'Fintrack', fontSize: 20, bold: true, margin: [0, 0, 0, 8] },
    { text: 'Expense report / Отчёт о расходах', margin: [0, 0, 0, 4] },
    { text: 'Магазин «У дома»', bold: true, margin: [0, 0, 0, 4] },
    { text: 'Total / Итого: 1 234.56 RSD', margin: [0, 0, 0, 12] },
    {
      table: {
        headerRows: 1,
        widths: ['*', 100],
        body: [
          ['Store / Магазин', 'Amount / Сумма'],
          ...wrappedRows,
        ],
      },
      layout: 'lightHorizontalLines',
    },
  ],
};

async function main() {
  const blob = await generateWebPdfBlob(documentDefinition);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const signature = Buffer.from(bytes.subarray(0, 5)).toString('ascii');
  if (signature !== '%PDF-') {
    throw new Error(`Invalid PDF signature: ${JSON.stringify(signature)}.`);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, bytes);
  process.stdout.write(
    `${JSON.stringify({
      outputPath,
      mimeType: blob.type,
      byteLength: bytes.length,
      signature,
    })}\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
