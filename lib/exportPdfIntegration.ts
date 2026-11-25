import { buildExpensesPdfHtml } from './export';
import { deliverPdf, ShareUnavailableError } from './exportDelivery';
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

// Native/default entry. Metro selects exportPdfIntegration.web.ts on Web.
export async function beginPdfExport(
  request: PdfExportRequest,
): Promise<PreparedPdfExport | null> {
  await deliverPdf(
    buildExpensesPdfHtml(request.rows, request.columns, request.meta),
    request.filename,
  );
  return null;
}

export function disposePreparedPdf(_prepared: PreparedPdfExport): void {}

export async function savePreparedPdf(
  _prepared: PreparedPdfExport,
): Promise<PreparedPdfSaveResult> {
  throw new ShareUnavailableError();
}
