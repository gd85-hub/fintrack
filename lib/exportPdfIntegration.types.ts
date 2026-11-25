import type { ExportColumns, ExportMeta, ExportRow } from './export';

export type PdfExportRequest = {
  rows: readonly ExportRow[];
  columns: ExportColumns;
  meta: ExportMeta;
  filename: string;
};

export type PreparedPdfExport = {
  blob: Blob;
  filename: string;
  objectUrl: string;
  shareFailed?: boolean;
};

export type PreparedPdfSaveResult = 'started' | 'cancelled';
