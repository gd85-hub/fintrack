export type FxQuote = {
  date: string;
  code: string;
  ratePerEur: number;
};

export interface FxSource {
  getRatesForDate(dateISO: string): Promise<FxQuote[]>;
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isValidDate(date: string): boolean {
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

export function parseFrankfurterResponse(
  payload: unknown,
  requestedDateISO: string,
): FxQuote[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  const quotes: FxQuote[] = [];
  const seen = new Set<string>();

  for (const value of payload) {
    if (
      !isObject(value) ||
      typeof value.date !== 'string' ||
      !isValidDate(value.date) ||
      value.date > requestedDateISO ||
      typeof value.base !== 'string' ||
      value.base.toUpperCase() !== 'EUR' ||
      typeof value.quote !== 'string' ||
      typeof value.rate !== 'number' ||
      !Number.isFinite(value.rate) ||
      value.rate <= 0
    ) {
      continue;
    }

    const code = value.quote.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code) || code === 'EUR') {
      continue;
    }

    const key = `${value.date}\u0000${code}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    quotes.push({
      date: value.date,
      code,
      ratePerEur: value.rate,
    });
  }

  return quotes;
}

export function clampToSettled(
  dateISO: string,
  todayBelgradeISO: string,
): string {
  if (dateISO < todayBelgradeISO) {
    return dateISO;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayBelgradeISO);
  if (!match) {
    throw new Error('Today must use a valid YYYY-MM-DD format.');
  }

  const yesterday = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]) - 1,
  );
  const year = String(yesterday.getFullYear()).padStart(4, '0');
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
