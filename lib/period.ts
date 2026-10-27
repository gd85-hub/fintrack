import {
  formatDayMonth,
  formatMonthTitle,
  monthBounds,
  shiftMonth,
  todayLocalISO,
} from './dates';
import type { ActiveLocale, Translate } from './i18n';

export type Period =
  | { kind: 'thisMonth' }
  | { kind: 'lastMonth' }
  | { kind: 'last3Months' }
  | { kind: 'thisYear' }
  | { kind: 'custom'; fromISO: string; toISO: string };

export type ResolvedPeriod = { fromISO: string; toISO: string };

export function resolvePeriod(
  period: Period,
  today = todayLocalISO(),
): ResolvedPeriod {
  if (period.kind === 'custom') {
    return { fromISO: period.fromISO, toISO: period.toISO };
  }

  const thisMonth = today.slice(0, 7);

  if (period.kind === 'lastMonth') {
    const { first, last } = monthBounds(shiftMonth(thisMonth, -1));
    return { fromISO: first, toISO: last };
  }

  if (period.kind === 'last3Months') {
    const { first } = monthBounds(shiftMonth(thisMonth, -2));
    const { last } = monthBounds(thisMonth);
    return { fromISO: first, toISO: last };
  }

  if (period.kind === 'thisYear') {
    const year = today.slice(0, 4);
    return {
      fromISO: `${year}-01-01`,
      toISO: `${year}-12-31`,
    };
  }

  const { first, last } = monthBounds(thisMonth);
  return { fromISO: first, toISO: last };
}

export function periodLabel(
  period: Period,
  locale: ActiveLocale,
  t: Translate,
): string {
  if (period.kind === 'last3Months') {
    return t('period.last3Months');
  }

  if (period.kind === 'thisYear') {
    return todayLocalISO().slice(0, 4);
  }

  if (period.kind === 'custom') {
    return `${formatDayMonth(period.fromISO, locale)} – ${formatDayMonth(period.toISO, locale)}`;
  }

  const thisMonth = todayLocalISO().slice(0, 7);
  const month =
    period.kind === 'lastMonth' ? shiftMonth(thisMonth, -1) : thisMonth;
  return formatMonthTitle(month, locale);
}
