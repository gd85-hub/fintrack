import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import {
  findReceiptDuplicates,
  type IncomingReceiptForDuplicates,
} from '../db/receiptDuplicates';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

const getSessionMock = supabase.auth.getSession as unknown as jest.Mock;
const fromMock = supabase.from as unknown as jest.Mock;

type PageOptions = { errorFrom?: number; serverLimit?: number };

// Stateless-by-`from` page loader for fetchAllRows: the same client answers
// every page, and a slice past the end ends the loop.
function pageRange(data: unknown[], options: PageOptions = {}) {
  return jest.fn(async (from: number, to: number) => {
    if (options.errorFrom !== undefined && from >= options.errorFrom) {
      return { data: null, error: { message: `page-${from}` } };
    }
    const requested = to - from + 1;
    const returned = Math.min(requested, options.serverLimit ?? requested);
    return { data: data.slice(from, from + returned), error: null };
  });
}

// expenses: select → eq(user_id) → eq(occurred_on) → not(receipt_id) → order → range
function expensesClient(data: unknown[], options: PageOptions = {}) {
  const range = pageRange(data, options);
  const order = jest.fn(() => ({ range }));
  const notFilter = jest.fn(() => ({ order }));
  const eqDate = jest.fn(() => ({ not: notFilter }));
  const eqUser = jest.fn(() => ({ eq: eqDate }));
  const select = jest.fn(() => ({ eq: eqUser }));
  return { client: { select }, eqDate, eqUser, notFilter, order, range };
}

// receipts: select → eq(user_id) → in(id) → order → range
function receiptsClient(data: unknown[], options: PageOptions = {}) {
  const range = pageRange(data, options);
  const order = jest.fn(() => ({ range }));
  const inFilter = jest.fn(() => ({ order }));
  const eqUser = jest.fn(() => ({ in: inFilter }));
  const select = jest.fn(() => ({ eq: eqUser }));
  return { client: { select }, eqUser, inFilter, order, range };
}

function install(
  expenses: ReturnType<typeof expensesClient>,
  receipts?: ReturnType<typeof receiptsClient>,
) {
  fromMock.mockImplementation((table: unknown) => {
    if (table === 'expenses') {
      return expenses.client;
    }
    if (table === 'receipts' && receipts) {
      return receipts.client;
    }
    throw new Error(`Unexpected from(${String(table)})`);
  });
}

function expense(receiptId: string, occurredOn = '2026-11-10') {
  return { id: `e-${receiptId}`, receipt_id: receiptId, occurred_on: occurredOn };
}

function receipt(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    source: 'fiscal_qr',
    merchant_id: 'merchant-1',
    merchant_label: 'UNIVEREXPORT 1369800',
    tax_id: '101692669',
    occurred_at: '2026-11-10T19:30:00+02:00',
    total: '1234.56',
    currency: 'RSD',
    merchant: { name: 'UNIVEREXPORT' },
    ...overrides,
  };
}

const incomingOcr: IncomingReceiptForDuplicates = {
  totalCents: 123456,
  currency: 'RSD',
  occurredOn: '2026-11-10',
  occurredAt: null,
  merchantName: 'Univerexport',
};

const incomingQr: IncomingReceiptForDuplicates = {
  totalCents: 123456,
  currency: 'RSD',
  occurredOn: '2026-11-10',
  occurredAt: '2026-11-10T19:30:00+02:00',
  merchantName: 'UNIVEREXPORT',
  taxId: '101692669',
};

describe('findReceiptDuplicates', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    fromMock.mockReset();
    getSessionMock.mockImplementation(async () => ({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    }));
  });

  test('matches a saved QR receipt against an incoming OCR receipt', async () => {
    const expenses = expensesClient([expense('r1')]);
    const receipts = receiptsClient([receipt()]);
    install(expenses, receipts);

    const result = await findReceiptDuplicates(incomingOcr);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      receiptId: 'r1',
      totalCents: 123456,
      currency: 'RSD',
      occurredOn: '2026-11-10',
    });
    expect(result[0].match.isProbableDuplicate).toBe(true);
    // Date-only OCR vs QR is probable, not strong.
    expect(result[0].match.confidence).toBe('probable');
    // Account scoping is explicit on both queries.
    expect(expenses.eqUser).toHaveBeenCalledWith('user_id', 'user-1');
    expect(expenses.eqDate).toHaveBeenCalledWith('occurred_on', '2026-11-10');
    expect(receipts.eqUser).toHaveBeenCalledWith('user_id', 'user-1');
  });

  test('matches a saved OCR receipt without a timestamp against an incoming QR receipt', async () => {
    const expenses = expensesClient([expense('r1')]);
    const receipts = receiptsClient([
      receipt({ source: 'ocr_photo', occurred_at: null, tax_id: null }),
    ]);
    install(expenses, receipts);

    const result = await findReceiptDuplicates(incomingQr);

    expect(result).toHaveLength(1);
    expect(result[0].match.confidence).toBe('probable');
  });

  test('dates a candidate from expenses.occurred_on, not the receipt timestamp or raw_json', async () => {
    // The receipt's own timestamp crosses midnight in UTC, and its raw_json is
    // irrelevant (never queried): the saved local date comes from the expense.
    const expenses = expensesClient([expense('r1', '2026-03-15')]);
    const receipts = receiptsClient([
      receipt({
        source: 'ocr_photo',
        occurred_at: '2026-03-15T00:15:00+01:00',
        tax_id: null,
      }),
    ]);
    install(expenses, receipts);

    const result = await findReceiptDuplicates({
      ...incomingOcr,
      occurredOn: '2026-03-15',
    });

    expect(result).toHaveLength(1);
    expect(result[0].occurredOn).toBe('2026-03-15');
  });

  test('returns a receipt with multiple expense rows only once', async () => {
    const expenses = expensesClient([expense('r1'), expense('r1')]);
    const receipts = receiptsClient([receipt()]);
    install(expenses, receipts);

    const result = await findReceiptDuplicates(incomingOcr);

    expect(result).toHaveLength(1);
    expect(receipts.inFilter).toHaveBeenCalledWith('id', ['r1']);
  });

  test('matches on normalized merchant name when merchant ids differ or are missing', async () => {
    const expenses = expensesClient([expense('r1')]);
    const receipts = receiptsClient([
      receipt({ merchant_id: 'merchant-1', merchant: { name: 'UNIVEREXPORT' } }),
    ]);
    install(expenses, receipts);

    // Incoming has no merchant id yet; only the normalized name agrees.
    const result = await findReceiptDuplicates({
      ...incomingOcr,
      merchantId: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0].match.evidence.merchantId).toBe(false);
    expect(result[0].match.evidence.merchantName).toBe(true);
  });

  test('returns nothing when the account has no receipts on that date', async () => {
    const expenses = expensesClient([]);
    install(expenses);

    const result = await findReceiptDuplicates(incomingOcr);

    expect(result).toEqual([]);
    expect(expenses.eqUser).toHaveBeenCalledWith('user_id', 'user-1');
  });

  test('finds a matching receipt that lands on a later candidate page', async () => {
    const expenses = expensesClient([expense('r1'), expense('r2')]);
    // Server caps receipts at one row per page; the match is only on page two.
    const receipts = receiptsClient(
      [
        receipt({ id: 'r1', total: '9999.99' }),
        receipt({ id: 'r2' }),
      ],
      { serverLimit: 1 },
    );
    install(expenses, receipts);

    const result = await findReceiptDuplicates(incomingOcr);

    expect(result).toHaveLength(1);
    expect(result[0].receiptId).toBe('r2');
    expect(receipts.range.mock.calls.length).toBeGreaterThan(1);
  });

  test('propagates a query failure instead of reporting no duplicates', async () => {
    const expenses = expensesClient([expense('r1')], { errorFrom: 0 });
    install(expenses);

    await expect(findReceiptDuplicates(incomingOcr)).rejects.toMatchObject({
      message: 'page-0',
    });
  });

  test('returns an empty result for an invalid incoming date without querying', async () => {
    const result = await findReceiptDuplicates({
      ...incomingOcr,
      occurredOn: '2026-13-40',
    });

    expect(result).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  test('does not match a receipt with a different total', async () => {
    const expenses = expensesClient([expense('r1')]);
    const receipts = receiptsClient([receipt({ total: '9999.99' })]);
    install(expenses, receipts);

    await expect(findReceiptDuplicates(incomingOcr)).resolves.toEqual([]);
  });

  test('does not match a receipt with a different currency', async () => {
    const expenses = expensesClient([expense('r1')]);
    const receipts = receiptsClient([receipt({ currency: 'EUR' })]);
    install(expenses, receipts);

    await expect(findReceiptDuplicates(incomingOcr)).resolves.toEqual([]);
  });

  test('does not match a receipt with a different merchant', async () => {
    const expenses = expensesClient([expense('r1')]);
    const receipts = receiptsClient([
      receipt({ merchant_id: 'merchant-2', merchant: { name: 'MAXI' } }),
    ]);
    install(expenses, receipts);

    await expect(
      findReceiptDuplicates({ ...incomingOcr, merchantId: null }),
    ).resolves.toEqual([]);
  });

  test('matches a custom currency on both sides', async () => {
    const expenses = expensesClient([expense('r1')]);
    const receipts = receiptsClient([
      receipt({ currency: 'THB', tax_id: null }),
    ]);
    install(expenses, receipts);

    const result = await findReceiptDuplicates({
      ...incomingOcr,
      currency: 'THB',
    });

    expect(result).toHaveLength(1);
    expect(result[0].currency).toBe('THB');
  });
});
