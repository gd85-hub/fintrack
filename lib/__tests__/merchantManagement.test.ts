import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import {
  createMerchant,
  listMerchantsForManagement,
  MerchantAlreadyExistsError,
  mergeMerchants,
} from '../db';
import {
  findMerchantNameCollision,
  findMerchantRenameCollision,
  merchantUsageCounts,
  requireMerchantName,
} from '../merchantManagement';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

const getSessionMock = supabase.auth.getSession as unknown as jest.Mock;
const fromMock = supabase.from as unknown as jest.Mock;

function selectInEqClient(data: unknown[]) {
  const eq = jest.fn(async () => ({ data, error: null }));
  const inFilter = jest.fn(() => ({ eq }));
  const select = jest.fn(() => ({ in: inFilter }));
  return { client: { select }, eq, inFilter, select };
}

type PageOptions = { errorFrom?: number; serverLimit?: number };

// A page loader for fetchAllRows: stateless in `from`, so one client answers
// every page; a slice past the end returns [] and ends the loop. serverLimit
// caps each page below the requested range (forcing multiple pages); errorFrom
// fails from that offset onward.
function pageRange(data: unknown[], options: PageOptions = {}) {
  return jest.fn(async (from: number, to: number) => {
    if (options.errorFrom !== undefined && from >= options.errorFrom) {
      return { data: null, error: { message: `read-page-${from}` } };
    }
    const requested = to - from + 1;
    const returned = Math.min(requested, options.serverLimit ?? requested);
    return { data: data.slice(from, from + returned), error: null };
  });
}

// Paginated management usage read: select → eq → not → order → range.
function pagedMerchantCountClient(data: unknown[], options: PageOptions = {}) {
  const range = pageRange(data, options);
  const order = jest.fn(() => ({ range }));
  const notFilter = jest.fn(() => ({ order }));
  const eq = jest.fn(() => ({ not: notFilter }));
  const select = jest.fn(() => ({ eq }));
  return { client: { select }, eq, notFilter, order, range, select };
}

// Combined reference-table client: paginated read (select → in → eq → order →
// range) plus update (update → in → eq), so one memoized client serves both the
// snapshot read and its re-point/restore writes regardless of call order.
function refTableClient(
  data: unknown[],
  options: PageOptions & { updateError?: unknown } = {},
) {
  const range = pageRange(data, options);
  const readOrder = jest.fn(() => ({ range }));
  const readEq = jest.fn(() => ({ order: readOrder }));
  const readIn = jest.fn(() => ({ eq: readEq }));
  const select = jest.fn(() => ({ in: readIn }));
  const updateEq = jest.fn(async () => ({ error: options.updateError ?? null }));
  const updateIn = jest.fn(() => ({ eq: updateEq }));
  const update = jest.fn(() => ({ in: updateIn }));
  return { client: { select, update }, range, update, updateEq, updateIn };
}

// merchants table for mergeMerchants mutations: alias update (update → eq → eq)
// and source delete (delete → in → eq). The snapshot read is supplied
// separately as the first from() call.
function merchantsMutationClient(
  options: { aliasError?: unknown; deleteError?: unknown } = {},
) {
  const aliasSecondEq = jest.fn(async () => ({ error: options.aliasError ?? null }));
  const aliasFirstEq = jest.fn(() => ({ eq: aliasSecondEq }));
  const update = jest.fn(() => ({ eq: aliasFirstEq }));
  const deleteEq = jest.fn(async () => ({ error: options.deleteError ?? null }));
  const deleteIn = jest.fn(() => ({ eq: deleteEq }));
  const deleteRows = jest.fn(() => ({ in: deleteIn }));
  return {
    client: { delete: deleteRows, update },
    deleteEq,
    deleteIn,
    deleteRows,
    update,
  };
}

function installTables(map: Record<string, unknown>) {
  fromMock.mockImplementation((table: unknown) => {
    const client = map[table as string];
    if (!client) {
      throw new Error(`Unexpected from(${String(table)})`);
    }
    return client;
  });
}

// listMerchants: select → eq('active', true) → order('name').
function listMerchantsClient(data: unknown[]) {
  const order = jest.fn(async () => ({ data, error: null }));
  const activeEq = jest.fn(() => ({ order }));
  const select = jest.fn(() => ({ eq: activeEq }));
  return { client: { select }, activeEq, order, select };
}

const target = {
  id: 'target',
  user_id: 'user-1',
  name: 'Target',
  aliases: ['Target alias'],
  created_at: '2026-08-01T10:00:00Z',
  updated_at: '2026-08-01T10:00:00Z',
};
const sourceA = {
  ...target,
  id: 'source-a',
  name: 'Source A',
  aliases: ['A alias'],
};
const sourceB = {
  ...target,
  id: 'source-b',
  name: 'Source B',
  aliases: ['B alias'],
};

describe('requireMerchantName', () => {
  test('returns a clean name unchanged', () => {
    expect(requireMerchantName('LIDL')).toBe('LIDL');
  });

  test('trims surrounding whitespace', () => {
    expect(requireMerchantName('  LIDL  ')).toBe('LIDL');
  });

  test('preserves a Unicode name after trimming', () => {
    expect(requireMerchantName('  Кафе Москва  ')).toBe('Кафе Москва');
  });

  test('rejects an empty string', () => {
    expect(() => requireMerchantName('')).toThrow('Укажите название места.');
  });

  test('rejects a whitespace-only name', () => {
    expect(() => requireMerchantName('   ')).toThrow(
      'Укажите название места.',
    );
  });

  test('rejects tabs and newlines only', () => {
    expect(() => requireMerchantName('\t\n')).toThrow(
      'Укажите название места.',
    );
  });
});

describe('merchant management helpers', () => {
  test('finds a normalized create collision across the loaded list', () => {
    const merchants = [
      { id: 'a', name: 'LIDL' },
      { id: 'b', name: 'Кафе Москва' },
    ];

    expect(findMerchantNameCollision(merchants, 'LIDL')).toEqual(
      merchants[0],
    );
    expect(findMerchantNameCollision(merchants, 'lidl')).toEqual(
      merchants[0],
    );
    expect(findMerchantNameCollision(merchants, '  LIDL  ')).toEqual(
      merchants[0],
    );
    expect(findMerchantNameCollision(merchants, ' кафе москва ')).toEqual(
      merchants[1],
    );
    expect(findMerchantNameCollision(merchants, 'Maxi')).toBeNull();
    expect(findMerchantNameCollision(merchants, '   ')).toBeNull();
  });

  test('excludes a given merchant id from create collisions', () => {
    const merchants = [{ id: 'a', name: 'LIDL' }];

    expect(findMerchantNameCollision(merchants, 'lidl', 'a')).toBeNull();
    expect(findMerchantNameCollision(merchants, 'lidl', 'other')).toEqual(
      merchants[0],
    );
  });

  test('finds a normalized rename collision but ignores the same row', () => {
    const merchants = [
      { id: 'current', name: 'Другое место' },
      { id: 'existing', name: 'LIDL' },
    ];

    expect(
      findMerchantRenameCollision(merchants, 'current', 'лидл'),
    ).toEqual(merchants[1]);
    expect(
      findMerchantRenameCollision(merchants, 'existing', 'Lidl'),
    ).toBeNull();
  });

  test('counts only expense references for known merchants', () => {
    const counts = merchantUsageCounts(
      ['first', 'second', 'unused'],
      ['first', 'second', 'first', null, 'missing'],
    );

    expect(Object.fromEntries(counts)).toEqual({
      first: 2,
      second: 1,
      unused: 0,
    });
  });
});

describe('createMerchant', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    fromMock.mockReset();
    getSessionMock.mockImplementation(async () => ({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    }));
  });

  test('creates a merchant from a name and clears its legacy type', async () => {
    const row = {
      id: 'merchant-new',
      name: 'Новое место',
      aliases: [],
      created_at: '2026-09-22T10:00:00Z',
      updated_at: '2026-09-22T10:00:00Z',
    };
    const single = jest.fn(async () => ({ data: row, error: null }));
    const select = jest.fn(() => ({ single }));
    const insert = jest.fn(() => ({ select }));
    fromMock.mockReturnValueOnce({ insert });

    await expect(createMerchant('  Новое место  ')).resolves.toEqual({
      id: 'merchant-new',
      name: 'Новое место',
      aliases: [],
      createdAt: '2026-09-22T10:00:00Z',
      updatedAt: '2026-09-22T10:00:00Z',
    });
    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      name: 'Новое место',
      type_id: null,
      aliases: [],
    });
  });

  test('maps a unique-violation (23505) to MerchantAlreadyExistsError', async () => {
    const single = jest.fn(async () => ({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    }));
    const select = jest.fn(() => ({ single }));
    const insert = jest.fn(() => ({ select }));
    fromMock.mockReturnValue({ insert });

    await expect(createMerchant('  LIDL  ')).rejects.toBeInstanceOf(
      MerchantAlreadyExistsError,
    );
    await expect(createMerchant('  LIDL  ')).rejects.toMatchObject({
      merchantName: 'LIDL',
    });
  });

  test('propagates a non-duplicate database error unchanged', async () => {
    const dbError = { code: '42501', message: 'permission denied' };
    const single = jest.fn(async () => ({ data: null, error: dbError }));
    const select = jest.fn(() => ({ single }));
    const insert = jest.fn(() => ({ select }));
    fromMock.mockReturnValue({ insert });

    await expect(createMerchant('LIDL')).rejects.toBe(dbError);
  });
});

describe('mergeMerchants', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    fromMock.mockReset();
    getSessionMock.mockImplementation(async () => ({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    }));
  });

  test('re-points every reference, merges aliases, and deletes sources', async () => {
    const merchantQuery = selectInEqClient([target, sourceA, sourceB]);
    const expenses = refTableClient([
      { id: 'expense-a', merchant_id: 'source-a', user_id: 'user-1' },
      { id: 'expense-b', merchant_id: 'source-b', user_id: 'user-1' },
    ]);
    const receipts = refTableClient([
      { id: 'receipt-a', merchant_id: 'source-a', user_id: 'user-1' },
    ]);
    const subscriptions = refTableClient([
      { id: 'subscription-b', merchant_id: 'source-b', user_id: 'user-1' },
    ]);
    const merchants = merchantsMutationClient();
    installTables({
      merchants: merchants.client,
      expenses: expenses.client,
      receipts: receipts.client,
      subscriptions: subscriptions.client,
    });
    // The merchant snapshot is the first from() call; alias update and source
    // delete fall through to the dispatch above.
    fromMock.mockReturnValueOnce(merchantQuery.client);

    await expect(
      mergeMerchants('target', ['source-a', 'source-b']),
    ).resolves.toEqual({ affectedExpenses: 2 });

    for (const reference of [expenses, receipts, subscriptions]) {
      expect(reference.update).toHaveBeenCalledWith({
        merchant_id: 'target',
      });
      expect(reference.updateIn).toHaveBeenCalledWith('merchant_id', [
        'source-a',
        'source-b',
      ]);
      expect(reference.updateEq).toHaveBeenCalledWith('user_id', 'user-1');
    }
    expect(merchants.update).toHaveBeenCalledWith({
      aliases: [
        'Target alias',
        'Source A',
        'A alias',
        'Source B',
        'B alias',
      ],
      type_id: null,
    });
    expect(merchants.deleteIn).toHaveBeenCalledWith('id', [
      'source-a',
      'source-b',
    ]);
    expect(merchants.deleteEq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  test('counts affected expenses across every reference page', async () => {
    const merchantQuery = selectInEqClient([target, sourceA]);
    // Server caps reference pages at two rows; the third expense only appears
    // on a later page and must still be counted and re-pointed.
    const expenses = refTableClient(
      [
        { id: 'expense-a', merchant_id: 'source-a', user_id: 'user-1' },
        { id: 'expense-b', merchant_id: 'source-a', user_id: 'user-1' },
        { id: 'expense-c', merchant_id: 'source-a', user_id: 'user-1' },
      ],
      { serverLimit: 2 },
    );
    const receipts = refTableClient([]);
    const subscriptions = refTableClient([]);
    const merchants = merchantsMutationClient();
    installTables({
      merchants: merchants.client,
      expenses: expenses.client,
      receipts: receipts.client,
      subscriptions: subscriptions.client,
    });
    fromMock.mockReturnValueOnce(merchantQuery.client);

    await expect(
      mergeMerchants('target', ['source-a']),
    ).resolves.toEqual({ affectedExpenses: 3 });
    expect(expenses.range.mock.calls.length).toBeGreaterThan(1);
  });

  test('aborts before any mutation when a reference page fails', async () => {
    const merchantQuery = selectInEqClient([target, sourceA]);
    const expenses = refTableClient(
      [
        { id: 'expense-a', merchant_id: 'source-a', user_id: 'user-1' },
        { id: 'expense-b', merchant_id: 'source-a', user_id: 'user-1' },
        { id: 'expense-c', merchant_id: 'source-a', user_id: 'user-1' },
      ],
      { serverLimit: 2, errorFrom: 2 },
    );
    const receipts = refTableClient([]);
    const subscriptions = refTableClient([]);
    const merchants = merchantsMutationClient();
    installTables({
      merchants: merchants.client,
      expenses: expenses.client,
      receipts: receipts.client,
      subscriptions: subscriptions.client,
    });
    fromMock.mockReturnValueOnce(merchantQuery.client);

    await expect(
      mergeMerchants('target', ['source-a']),
    ).rejects.toMatchObject({ message: 'read-page-2' });
    expect(expenses.update).not.toHaveBeenCalled();
    expect(receipts.update).not.toHaveBeenCalled();
    expect(subscriptions.update).not.toHaveBeenCalled();
    expect(merchants.update).not.toHaveBeenCalled();
    expect(merchants.deleteRows).not.toHaveBeenCalled();
  });

  test('restores already moved references when a later update fails', async () => {
    const merchantQuery = selectInEqClient([target, sourceA]);
    const expenses = refTableClient([
      { id: 'expense-a', merchant_id: 'source-a', user_id: 'user-1' },
    ]);
    const receipts = refTableClient([
      { id: 'receipt-a', merchant_id: 'source-a', user_id: 'user-1' },
    ]);
    const subscriptions = refTableClient([], {
      updateError: { message: 'write failed' },
    });
    const merchants = merchantsMutationClient();
    installTables({
      merchants: merchants.client,
      expenses: expenses.client,
      receipts: receipts.client,
      subscriptions: subscriptions.client,
    });
    fromMock.mockReturnValueOnce(merchantQuery.client);

    await expect(
      mergeMerchants('target', ['source-a']),
    ).rejects.toEqual({ message: 'write failed' });

    // Updated tables are restored from the complete snapshot.
    expect(receipts.update).toHaveBeenCalledWith({
      merchant_id: 'source-a',
    });
    expect(receipts.updateIn).toHaveBeenCalledWith('id', ['receipt-a']);
    expect(expenses.update).toHaveBeenCalledWith({
      merchant_id: 'source-a',
    });
    expect(expenses.updateIn).toHaveBeenCalledWith('id', ['expense-a']);
  });
});

describe('listMerchantsForManagement', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    fromMock.mockReset();
    getSessionMock.mockImplementation(async () => ({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    }));
  });

  test('counts merchant usage across every expense page', async () => {
    const merchantsList = listMerchantsClient([
      {
        id: 'merchant-1',
        name: 'LIDL',
        aliases: [],
        created_at: '2026-08-01T10:00:00Z',
        updated_at: '2026-08-01T10:00:00Z',
      },
    ]);
    // Server caps expense pages at two rows; the third reference only appears on
    // a later page and must still be counted.
    const expenses = pagedMerchantCountClient(
      [
        { id: 'expense-a', merchant_id: 'merchant-1' },
        { id: 'expense-b', merchant_id: 'merchant-1' },
        { id: 'expense-c', merchant_id: 'merchant-1' },
      ],
      { serverLimit: 2 },
    );
    installTables({
      merchants: merchantsList.client,
      expenses: expenses.client,
    });

    const result = await listMerchantsForManagement();

    expect(result[0]).toMatchObject({ id: 'merchant-1', usageCount: 3 });
    expect(expenses.range.mock.calls.length).toBeGreaterThan(1);
    expect(expenses.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(expenses.order).toHaveBeenCalledWith('id', { ascending: true });
  });
});
