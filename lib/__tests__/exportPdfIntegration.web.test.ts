import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { ExportColumns, ExportMeta, ExportRow } from '../export';
import type { PdfReportModel } from '../exportPdfModel';

const mockBuildModel = jest.fn<
  (
    rows: readonly ExportRow[],
    columns: ExportColumns,
    meta: ExportMeta,
  ) => PdfReportModel
>();
const mockGenerate = jest.fn<(model: PdfReportModel) => Promise<Blob>>();
const mockDownload = jest.fn<(blob: Blob, filename: string) => Promise<void>>();
const mockDownloadObjectUrl = jest.fn<(url: string, filename: string) => void>();
const mockIsIos = jest.fn<() => boolean>();

jest.mock('../exportPdfModel', () => ({
  buildPdfReportModel: (
    rows: readonly ExportRow[],
    columns: ExportColumns,
    meta: ExportMeta,
  ) => mockBuildModel(rows, columns, meta),
}));

jest.mock('../exportPdfReport.web', () => ({
  generateWebPdfReportBlob: (model: PdfReportModel) => mockGenerate(model),
}));

jest.mock('../exportDelivery', () => {
  class ShareUnavailableError extends Error {}
  return {
    downloadInBrowser: (blob: Blob, filename: string) =>
      mockDownload(blob, filename),
    downloadObjectUrlInBrowser: (url: string, filename: string) =>
      mockDownloadObjectUrl(url, filename),
    isIosBrowser: () => mockIsIos(),
    ShareUnavailableError,
  };
});

import {
  beginPdfExport,
  disposePreparedPdf,
  savePreparedPdf,
} from '../exportPdfIntegration.web';

const rows = [] as const;
const columns = {} as ExportColumns;
const meta = {} as ExportMeta;
const model = {} as PdfReportModel;
const filename = 'fintrack-2025-12.pdf';
const originalNavigator = globalThis.navigator;
const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;
const createObjectUrl = jest.fn(() => 'blob:prepared-pdf');
const revokeObjectUrl = jest.fn<(url: string) => void>();

function setNavigator(value: Partial<Navigator>): void {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value,
  });
}

function pdfBlob(): Blob {
  return new Blob(['%PDF-1.7\nPDF body'], { type: 'application/pdf' });
}

beforeEach(() => {
  mockBuildModel.mockReset().mockReturnValue(model);
  mockGenerate.mockReset().mockResolvedValue(pdfBlob());
  mockDownload.mockReset().mockResolvedValue(undefined);
  mockDownloadObjectUrl.mockReset();
  mockIsIos.mockReset().mockReturnValue(false);
  createObjectUrl.mockClear();
  revokeObjectUrl.mockClear();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createObjectUrl,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeObjectUrl,
  });
  setNavigator({ platform: 'Win32', userAgent: 'Chrome' });
});

afterEach(() => {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: originalNavigator,
  });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: originalCreateObjectUrl,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: originalRevokeObjectUrl,
  });
});

describe('Web PDF integration', () => {
  test('builds a real PDF Blob and downloads the selected past month on desktop', async () => {
    const result = await beginPdfExport({ rows, columns, meta, filename });

    expect(result).toBeNull();
    expect(mockBuildModel).toHaveBeenCalledWith(rows, columns, meta);
    expect(mockGenerate).toHaveBeenCalledWith(model);
    expect(mockDownload).toHaveBeenCalledTimes(1);
    const [blob, downloadedFilename] = mockDownload.mock.calls[0];
    expect(blob.type).toBe('application/pdf');
    expect(await blob.slice(0, 5).text()).toBe('%PDF-');
    expect(downloadedFilename).toBe('fintrack-2025-12.pdf');
  });

  test('rejects an empty, mistyped, or non-PDF result before delivery', async () => {
    for (const blob of [
      new Blob([], { type: 'application/pdf' }),
      new Blob(['%PDF-1.7'], { type: 'text/plain' }),
      new Blob(['not a PDF'], { type: 'application/pdf' }),
    ]) {
      mockGenerate.mockResolvedValueOnce(blob);
      await expect(
        beginPdfExport({ rows, columns, meta, filename }),
      ).rejects.toThrow();
    }
    expect(mockDownload).not.toHaveBeenCalled();
  });

  test('prepares a separate Save action on iOS instead of downloading after generation', async () => {
    mockIsIos.mockReturnValue(true);

    const prepared = await beginPdfExport({ rows, columns, meta, filename });

    expect(prepared).toMatchObject({
      filename,
      objectUrl: 'blob:prepared-pdf',
    });
    expect(prepared?.blob.type).toBe('application/pdf');
    expect(mockDownload).not.toHaveBeenCalled();
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
  });

  test('shares a named File and can save it repeatedly without regenerating', async () => {
    const share = jest
      .fn<(data?: ShareData) => Promise<void>>()
      .mockResolvedValue(undefined);
    const canShare = jest.fn(() => true);
    setNavigator({ canShare, platform: 'iPhone', share, userAgent: 'Safari' });
    const prepared = {
      blob: pdfBlob(),
      filename,
      objectUrl: 'blob:prepared-pdf',
    };

    await expect(savePreparedPdf(prepared)).resolves.toBe('started');
    await expect(savePreparedPdf(prepared)).resolves.toBe('started');

    expect(share).toHaveBeenCalledTimes(2);
    const payload = share.mock.calls[0][0];
    expect(payload?.files?.[0]).toMatchObject({
      name: filename,
      type: 'application/pdf',
    });
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  test('falls back to the already prepared Object URL when file sharing is unavailable', async () => {
    setNavigator({
      canShare: jest.fn(() => false),
      platform: 'iPhone',
      share: jest.fn<(data?: ShareData) => Promise<void>>(),
      userAgent: 'Safari',
    });
    const prepared = {
      blob: pdfBlob(),
      filename,
      objectUrl: 'blob:prepared-pdf',
    };

    await expect(savePreparedPdf(prepared)).resolves.toBe('started');
    expect(mockDownloadObjectUrl).toHaveBeenCalledWith(
      'blob:prepared-pdf',
      filename,
    );
  });

  test('keeps the prepared download fallback when canShare feature detection throws', async () => {
    setNavigator({
      canShare: jest.fn(() => {
        throw new Error('unsupported share payload');
      }),
      platform: 'iPhone',
      share: jest.fn<(data?: ShareData) => Promise<void>>(),
      userAgent: 'Safari',
    });
    const prepared = {
      blob: pdfBlob(),
      filename,
      objectUrl: 'blob:prepared-pdf',
    };

    await expect(savePreparedPdf(prepared)).resolves.toBe('started');
    expect(mockDownloadObjectUrl).toHaveBeenCalledWith(
      'blob:prepared-pdf',
      filename,
    );
  });

  test('treats share cancellation as a user choice and keeps the prepared file reusable', async () => {
    const aborted = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    const share = jest
      .fn<(data?: ShareData) => Promise<void>>()
      .mockRejectedValueOnce(aborted)
      .mockResolvedValueOnce(undefined);
    setNavigator({
      canShare: jest.fn(() => true),
      platform: 'iPhone',
      share,
      userAgent: 'Safari',
    });
    const prepared = {
      blob: pdfBlob(),
      filename,
      objectUrl: 'blob:prepared-pdf',
    };

    await expect(savePreparedPdf(prepared)).resolves.toBe('cancelled');
    await expect(savePreparedPdf(prepared)).resolves.toBe('started');
    expect(revokeObjectUrl).not.toHaveBeenCalled();
  });

  test('keeps a failed share reusable through the prepared download fallback', async () => {
    const share = jest
      .fn<(data?: ShareData) => Promise<void>>()
      .mockRejectedValue(new Error('share failed'));
    setNavigator({
      canShare: jest.fn(() => true),
      platform: 'iPhone',
      share,
      userAgent: 'Safari',
    });
    const prepared = {
      blob: pdfBlob(),
      filename,
      objectUrl: 'blob:prepared-pdf',
    };

    await expect(savePreparedPdf(prepared)).rejects.toThrow();
    await expect(savePreparedPdf(prepared)).resolves.toBe('started');
    expect(share).toHaveBeenCalledTimes(1);
    expect(mockDownloadObjectUrl).toHaveBeenCalledWith(
      'blob:prepared-pdf',
      filename,
    );
  });

  test('releases a prepared Object URL only when its state is discarded', () => {
    disposePreparedPdf({
      blob: pdfBlob(),
      filename,
      objectUrl: 'blob:prepared-pdf',
    });
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:prepared-pdf');
  });
});
