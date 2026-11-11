import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
  clampToSettled,
  type FxQuote,
  type FxSource,
  isValidDate,
  parseFrankfurterResponse,
} from './source.ts';

type RateResult = {
  date: string;
  syncedDate: string;
  ok: boolean;
  error?: string;
};

type SupabaseAdminClient = ReturnType<typeof createClient>;

const corsHeaders = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseDates(body: unknown): string[] {
  if (!isRecord(body) || !Array.isArray(body.dates)) {
    return [];
  }

  return body.dates.filter(
    (date): date is string => typeof date === 'string',
  );
}

function todayInBelgrade(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Belgrade',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Unable to determine the current Belgrade date.');
  }

  return `${year}-${month}-${day}`;
}

export class FrankfurterSource implements FxSource {
  async getRatesForDate(dateISO: string): Promise<FxQuote[]> {
    const response = await fetch(
      `https://api.frankfurter.dev/v2/rates?date=${dateISO}&base=EUR`,
    );

    if (!response.ok) {
      throw new Error(`Frankfurter API returned HTTP ${response.status}.`);
    }

    const payload: unknown = await response.json();
    const quotes = parseFrankfurterResponse(payload, dateISO);
    if (quotes.length === 0) {
      throw new Error('Frankfurter API returned no valid rates.');
    }

    return quotes;
  }
}

function createFxSource(name: string): FxSource {
  switch (name) {
    case 'frankfurter':
      return new FrankfurterSource();
    default:
      throw new Error(`Unsupported FX source: ${name}.`);
  }
}

async function syncDate(
  date: string,
  syncedDate: string,
  source: FxSource,
  adminClient: SupabaseAdminClient,
): Promise<RateResult> {
  try {
    const quotes = await source.getRatesForDate(syncedDate);
    const rows = quotes.map((quote) => ({
      date: quote.date,
      base_currency: 'EUR',
      quote_currency: quote.code,
      rate: quote.ratePerEur,
      source: 'frankfurter',
    }));
    const { error } = await adminClient.from('fx_rates').upsert(rows, {
      onConflict: 'date,base_currency,quote_currency',
      ignoreDuplicates: true,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { date, syncedDate, ok: true };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown synchronization error.';
    console.error(`FX synchronization failed for ${date}:`, message);
    return { date, syncedDate, ok: false, error: message };
  }
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(JSON.stringify({ ok: true }), {
      headers: corsHeaders,
    });
  }

  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({
        results: [
          {
            date: '',
            syncedDate: '',
            ok: false,
            error: 'Method not allowed.',
          },
        ],
      }),
      { status: 405, headers: corsHeaders },
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({
        results: [
          {
            date: '',
            syncedDate: '',
            ok: false,
            error: 'Required Supabase environment variables are missing.',
          },
        ],
      }),
      { status: 500, headers: corsHeaders },
    );
  }

  let body: unknown = null;
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : null;
  } catch (error: unknown) {
    console.error('Unable to parse sync-rates request body:', error);
  }

  const todayBelgradeISO = todayInBelgrade();
  const requestedDates = parseDates(body);
  const dates = requestedDates.length > 0
    ? requestedDates
    : [todayBelgradeISO];
  const results: RateResult[] = [];
  const seenSyncedDates = new Set<string>();
  const sourceName = Deno.env.get('FX_SOURCE') ?? 'frankfurter';
  let source: FxSource | null = null;
  let sourceError = '';

  try {
    source = createFxSource(sourceName);
  } catch (error: unknown) {
    sourceError = error instanceof Error
      ? error.message
      : 'Unable to select the FX source.';
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  for (const date of dates) {
    if (!isValidDate(date)) {
      const error = 'Date must use a valid YYYY-MM-DD format.';
      console.error(`FX synchronization rejected ${date}:`, error);
      results.push({ date, syncedDate: date, ok: false, error });
      continue;
    }

    const syncedDate = clampToSettled(date, todayBelgradeISO);
    if (seenSyncedDates.has(syncedDate)) {
      continue;
    }
    seenSyncedDates.add(syncedDate);

    if (!source) {
      results.push({
        date,
        syncedDate,
        ok: false,
        error: sourceError,
      });
      continue;
    }

    results.push(await syncDate(date, syncedDate, source, adminClient));
  }

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: corsHeaders,
  });
}

Deno.serve(async (request: Request) => {
  try {
    return await handleRequest(request);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown synchronization error.';
    console.error('Unhandled sync-rates error:', message);
    return new Response(
      JSON.stringify({
        results: [
          { date: '', syncedDate: '', ok: false, error: message },
        ],
      }),
      { status: 500, headers: corsHeaders },
    );
  }
});
