const MONTHS_NOMINATIVE = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const;

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

const WEEKDAYS = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
] as const;

export type LocalDateParts = {
  year: number;
  month: number;
  day: number;
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function localDateToISO(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayLocalISO(): string {
  return localDateToISO(new Date());
}

export function yesterdayLocalISO(): string {
  const now = new Date();
  return localDateToISO(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
  );
}

export function parseLocalISO(dateISO: string): LocalDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function monthBounds(yyyyMm: string): {
  first: string;
  last: string;
} {
  const match = /^(\d{4})-(\d{2})$/.exec(yyyyMm);

  if (!match) {
    throw new Error('Month must use YYYY-MM format.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12) {
    throw new Error('Month must use YYYY-MM format.');
  }

  const lastDay = new Date(year, month, 0).getDate();
  return {
    first: `${year}-${pad(month)}-01`,
    last: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

export function formatDayHeader(dateISO: string): string {
  const parts = parseLocalISO(dateISO);

  if (!parts) {
    throw new Error('Date must use a valid YYYY-MM-DD format.');
  }

  const date = new Date(parts.year, parts.month - 1, parts.day);
  return `${parts.day} ${MONTHS_GENITIVE[parts.month - 1]}, ${WEEKDAYS[date.getDay()]}`;
}

export function formatLongDate(dateISO: string): string {
  const parts = parseLocalISO(dateISO);

  if (!parts) {
    throw new Error('Date must use a valid YYYY-MM-DD format.');
  }

  return `${parts.day} ${MONTHS_GENITIVE[parts.month - 1]} ${parts.year}`;
}

export function formatMonthTitle(yyyyMm: string): string {
  const bounds = monthBounds(yyyyMm);
  const parts = parseLocalISO(bounds.first);

  if (!parts) {
    throw new Error('Month must use YYYY-MM format.');
  }

  return `${MONTHS_NOMINATIVE[parts.month - 1]} ${parts.year}`;
}

export function shiftMonth(yyyyMm: string, delta: number): string {
  const bounds = monthBounds(yyyyMm);
  const parts = parseLocalISO(bounds.first);

  if (!parts) {
    throw new Error('Month must use YYYY-MM format.');
  }

  const shifted = new Date(parts.year, parts.month - 1 + delta, 1);
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}`;
}
