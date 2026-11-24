import { buildPdfDocument } from './exportPdfDocument';
import { generateWebPdfBlob } from './exportPdfEngine.web';
import type { PdfReportModel } from './exportPdfModel';

export function generateWebPdfReportBlob(
  model: PdfReportModel,
): Promise<Blob> {
  return generateWebPdfBlob(buildPdfDocument(model));
}
