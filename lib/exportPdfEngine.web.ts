export type WebPdfDocumentDefinition = {
  content: readonly unknown[];
  [key: string]: unknown;
};

type PdfMakeApi = {
  addVirtualFileSystem(vfs: Record<string, string>): void;
  createPdf(documentDefinition: WebPdfDocumentDefinition): {
    getBlob(): Promise<Blob>;
  };
};

let enginePromise: Promise<PdfMakeApi> | null = null;

export class WebPdfEngineError extends Error {
  readonly originalError: unknown;

  constructor(message: string, originalError: unknown) {
    super(message);
    this.name = 'WebPdfEngineError';
    this.originalError = originalError;
  }
}

function unwrapCommonJsModule<T>(loaded: unknown): T {
  if (
    typeof loaded === 'object' &&
    loaded !== null &&
    'default' in loaded
  ) {
    return (loaded as { default: T }).default;
  }
  return loaded as T;
}

async function initializeEngine(): Promise<PdfMakeApi> {
  const [pdfMakeModule, fontModule] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  const pdfMake = unwrapCommonJsModule<PdfMakeApi>(pdfMakeModule);
  const fonts = unwrapCommonJsModule<Record<string, string>>(fontModule);

  pdfMake.addVirtualFileSystem(fonts);
  return pdfMake;
}

async function loadEngine(): Promise<PdfMakeApi> {
  if (enginePromise === null) {
    enginePromise = initializeEngine().catch((error: unknown) => {
      enginePromise = null;
      throw new WebPdfEngineError(
        'Unable to initialize the Web PDF engine.',
        error,
      );
    });
  }
  return enginePromise;
}

export async function generateWebPdfBlob(
  documentDefinition: WebPdfDocumentDefinition,
): Promise<Blob> {
  try {
    const pdfMake = await loadEngine();
    const blob = await pdfMake.createPdf(documentDefinition).getBlob();

    if (blob.type !== 'application/pdf' || blob.size === 0) {
      throw new Error(
        `Unexpected PDF result: type=${blob.type || '(empty)'}, size=${blob.size}.`,
      );
    }
    return blob;
  } catch (error: unknown) {
    if (error instanceof WebPdfEngineError) {
      throw error;
    }
    throw new WebPdfEngineError('Unable to generate the Web PDF.', error);
  }
}
