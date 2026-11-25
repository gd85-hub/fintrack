import { beforeEach, expect, jest, test } from '@jest/globals';

import type { ExportColumns, ExportMeta, ExportRow } from '../export';

const mockBuildHtml = jest.fn<
  (
    rows: readonly ExportRow[],
    columns: ExportColumns,
    meta: ExportMeta,
  ) => string
>();
const mockDeliverPdf = jest.fn<(html: string, filename: string) => Promise<void>>();

jest.mock('../export', () => ({
  buildExpensesPdfHtml: (
    rows: readonly ExportRow[],
    columns: ExportColumns,
    meta: ExportMeta,
  ) => mockBuildHtml(rows, columns, meta),
}));

jest.mock('../exportDelivery', () => {
  class ShareUnavailableError extends Error {}
  return {
    deliverPdf: (html: string, filename: string) =>
      mockDeliverPdf(html, filename),
    ShareUnavailableError,
  };
});

import { beginPdfExport } from '../exportPdfIntegration';

beforeEach(() => {
  mockBuildHtml.mockReset().mockReturnValue('<html>existing report</html>');
  mockDeliverPdf.mockReset().mockResolvedValue(undefined);
});

test('the native adapter preserves the existing HTML and expo-print delivery path', async () => {
  const rows = [] as const;
  const columns = {} as ExportColumns;
  const meta = {} as ExportMeta;

  await expect(
    beginPdfExport({
      rows,
      columns,
      meta,
      filename: 'fintrack-2026-11.pdf',
    }),
  ).resolves.toBeNull();

  expect(mockBuildHtml).toHaveBeenCalledWith(rows, columns, meta);
  expect(mockDeliverPdf).toHaveBeenCalledWith(
    '<html>existing report</html>',
    'fintrack-2026-11.pdf',
  );
});
