import {
  parseReceiptHtml,
  parseStructuredReceipt,
  validateReceiptUrl,
  type ReceiptFields,
} from './parser.ts';

type ParseError =
  | 'fetch_failed'
  | 'parse_failed'
  | 'timeout'
  | 'total_mismatch'
  | 'unsupported_url';

type ParseFailure = {
  ok: false;
  error: ParseError;
  raw?: string;
};

type ParseSuccess = ReceiptFields & {
  ok: true;
  currency: 'RSD';
  raw?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
};

const maximumHtmlLength = 2 * 1024 * 1024;
const debugRawLength = 8 * 1024;

function response(payload: ParseFailure | ParseSuccess) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function failure(error: ParseError, debug: boolean, raw?: string) {
  return {
    ok: false,
    error,
    ...(debug && raw ? { raw: raw.slice(0, debugRawLength) } : {}),
  } satisfies ParseFailure;
}

function totalMatches(receipt: ReceiptFields) {
  const itemsTotal = receipt.items.reduce(
    (sum, item) => sum + item.lineTotalCents,
    0,
  );
  const tolerance = Math.max(1, Math.floor(receipt.totalCents * 0.01));
  return Math.abs(itemsTotal - receipt.totalCents) <= tolerance;
}

export function parseReceiptPayload(
  body: unknown,
): ParseFailure | ParseSuccess {
  let debug = false;
  let html: string | undefined;
  try {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return failure('unsupported_url', debug);
    }

    debug = Reflect.get(body, 'debug') === true;
    const sourceUrl = Reflect.get(body, 'sourceUrl');
    if (
      typeof sourceUrl !== 'string' ||
      !validateReceiptUrl(sourceUrl)
    ) {
      return failure('unsupported_url', debug);
    }

    const htmlValue = Reflect.get(body, 'html');
    if (
      typeof htmlValue !== 'string' ||
      !htmlValue.trim() ||
      htmlValue.length > maximumHtmlLength
    ) {
      return failure('parse_failed', debug);
    }
    html = htmlValue;

    let parsed: ReceiptFields | null = null;
    try {
      parsed = parseStructuredReceipt(JSON.parse(html));
    } catch {
      // Verification pages are normally HTML, not standalone JSON.
    }
    parsed ??= parseReceiptHtml(html);
    if (!parsed) {
      return failure('parse_failed', debug, html);
    }
    if (!totalMatches(parsed)) {
      return failure('total_mismatch', debug, html);
    }

    return {
      ok: true,
      ...parsed,
      currency: 'RSD',
      ...(debug ? { raw: html.slice(0, debugRawLength) } : {}),
    };
  } catch {
    return failure('parse_failed', debug, html);
  }
}

export async function handleParseReceiptRequest(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return response(failure('parse_failed', false));
  }

  try {
    const body: unknown = await request.json();
    return response(parseReceiptPayload(body));
  } catch {
    return response(failure('parse_failed', false));
  }
}

declare const Deno:
  | {
      serve: (
        handler: (request: Request) => Response | Promise<Response>,
      ) => void;
    }
  | undefined;

if (typeof Deno !== 'undefined') {
  Deno.serve(handleParseReceiptRequest);
}
