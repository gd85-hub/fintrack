import {
  downloadInBrowser,
  downloadObjectUrlInBrowser,
  isIosBrowser,
  ShareUnavailableError,
} from './exportDelivery';
import { buildPdfReportModel } from './exportPdfModel';
import { generateWebPdfReportBlob } from './exportPdfReport.web';
import type {
  PdfExportRequest,
  PreparedPdfExport,
  PreparedPdfSaveResult,
} from './exportPdfIntegration.types';

export type {
  PdfExportRequest,
  PreparedPdfExport,
  PreparedPdfSaveResult,
} from './exportPdfIntegration.types';

const PDF_SIGNATURE = '%PDF-';

async function assertPdfBlob(blob: Blob): Promise<void> {
  if (blob.type !== 'application/pdf' || blob.size === 0) {
    throw new Error('Invalid PDF result.');
  }
  const signature = await blob.slice(0, PDF_SIGNATURE.length).text();
  if (signature !== PDF_SIGNATURE) {
    throw new Error('Invalid PDF signature.');
  }
}

export async function beginPdfExport(
  request: PdfExportRequest,
): Promise<PreparedPdfExport | null> {
  const model = buildPdfReportModel(
    request.rows,
    request.columns,
    request.meta,
  );
  const blob = await generateWebPdfReportBlob(model);
  await assertPdfBlob(blob);

  if (!isIosBrowser()) {
    await downloadInBrowser(blob, request.filename);
    return null;
  }

  return {
    blob,
    filename: request.filename,
    objectUrl: URL.createObjectURL(blob),
  };
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  );
}

export async function savePreparedPdf(
  prepared: PreparedPdfExport,
): Promise<PreparedPdfSaveResult> {
  if (
    !prepared.shareFailed &&
    typeof File !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  ) {
    const file = new File([prepared.blob], prepared.filename, {
      type: prepared.blob.type,
    });
    const shareData: ShareData = { files: [file] };
    let canShareFiles = false;
    try {
      canShareFiles = navigator.canShare(shareData);
    } catch {
      // Treat feature-detection failures as unsupported and keep the explicit
      // prepared-download fallback available to the same user gesture.
    }
    if (canShareFiles) {
      try {
        // Call share synchronously in this handler before awaiting its result;
        // iOS requires the call itself to retain the user's activation.
        const shareResult = navigator.share(shareData);
        await shareResult;
        return 'started';
      } catch (error: unknown) {
        if (isAbortError(error)) {
          return 'cancelled';
        }
        prepared.shareFailed = true;
        throw new ShareUnavailableError();
      }
    }
  }

  downloadObjectUrlInBrowser(prepared.objectUrl, prepared.filename);
  return 'started';
}

export function disposePreparedPdf(prepared: PreparedPdfExport): void {
  URL.revokeObjectURL(prepared.objectUrl);
}
