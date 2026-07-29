import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type RateResult = {
  date: string;
  ok: boolean;
  error?: string;
};

type KursRate = {
  code: 'USD' | 'EUR';
  exchangeMiddle: number;
};

const corsHeaders = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

function readRate(value: unknown, code: 'USD' | 'EUR'): KursRate | null {
  if (!isRecord(value) || value.code !== code) {
    return null;
  }

  const exchangeMiddle = value.exchange_middle;
  if (
    typeof exchangeMiddle !== 'number' ||
    !Number.isFinite(exchangeMiddle) ||
    exchangeMiddle <= 0
  ) {
    return null;
  }

  return { code, exchangeMiddle };
}

function parseDates(body: unknown): string[] {
  if (!isRecord(body) || !Array.isArray(body.dates)) {
    return [];
  }

  return body.dates.filter(
    (date): date is string => typeof date === 'string',
  );
}

function isValidDate(date: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(year, month - 1, day);
  return (
    candidate.getFullYear() === year &&
    candidate.getMonth() === month - 1 &&
    candidate.getDate() === day
  );
}

async function syncDate(
  date: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<RateResult> {
  try {
    const response = await fetch(
      `https://kurs.resenje.org/api/v1/rates/${date}`,
    );

    if (!response.ok) {
      throw new Error(`Kurs API returned HTTP ${response.status}.`);
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.rates)) {
      throw new Error('Kurs API returned malformed JSON.');
    }

    const usd = payload.rates
      .map((rate) => readRate(rate, 'USD'))
      .find((rate) => rate !== null);
    const eur = payload.rates
      .map((rate) => readRate(rate, 'EUR'))
      .find((rate) => rate !== null);

    if (!usd || !eur) {
      throw new Error('Kurs API response is missing USD or EUR.');
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { error } = await adminClient.from('fx_rates').upsert(
      [
        {
          date,
          base_currency: 'USD',
          quote_currency: 'RSD',
          rate: usd.exchangeMiddle,
          source: 'nbs:kurs.resenje.org',
        },
        {
          date,
          base_currency: 'EUR',
          quote_currency: 'RSD',
          rate: eur.exchangeMiddle,
          source: 'nbs:kurs.resenje.org',
        },
      ],
      { onConflict: 'date,base_currency,quote_currency' },
    );

    if (error) {
      throw new Error(error.message);
    }

    return { date, ok: true };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown synchronization error.';
    console.error(`FX synchronization failed for ${date}:`, message);
    return { date, ok: false, error: message };
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({
        results: [{ date: '', ok: false, error: 'Method not allowed.' }],
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
    console.error('Unable to parse sync-fx request body:', error);
  }

  const requestedDates = parseDates(body);
  const dates = [...new Set(
    requestedDates.length > 0 ? requestedDates : [todayInBelgrade()],
  )];
  const results: RateResult[] = [];

  for (const date of dates) {
    if (!isValidDate(date)) {
      const error = 'Date must use a valid YYYY-MM-DD format.';
      console.error(`FX synchronization rejected ${date}:`, error);
      results.push({ date, ok: false, error });
      continue;
    }

    results.push(await syncDate(date, supabaseUrl, serviceRoleKey));
  }

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: corsHeaders,
  });
});
