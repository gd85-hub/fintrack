export type ParsedReceiptItem = {
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  vatLabel: string | null;
};

export type ReceiptFields = {
  merchantName: string;
  taxId: string | null;
  occurredAt: string;
  totalCents: number;
  paymentType: string | null;
  items: ParsedReceiptItem[];
};

type JsonObject = Record<string, unknown>;

const allowedHosts = new Set([
  'suf.purs.gov.rs',
  'sandbox.suf.purs.gov.rs',
  'tap.suf.purs.gov.rs',
  'tap.sandbox.suf.purs.gov.rs',
]);

const serbianMoneySource =
  String.raw`-?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}`;
const serbianQuantitySource = String.raw`\d+(?:,\d+)?`;
const threeAmountItemPattern = new RegExp(
  `^(${serbianMoneySource})\\s+(${serbianQuantitySource})\\s+(${serbianMoneySource})$`,
  'u',
);
const twoAmountItemPattern = new RegExp(
  `^(${serbianMoneySource})\\s+(${serbianMoneySource})$`,
  'u',
);
const fiscalBannerPattern =
  /(?:ФИСКАЛНИ\s+РАЧУН|FISKALNI\s+RA(?:Č|C)UN)/iu;
const itemHeadingPattern =
  /^(?:артикли|artikli|списак артикала|spisak artikala|ставке|stavke|items|назив.*(?:цена|количина).*укупно|naziv.*(?:cena|količina).*ukupno)/iu;
const itemEndPattern =
  /^(?:укупан износ|ukupan iznos|укупно|ukupno|total amount|спецификација пореза|specifikacija poreza|пореске стопе|poreske stope|tax)/iu;
const separatorPattern = /^[=\-_*.\s]+$/u;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstString(
  object: JsonObject | undefined,
  keys: readonly string[],
): string | null {
  if (!object) {
    return null;
  }

  for (const key of keys) {
    const value = object[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function firstValue(
  object: JsonObject | undefined,
  keys: readonly string[],
): unknown {
  if (!object) {
    return undefined;
  }

  for (const key of keys) {
    if (object[key] !== undefined && object[key] !== null) {
      return object[key];
    }
  }

  return undefined;
}

function nestedObject(
  object: JsonObject | undefined,
  keys: readonly string[],
): JsonObject | undefined {
  const value = firstValue(object, keys);
  return isObject(value) ? value : undefined;
}

function normalizedLines(text: string): string[] {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function labelValue(lines: readonly string[], labels: readonly string[]) {
  const pattern = new RegExp(`^(?:${labels.join('|')})\\s*:?\\s*(.*)$`, 'iu');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(pattern);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
    const nextLine = lines[index + 1];
    if (match && nextLine && !separatorPattern.test(nextLine)) {
      return nextLine;
    }
  }
  return null;
}

function parseMoneyValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/[^\d,.\-]/g, '').trim();
  if (!normalized) {
    return null;
  }
  if (normalized.includes(',')) {
    return parseSerbianCents(normalized);
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function parseStructuredItem(value: unknown): ParsedReceiptItem | null {
  if (!isObject(value)) {
    return null;
  }

  const name = firstString(value, [
    'name',
    'itemName',
    'articleName',
    'productName',
  ]);
  const lineTotalCents = parseMoneyValue(
    firstValue(value, ['totalAmount', 'lineTotal', 'total', 'amount']),
  );
  if (!name || lineTotalCents === null) {
    return null;
  }

  const quantityValue = firstValue(value, ['quantity', 'qty']);
  const quantity =
    typeof quantityValue === 'number'
      ? quantityValue
      : typeof quantityValue === 'string'
        ? parseSerbianQuantity(quantityValue)
        : 1;
  const unitPriceCents =
    parseMoneyValue(firstValue(value, ['unitPrice', 'price'])) ??
    Math.round(lineTotalCents / Math.max(quantity, 1));
  const labelsValue = firstValue(value, ['labels', 'vatLabels']);
  const vatLabel =
    firstString(value, ['label', 'vatLabel', 'taxLabel']) ??
    (Array.isArray(labelsValue)
      ? labelsValue
          .map((entry) =>
            typeof entry === 'string'
              ? entry.trim()
              : isObject(entry)
                ? firstString(entry, ['label', 'name'])
                : null,
          )
          .find((entry): entry is string => Boolean(entry)) ?? null
      : null);

  return {
    name,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    unitPriceCents,
    lineTotalCents,
    vatLabel,
  };
}

function paymentLabel(value: unknown): string | null {
  const labels: Record<string, string> = {
    '0': 'Другое',
    '1': 'Наличные',
    '2': 'Карта',
    '3': 'Чек',
    '4': 'Банковский перевод',
    '5': 'Ваучер',
    '6': 'Мобильная оплата',
    card: 'Карта',
    gotovina: 'Наличные',
    kartica: 'Карта',
    cash: 'Наличные',
    check: 'Чек',
    mobilemoney: 'Мобильная оплата',
    other: 'Другое',
    platnakartica: 'Карта',
    voucher: 'Ваучер',
    wiretransfer: 'Банковский перевод',
    готовина: 'Наличные',
    картица: 'Карта',
    платнакартица: 'Карта',
  };
  if (
    (typeof value === 'string' && value.trim()) ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    const normalized = String(value).trim();
    return labels[normalized.toLowerCase().replace(/\s+/g, '')] ?? normalized;
  }
  return null;
}

function extractPayment(request: JsonObject | undefined): string | null {
  const payments = firstValue(request, ['payments', 'payment']);
  if (Array.isArray(payments)) {
    for (const entry of payments) {
      if (isObject(entry)) {
        const label = paymentLabel(
          firstValue(entry, ['paymentType', 'type', 'name']),
        );
        if (label) {
          return label;
        }
      } else {
        const label = paymentLabel(entry);
        if (label) {
          return label;
        }
      }
    }
  }
  return paymentLabel(payments);
}

function extractStructuredItems(request: JsonObject | undefined) {
  const candidate = firstValue(request, [
    'items',
    'invoiceItems',
    'articles',
    'lines',
  ]);
  if (!Array.isArray(candidate)) {
    return [];
  }
  return candidate
    .map(parseStructuredItem)
    .filter((item): item is ParsedReceiptItem => item !== null);
}

function decodeEntities(value: string) {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return value.replace(
    /&(#x[\da-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/giu,
    (entity, code: string) => {
      if (code.startsWith('#x')) {
        return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
      }
      if (code.startsWith('#')) {
        return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
      }
      return named[code.toLowerCase()] ?? entity;
    },
  );
}

function stripMarkup(value: string) {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/giu, '\n')
      .replace(/<\/(?:td|th)>/giu, ' ')
      .replace(/<\/(?:div|p|pre|li|tr|h[1-6])>/giu, '\n')
      .replace(/<[^>]+>/gu, ''),
  )
    .replace(/\r\n?/g, '\n')
    .trim();
}

function journalString(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const result = journalString(entry);
      if (result) {
        return result;
      }
    }
  }
  return null;
}

function findJsonJournal(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const result = findJsonJournal(entry);
      if (result) {
        return result;
      }
    }
    return null;
  }
  if (!isObject(value)) {
    return null;
  }

  for (const key of ['journal', 'journalText', 'receiptJournal']) {
    const result = journalString(value[key]);
    if (result) {
      return result;
    }
  }
  for (const entry of Object.values(value)) {
    const result =
      Array.isArray(entry) || isObject(entry)
        ? findJsonJournal(entry)
        : null;
    if (result) {
      return result;
    }
  }
  return null;
}

function jsonCandidates(html: string): unknown[] {
  const values: unknown[] = [];
  const scriptPattern =
    /<script[^>]*(?:type=["']application\/json["']|id=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/giu;
  for (const match of html.matchAll(scriptPattern)) {
    try {
      values.push(JSON.parse(decodeEntities(match[1])));
    } catch {
      // The page may contain unrelated, non-JSON scripts.
    }
  }
  return values;
}

function vatFromName(name: string) {
  const normalized = name
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
  const match = normalized.match(/\(([ЂЕАĐEA])\)\s*$/iu);
  return {
    name: match
      ? normalized.slice(0, match.index).trim()
      : normalized,
    vatLabel: match?.[1]?.trim() ?? null,
  };
}

function parseNumericItemLine(
  line: string,
): Omit<ParsedReceiptItem, 'name' | 'vatLabel'> | null {
  const threeAmounts = line.match(threeAmountItemPattern);
  const twoAmounts = threeAmounts ? null : line.match(twoAmountItemPattern);
  if (!threeAmounts && !twoAmounts) {
    return null;
  }

  const unitPriceCents = parseSerbianCents(
    threeAmounts?.[1] ?? twoAmounts?.[1] ?? '',
  );
  const lineTotalCents = parseSerbianCents(
    threeAmounts?.[3] ?? twoAmounts?.[2] ?? '',
  );
  const quantity = threeAmounts
    ? parseSerbianQuantity(threeAmounts[2])
    : unitPriceCents && lineTotalCents
      ? lineTotalCents / unitPriceCents
      : 1;
  if (
    unitPriceCents === null ||
    lineTotalCents === null ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    return null;
  }

  return { quantity, unitPriceCents, lineTotalCents };
}

function parseItems(lines: readonly string[]) {
  let start = lines.findIndex((line) => itemHeadingPattern.test(line));
  if (start < 0) {
    return [];
  }

  while (
    start + 1 < lines.length &&
    (itemHeadingPattern.test(lines[start + 1]) ||
      separatorPattern.test(lines[start + 1]))
  ) {
    start += 1;
  }

  const items: ParsedReceiptItem[] = [];
  let pendingNameLines: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (itemEndPattern.test(line)) {
      break;
    }
    if (separatorPattern.test(line) || itemHeadingPattern.test(line)) {
      continue;
    }

    const numeric = parseNumericItemLine(line);
    if (!numeric) {
      pendingNameLines.push(line);
      continue;
    }

    const parsedName = vatFromName(pendingNameLines.join(' '));
    pendingNameLines = [];
    if (!parsedName.name) {
      continue;
    }
    items.push({ ...numeric, ...parsedName });
  }
  return items;
}

function journalHeader(lines: readonly string[]) {
  const bannerIndex = lines.findIndex((line) =>
    fiscalBannerPattern.test(line),
  );
  if (bannerIndex < 0) {
    return { merchantName: null, taxId: null };
  }

  const itemIndex = lines.findIndex(
    (line, index) =>
      index > bannerIndex && /^(?:артикли|artikli)$/iu.test(line),
  );
  const transactionIndex = lines.findIndex(
    (line, index) =>
      index > bannerIndex &&
      /^-{5,}.+-{5,}$/u.test(line) &&
      !fiscalBannerPattern.test(line),
  );
  const endCandidates = [itemIndex, transactionIndex].filter(
    (index) => index > bannerIndex,
  );
  const end =
    endCandidates.length > 0 ? Math.min(...endCandidates) : lines.length;
  const headerLines = lines
    .slice(bannerIndex + 1, end)
    .filter(
      (line) =>
        !separatorPattern.test(line) &&
        !/^(?:касир|kasir|есир број|esir broj)\s*:/iu.test(line),
    );
  const taxId = /^\d+$/u.test(headerLines[0] ?? '')
    ? headerLines[0]
    : null;
  const merchantName = taxId && headerLines[1] ? headerLines[1] : null;
  return { merchantName, taxId };
}

function paymentTypeAfterTotal(lines: readonly string[]) {
  const totalIndex = lines.findIndex((line) =>
    /^(?:укупан износ|ukupan iznos)\s*:/iu.test(line),
  );
  if (totalIndex < 0) {
    return null;
  }

  for (let index = totalIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^=+$/u.test(line)) {
      break;
    }
    if (separatorPattern.test(line)) {
      continue;
    }
    const match = line.match(/^([^:]+):\s*(.+)$/u);
    if (!match) {
      continue;
    }
    const label = match[1].trim();
    const value = match[2].trim();
    if (
      /^(?:начин плаћања|način plaćanja|nacin placanja|payment type)$/iu.test(
        label,
      )
    ) {
      return paymentLabel(value);
    }
    return paymentLabel(label);
  }
  return null;
}

function offsetForBelgrade(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
) {
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Belgrade',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  let offsetMinutes = 60;
  for (let pass = 0; pass < 2; pass += 1) {
    const actual = new Date(localAsUtc - offsetMinutes * 60_000);
    const parts = Object.fromEntries(
      formatter
        .formatToParts(actual)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)]),
    );
    const formattedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    offsetMinutes = Math.round((formattedAsUtc - actual.getTime()) / 60_000);
  }
  return offsetMinutes;
}

function receiptDateTime(value: string): string | null {
  const match = value.match(
    /(\d{1,2})[./-](\d{1,2})[./-](\d{4})[.,]?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/u,
  );
  if (!match) {
    return null;
  }

  const [, dayText, monthText, yearText, hourText, minuteText, secondText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText ?? '0');
  const offset = offsetForBelgrade(year, month, day, hour, minute, second);
  const sign = offset >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offset);
  const pad = (number: number) => String(number).padStart(2, '0');

  return `${yearText}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;
}

function structuredDateTime(value: string): string | null {
  const normalized = value.trim();
  if (/[zZ]$/u.test(normalized) || /[+-]\d{2}:\d{2}$/u.test(normalized)) {
    const parseable = normalized.replace(
      /\.(\d{3})\d+(?=[zZ]|[+-]\d{2}:\d{2}$)/u,
      '.$1',
    );
    const instant = new Date(parseable);
    if (!Number.isFinite(instant.getTime())) {
      return null;
    }
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Belgrade',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const parts = Object.fromEntries(
      formatter
        .formatToParts(instant)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    );
    return receiptDateTime(
      `${parts.day}.${parts.month}.${parts.year}. ${parts.hour}:${parts.minute}:${parts.second}`,
    );
  }
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/u,
  );
  if (!match) {
    return receiptDateTime(normalized);
  }
  const [, year, month, day, hour, minute, second = '00'] = match;
  return receiptDateTime(
    `${day}.${month}.${year}. ${hour}:${minute}:${second}`,
  );
}

function taxIdValue(value: unknown): string | null {
  if (
    (typeof value === 'string' && value.trim()) ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return String(value).trim();
  }
  return null;
}

function paymentTotal(request: JsonObject | undefined): number | null {
  const payments = firstValue(request, ['payments', 'payment']);
  if (!Array.isArray(payments)) {
    return null;
  }
  const amounts = payments
    .map((entry) =>
      isObject(entry)
        ? parseMoneyValue(firstValue(entry, ['amount', 'totalAmount']))
        : null,
    )
    .filter((amount): amount is number => amount !== null);
  return amounts.length > 0
    ? amounts.reduce((sum, amount) => sum + amount, 0)
    : null;
}

export function parseSerbianCents(value: string): number | null {
  const normalized = value
    .trim()
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  if (!/^-?\d+(?:\.\d{1,2})?$/u.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

export function parseSerbianQuantity(value: string): number {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function validateReceiptUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      allowedHosts.has(url.hostname.toLowerCase()) &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname === '/v/' &&
      Boolean(url.searchParams.get('vl')?.trim())
    );
  } catch {
    return false;
  }
}

export function validateRedirectUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      allowedHosts.has(url.hostname.toLowerCase()) &&
      !url.username &&
      !url.password &&
      !url.port
    );
  } catch {
    return false;
  }
}

export function extractJournalText(html: string): string | null {
  const prePattern = /<pre\b[^>]*>([\s\S]*?)<\/pre>/giu;
  for (const match of html.matchAll(prePattern)) {
    const plainText = stripMarkup(match[1]);
    if (fiscalBannerPattern.test(plainText)) {
      return plainText;
    }
  }

  for (const candidate of jsonCandidates(html)) {
    const journal = findJsonJournal(candidate);
    if (journal) {
      return stripMarkup(journal);
    }
  }

  const journalBlock =
    html.match(
      /<(?:pre|textarea)[^>]*(?:id|class)=["'][^"']*(?:journal|receipt)[^"']*["'][^>]*>([\s\S]*?)<\/(?:pre|textarea)>/iu,
    ) ??
    html.match(
      /<(?:div|section)[^>]*(?:id|class)=["'][^"']*journal[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/iu,
    );
  if (journalBlock?.[1]) {
    return stripMarkup(journalBlock[1]);
  }

  const escapedMatch = html.match(
    /["'](?:journal|journalText|receiptJournal)["']\s*:\s*"((?:\\.|[^"\\])*)"/iu,
  );
  if (escapedMatch?.[1]) {
    try {
      return stripMarkup(JSON.parse(`"${escapedMatch[1]}"`));
    } catch {
      return stripMarkup(escapedMatch[1].replace(/\\n/g, '\n'));
    }
  }
  return null;
}

export function parseJournal(journal: string): ReceiptFields | null {
  const lines = normalizedLines(journal);
  const header = journalHeader(lines);
  const items = parseItems(lines);
  const totalValue = labelValue(lines, [
    'укупан износ',
    'ukupan iznos',
    'total amount',
    'укупно за уплату',
    'ukupno za uplatu',
  ]);
  const totalCents = totalValue ? parseSerbianCents(totalValue) : null;
  const occurredValue = labelValue(lines, [
    'пфр време',
    'pfr vreme',
    'sdc time',
    'време издавања',
    'vreme izdavanja',
  ]);
  const occurredAt = occurredValue ? receiptDateTime(occurredValue) : null;
  const merchantName =
    header.merchantName ??
    labelValue(lines, [
      'назив обвезника',
      'naziv obveznika',
      'име продајног места',
      'ime prodajnog mesta',
      'назив пословног простора',
      'naziv poslovnog prostora',
      'business name',
      'location name',
      'продавац',
    ]);
  const labeledTaxId = labelValue(lines, ['пиб', 'pib', 'tin', 'tax id']);
  const fallbackPayment = labelValue(lines, [
    'начин плаћања',
    'način plaćanja',
    'nacin placanja',
    'payment type',
    'плаћање',
    'plaćanje',
    'placanje',
  ]);
  const paymentType =
    paymentTypeAfterTotal(lines) ??
    (fallbackPayment ? paymentLabel(fallbackPayment) : null);

  if (!merchantName || !occurredAt || totalCents === null || items.length === 0) {
    return null;
  }

  return {
    merchantName,
    taxId:
      header.taxId ??
      labeledTaxId?.match(/\d{8,13}/u)?.[0] ??
      labeledTaxId,
    occurredAt,
    totalCents,
    paymentType,
    items,
  };
}

export function parseStructuredReceipt(value: unknown): ReceiptFields | null {
  if (!isObject(value)) {
    return null;
  }

  const root =
    nestedObject(value, ['data', 'invoice', 'receipt']) ??
    value;
  const request =
    nestedObject(root, ['invoiceRequest', 'request']) ??
    nestedObject(value, ['invoiceRequest', 'request']) ??
    root;
  const result =
    nestedObject(root, ['invoiceResult', 'result']) ??
    nestedObject(value, ['invoiceResult', 'result']);
  const journal = findJsonJournal(value);
  const journalFields = journal ? parseJournal(journal) : null;

  const merchantName =
    firstString(request, ['businessName', 'merchantName', 'sellerName']) ??
    firstString(result, [
      'businessName',
      'locationName',
      'merchantName',
      'sellerName',
    ]) ??
    firstString(root, ['businessName', 'merchantName', 'sellerName']) ??
    journalFields?.merchantName ??
    null;
  const taxId =
    taxIdValue(firstValue(request, ['taxId', 'tin', 'sellerTin'])) ??
    taxIdValue(firstValue(result, ['taxId', 'tin', 'sellerTin'])) ??
    taxIdValue(firstValue(root, ['taxId', 'tin', 'sellerTin'])) ??
    journalFields?.taxId ??
    null;
  const occurredRaw =
    firstString(result, [
      'sdcDateTime',
      'sdcTime',
      'dateTime',
      'issuedAt',
    ]) ??
    firstString(root, ['sdcTime', 'dateTime', 'issuedAt']);
  const occurredAt =
    (occurredRaw ? structuredDateTime(occurredRaw) : null) ??
    journalFields?.occurredAt ??
    null;
  const items = extractStructuredItems(request);
  const effectiveItems = items.length > 0 ? items : journalFields?.items ?? [];
  const totalCents =
    parseMoneyValue(
      firstValue(request, ['totalAmount', 'total', 'invoiceTotal']),
    ) ??
    parseMoneyValue(
      firstValue(result, ['totalAmount', 'total', 'invoiceTotal']),
    ) ??
    paymentTotal(request) ??
    journalFields?.totalCents ??
    null;

  if (!merchantName || !occurredAt || totalCents === null || !effectiveItems.length) {
    return null;
  }

  return {
    merchantName,
    taxId,
    occurredAt,
    totalCents,
    paymentType: extractPayment(request) ?? journalFields?.paymentType ?? null,
    items: effectiveItems,
  };
}

export function parseReceiptHtml(html: string): ReceiptFields | null {
  for (const candidate of jsonCandidates(html)) {
    const parsed = parseStructuredReceipt(candidate);
    if (parsed) {
      return parsed;
    }
  }

  const journal = extractJournalText(html);
  return (
    (journal ? parseJournal(journal) : null) ??
    parseJournal(stripMarkup(html))
  );
}
