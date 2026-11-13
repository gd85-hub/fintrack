import { localDateToISO, parseLocalISO } from './dates';
import { ANCHOR_CURRENCY } from './fxDisplay';
import { normalizeCurrencyCode } from './money';
import { supabase } from './supabase';

export type AnchorRate = {
  date: string;
  quote: string;
  ratePerEur: number;
};

export type LatestAnchorRate = Pick<AnchorRate, 'date' | 'ratePerEur'>;

const ANCHOR_RATE_ERROR_MESSAGE =
  'Курс валюты недоступен. Проверьте соединение и попробуйте ещё раз.';

export class AnchorRateUnavailableError extends Error {
  constructor() {
    super(ANCHOR_RATE_ERROR_MESSAGE);
    this.name = 'AnchorRateUnavailableError';
  }
}

type JsonObject = Record<string, unknown>;

const RATE_SELECTION = 'date,quote_currency,rate';

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseAnchorRows(data: unknown): AnchorRate[] {
  if (!Array.isArray(data)) {
    return [];
  }

  const rates: AnchorRate[] = [];

  for (const row of data) {
    if (
      !isObject(row) ||
      row.base_currency !== ANCHOR_CURRENCY ||
      typeof row.date !== 'string' ||
      typeof row.quote_currency !== 'string' ||
      (typeof row.rate !== 'number' && typeof row.rate !== 'string')
    ) {
      continue;
    }

    const quote = normalizeCurrencyCode(row.quote_currency);
    const ratePerEur = Number(row.rate);
    if (
      quote === null ||
      !Number.isFinite(ratePerEur) ||
      ratePerEur <= 0
    ) {
      continue;
    }

    rates.push({
      date: row.date,
      quote,
      ratePerEur,
    });
  }

  return rates;
}

export function pickRateOnOrBefore(
  rows: readonly AnchorRate[],
  quote: string,
  dateISO: string,
): AnchorRate | null {
  const normalizedQuote = normalizeCurrencyCode(quote);
  if (!normalizedQuote) {
    return null;
  }

  let selected: AnchorRate | null = null;
  for (const row of rows) {
    if (
      normalizeCurrencyCode(row.quote) !== normalizedQuote ||
      row.date > dateISO ||
      (selected !== null && row.date <= selected.date)
    ) {
      continue;
    }
    selected = row;
  }

  return selected;
}

function parseSelectedRows(data: unknown): AnchorRate[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return parseAnchorRows(
    data.map((row) =>
      isObject(row)
        ? { ...row, base_currency: ANCHOR_CURRENCY }
        : row,
    ),
  );
}

function shiftCalendarDate(dateISO: string, deltaDays: number): string {
  const parts = parseLocalISO(dateISO);
  if (!parts) {
    throw new Error('Date must use a valid YYYY-MM-DD format.');
  }

  return localDateToISO(
    new Date(parts.year, parts.month - 1, parts.day + deltaDays),
  );
}

async function hasAnchorRateOnOrBefore(dateISO: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('fx_rates')
    .select('date')
    .eq('base_currency', ANCHOR_CURRENCY)
    .lte('date', dateISO)
    .order('date', { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return Array.isArray(data) && data.length > 0;
}

export async function resolveAnchorRate(
  quote: string,
  dateISO: string,
): Promise<AnchorRate | null> {
  const normalizedQuote = normalizeCurrencyCode(quote);
  if (!normalizedQuote) {
    return null;
  }

  if (normalizedQuote === ANCHOR_CURRENCY) {
    return {
      date: dateISO,
      quote: ANCHOR_CURRENCY,
      ratePerEur: 1,
    };
  }

  const { data: earlierData, error: earlierError } = await supabase
    .from('fx_rates')
    .select(RATE_SELECTION)
    .eq('base_currency', ANCHOR_CURRENCY)
    .eq('quote_currency', normalizedQuote)
    .lte('date', dateISO)
    .order('date', { ascending: false })
    .limit(1);

  if (earlierError) {
    throw earlierError;
  }

  const earlierRate = pickRateOnOrBefore(
    parseSelectedRows(earlierData),
    normalizedQuote,
    dateISO,
  );
  if (earlierRate) {
    return earlierRate;
  }

  const { data: earliestData, error: earliestError } = await supabase
    .from('fx_rates')
    .select(RATE_SELECTION)
    .eq('base_currency', ANCHOR_CURRENCY)
    .eq('quote_currency', normalizedQuote)
    .order('date', { ascending: true })
    .limit(1);

  if (earliestError) {
    throw earliestError;
  }

  return parseSelectedRows(earliestData)[0] ?? null;
}

export async function ensureAnchorRatesFor(dateISO: string): Promise<boolean> {
  if (await hasAnchorRateOnOrBefore(dateISO)) {
    return true;
  }

  const { error } = await supabase.functions.invoke('sync-rates', {
    body: { dates: [dateISO] },
  });

  if (error) {
    console.error('Unable to synchronize anchor FX rates:', error.message);
  }

  return hasAnchorRateOnOrBefore(dateISO);
}

export async function anchorRateForExpense(
  currency: string,
  dateISO: string,
): Promise<AnchorRate> {
  const normalizedCurrency = normalizeCurrencyCode(currency);
  if (normalizedCurrency === ANCHOR_CURRENCY) {
    return {
      date: dateISO,
      quote: ANCHOR_CURRENCY,
      ratePerEur: 1,
    };
  }

  if (!normalizedCurrency) {
    throw new AnchorRateUnavailableError();
  }

  try {
    const existing = await resolveAnchorRate(normalizedCurrency, dateISO);
    if (existing) {
      return existing;
    }
  } catch (error: unknown) {
    console.error('Unable to resolve anchor FX rate:', error);
  }

  try {
    const { error } = await supabase.functions.invoke('sync-rates', {
      body: { dates: [dateISO] },
    });
    if (error) {
      console.error('Unable to synchronize anchor FX rates:', error.message);
    }
  } catch (error: unknown) {
    console.error('Unable to synchronize anchor FX rates:', error);
  }

  try {
    const refreshed = await resolveAnchorRate(normalizedCurrency, dateISO);
    if (refreshed) {
      return refreshed;
    }
  } catch (error: unknown) {
    console.error('Unable to resolve refreshed anchor FX rate:', error);
  }

  throw new AnchorRateUnavailableError();
}

export async function fetchAnchorRatesForRange(
  quote: string,
  fromISO: string,
  toISO: string,
): Promise<AnchorRate[]> {
  const normalizedQuote = normalizeCurrencyCode(quote);
  if (!normalizedQuote) {
    return [];
  }

  const paddedFromISO = shiftCalendarDate(fromISO, -10);
  const { data, error } = await supabase
    .from('fx_rates')
    .select(RATE_SELECTION)
    .eq('base_currency', ANCHOR_CURRENCY)
    .eq('quote_currency', normalizedQuote)
    .lte('date', toISO)
    .gte('date', paddedFromISO)
    .order('date', { ascending: false });

  if (error) {
    throw error;
  }

  const rates = parseSelectedRows(data);
  if (pickRateOnOrBefore(rates, normalizedQuote, fromISO)) {
    return rates;
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from('fx_rates')
    .select(RATE_SELECTION)
    .eq('base_currency', ANCHOR_CURRENCY)
    .eq('quote_currency', normalizedQuote)
    .lte('date', fromISO)
    .order('date', { ascending: false })
    .limit(1);

  if (fallbackError) {
    throw fallbackError;
  }

  const fallback = parseSelectedRows(fallbackData)[0];
  return fallback ? [...rates, fallback] : rates;
}

export async function ensureAnchorRatesForRange(
  quote: string,
  neededDates: readonly string[],
): Promise<AnchorRate[]> {
  const normalizedQuote = normalizeCurrencyCode(quote);
  if (!normalizedQuote || normalizedQuote === ANCHOR_CURRENCY) {
    return [];
  }

  const dates = [...new Set(neededDates)].filter(Boolean);
  if (dates.length === 0) {
    return [];
  }

  const fromISO = dates.reduce((earliest, date) =>
    date < earliest ? date : earliest,
  );
  const toISO = dates.reduce((latest, date) =>
    date > latest ? date : latest,
  );

  let rows = await fetchAnchorRatesForRange(
    normalizedQuote,
    fromISO,
    toISO,
  );
  const missing = dates.filter(
    (date) => !pickRateOnOrBefore(rows, normalizedQuote, date),
  );
  if (missing.length === 0) {
    return rows;
  }

  try {
    const { error } = await supabase.functions.invoke('sync-rates', {
      body: { dates: missing },
    });
    if (error) {
      console.error(
        'Unable to sync anchor FX rates for display:',
        error.message,
      );
    }
  } catch (error: unknown) {
    console.error('Unable to sync anchor FX rates for display:', error);
  }

  rows = await fetchAnchorRatesForRange(
    normalizedQuote,
    fromISO,
    toISO,
  );
  return rows;
}

export async function fetchLatestAnchorRates(
  quotes: readonly string[],
  onOrBeforeISO: string,
): Promise<Map<string, LatestAnchorRate>> {
  const wanted = [
    ...new Set(
      quotes
        .map((quote) => normalizeCurrencyCode(quote))
        .filter(
          (quote): quote is string =>
            Boolean(quote) && quote !== ANCHOR_CURRENCY,
        ),
    ),
  ];
  if (wanted.length === 0) {
    return new Map();
  }

  const read = async () => {
    const { data, error } = await supabase
      .from('fx_rates')
      .select(RATE_SELECTION)
      .eq('base_currency', ANCHOR_CURRENCY)
      .in('quote_currency', wanted)
      .lte('date', onOrBeforeISO)
      .order('date', { ascending: false });

    if (error) {
      throw error;
    }

    const rates = new Map<string, LatestAnchorRate>();
    for (const row of parseSelectedRows(data)) {
      if (!rates.has(row.quote)) {
        rates.set(row.quote, {
          date: row.date,
          ratePerEur: row.ratePerEur,
        });
      }
    }
    return rates;
  };

  let rates = await read();
  const missing = wanted.filter((quote) => !rates.has(quote));
  if (missing.length === 0) {
    return rates;
  }

  try {
    const { error } = await supabase.functions.invoke('sync-rates', {
      body: { dates: [onOrBeforeISO] },
    });
    if (error) {
      console.error('Unable to sync latest FX rates:', error.message);
    }
  } catch (error: unknown) {
    console.error('Unable to sync latest FX rates:', error);
  }

  rates = await read();
  return rates;
}
