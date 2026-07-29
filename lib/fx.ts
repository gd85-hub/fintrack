import { todayLocalISO } from './dates';
import { supabase } from './supabase';

type FxRateRow = {
  date: string;
  base_currency: 'USD' | 'EUR';
  quote_currency: 'RSD';
  rate: number | string;
};

export type ResolvedRates = {
  date: string;
  usdRsd: number;
  eurRsd: number;
};

const RATE_ERROR_MESSAGE =
  'Не удалось загрузить курсы валют. Проверьте интернет и попробуйте ещё раз.';

export class RateUnavailableError extends Error {
  constructor() {
    super(RATE_ERROR_MESSAGE);
    this.name = 'RateUnavailableError';
  }
}

function parseRows(data: unknown): FxRateRow[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter((row): row is FxRateRow => {
    if (typeof row !== 'object' || row === null) {
      return false;
    }

    const candidate = row as Partial<FxRateRow>;
    return (
      typeof candidate.date === 'string' &&
      (candidate.base_currency === 'USD' ||
        candidate.base_currency === 'EUR') &&
      candidate.quote_currency === 'RSD' &&
      (typeof candidate.rate === 'number' ||
        typeof candidate.rate === 'string')
    );
  });
}

function findCompletePair(rows: FxRateRow[]): ResolvedRates | null {
  const grouped = new Map<
    string,
    { usdRsd?: number; eurRsd?: number }
  >();

  for (const row of rows) {
    const rate = Number(row.rate);

    if (!Number.isFinite(rate) || rate <= 0) {
      continue;
    }

    const entry = grouped.get(row.date) ?? {};
    if (row.base_currency === 'USD') {
      entry.usdRsd = rate;
    } else {
      entry.eurRsd = rate;
    }
    grouped.set(row.date, entry);
  }

  for (const [date, rates] of grouped) {
    if (rates.usdRsd !== undefined && rates.eurRsd !== undefined) {
      return { date, usdRsd: rates.usdRsd, eurRsd: rates.eurRsd };
    }
  }

  return null;
}

async function queryRatesForDate(dateISO: string): Promise<FxRateRow[]> {
  const { data, error } = await supabase
    .from('fx_rates')
    .select('date,base_currency,quote_currency,rate')
    .eq('date', dateISO)
    .eq('quote_currency', 'RSD')
    .in('base_currency', ['USD', 'EUR']);

  if (error) {
    throw error;
  }

  return parseRows(data);
}

export async function ensureRatesFor(dateISO: string): Promise<boolean> {
  const existing = await queryRatesForDate(dateISO);
  if (findCompletePair(existing)) {
    return true;
  }

  const today = todayLocalISO();
  const dates = dateISO === today ? [dateISO] : [dateISO, today];
  const { error } = await supabase.functions.invoke('sync-fx', {
    body: { dates },
  });

  if (error) {
    console.error('Unable to synchronize FX rates:', error.message);
  }

  const refreshed = await queryRatesForDate(dateISO);
  return findCompletePair(refreshed) !== null;
}

export async function resolveRates(
  dateISO: string,
): Promise<ResolvedRates | null> {
  const { data: earlierData, error: earlierError } = await supabase
    .from('fx_rates')
    .select('date,base_currency,quote_currency,rate')
    .lte('date', dateISO)
    .eq('quote_currency', 'RSD')
    .in('base_currency', ['USD', 'EUR'])
    .order('date', { ascending: false });

  if (earlierError) {
    throw earlierError;
  }

  const earlierPair = findCompletePair(parseRows(earlierData));
  if (earlierPair) {
    return earlierPair;
  }

  const { data: earliestData, error: earliestError } = await supabase
    .from('fx_rates')
    .select('date,base_currency,quote_currency,rate')
    .eq('quote_currency', 'RSD')
    .in('base_currency', ['USD', 'EUR'])
    .order('date', { ascending: true });

  if (earliestError) {
    throw earliestError;
  }

  return findCompletePair(parseRows(earliestData));
}

export async function ratesForExpense(
  dateISO: string,
): Promise<ResolvedRates> {
  try {
    await ensureRatesFor(dateISO);
    const rates = await resolveRates(dateISO);

    if (rates) {
      return rates;
    }
  } catch (error: unknown) {
    console.error('Unable to resolve FX rates:', error);
  }

  throw new RateUnavailableError();
}

export async function warmTodayRates(): Promise<void> {
  const today = todayLocalISO();
  const { error } = await supabase.functions.invoke('sync-fx', {
    body: { dates: [today] },
  });

  if (error) {
    console.error('Unable to warm today’s FX rates:', error.message);
  }
}
