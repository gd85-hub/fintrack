import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import {
  parseReceiptHtml,
  parseStructuredReceipt,
  validateReceiptUrl,
  validateRedirectUrl,
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

const browserUserAgent =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36 FintrackReceiptParser/1.0';
const timeoutMs = 15_000;
const maximumRedirects = 3;

function response(payload: ParseFailure | ParseSuccess) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function failure(error: ParseError, debug: boolean, raw?: string) {
  return response({
    ok: false,
    error,
    ...(debug && raw ? { raw } : {}),
  });
}

async function safeFetch(
  originalUrl: string,
  signal: AbortSignal,
): Promise<Response> {
  let currentUrl = originalUrl;

  for (let redirects = 0; redirects <= maximumRedirects; redirects += 1) {
    const result = await fetch(currentUrl, {
      headers: {
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        'User-Agent': browserUserAgent,
      },
      redirect: 'manual',
      signal,
    });

    if (result.status < 300 || result.status >= 400) {
      return result;
    }

    const location = result.headers.get('location');
    if (!location || redirects === maximumRedirects) {
      throw new Error('Unsafe or excessive redirect');
    }
    const nextUrl = new URL(location, currentUrl).toString();
    if (!validateRedirectUrl(nextUrl)) {
      throw new Error('Redirect host is not allowed');
    }
    currentUrl = nextUrl;
  }

  throw new Error('Redirect limit reached');
}

function totalMatches(receipt: ReceiptFields) {
  const itemsTotal = receipt.items.reduce(
    (sum, item) => sum + item.lineTotalCents,
    0,
  );
  const tolerance = Math.max(1, Math.floor(receipt.totalCents * 0.01));
  return Math.abs(itemsTotal - receipt.totalCents) <= tolerance;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let debug = false;
  let raw: string | undefined;
  try {
    if (request.method !== 'POST') {
      return failure('parse_failed', debug);
    }

    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return failure('unsupported_url', debug);
    }
    const url = Reflect.get(body, 'url');
    debug = Reflect.get(body, 'debug') === true;
    if (typeof url !== 'string' || !validateReceiptUrl(url)) {
      return failure('unsupported_url', debug);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let fetched: Response;
    try {
      fetched = await safeFetch(url, controller.signal);
      raw = await fetched.text();
    } finally {
      clearTimeout(timeout);
    }

    if (!fetched.ok) {
      return failure('fetch_failed', debug, raw);
    }

    let parsed: ReceiptFields | null = null;
    const contentType = fetched.headers.get('content-type') ?? '';
    if (contentType.includes('json')) {
      try {
        parsed = parseStructuredReceipt(JSON.parse(raw));
      } catch {
        // Some upstream responses advertise JSON while returning HTML.
      }
    }
    parsed ??= parseReceiptHtml(raw);
    if (!parsed) {
      return failure('parse_failed', debug, raw);
    }
    if (!totalMatches(parsed)) {
      return failure('total_mismatch', debug, raw);
    }

    return response({
      ok: true,
      ...parsed,
      currency: 'RSD',
      ...(debug ? { raw } : {}),
    });
  } catch (error: unknown) {
    const timedOut =
      error instanceof DOMException && error.name === 'AbortError';
    return failure(timedOut ? 'timeout' : 'fetch_failed', debug, raw);
  }
});
