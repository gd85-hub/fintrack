import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import { mergeMerchants } from '../db';
import {
  findMerchantRenameCollision,
  merchantUsageCounts,
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

function updateInEqClient(error: unknown = null) {
  const eq = jest.fn(async () => ({ error }));
  const inFilter = jest.fn(() => ({ eq }));
  const update = jest.fn(() => ({ in: inFilter }));
  return { client: { update }, eq, inFilter, update };
}

function updateEqEqClient(error: unknown = null) {
  const finalEq = jest.fn(async () => ({ error }));
  const firstEq = jest.fn(() => ({ eq: finalEq }));
  const update = jest.fn(() => ({ eq: firstEq }));
  return { client: { update }, finalEq, firstEq, update };
}

function deleteInEqClient(error: unknown = null) {
  const eq = jest.fn(async () => ({ error }));
  const inFilter = jest.fn(() => ({ eq }));
  const deleteRows = jest.fn(() => ({ in: inFilter }));
  return { client: { delete: deleteRows }, deleteRows, eq, inFilter };
}

const target = {
  id: 'target',
  user_id: 'user-1',
  name: 'Target',
  type_id: 'shop',
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

describe('merchant management helpers', () => {
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
    const expenseQuery = selectInEqClient([
      { id: 'expense-a', merchant_id: 'source-a', user_id: 'user-1' },
      { id: 'expense-b', merchant_id: 'source-b', user_id: 'user-1' },
    ]);
    const receiptQuery = selectInEqClient([
      { id: 'receipt-a', merchant_id: 'source-a', user_id: 'user-1' },
    ]);
    const subscriptionQuery = selectInEqClient([
      {
        id: 'subscription-b',
        merchant_id: 'source-b',
        user_id: 'user-1',
      },
    ]);
    const expenseUpdate = updateInEqClient();
    const receiptUpdate = updateInEqClient();
    const subscriptionUpdate = updateInEqClient();
    const aliasUpdate = updateEqEqClient();
    const sourceDelete = deleteInEqClient();

    fromMock
      .mockReturnValueOnce(merchantQuery.client)
      .mockReturnValueOnce(expenseQuery.client)
      .mockReturnValueOnce(receiptQuery.client)
      .mockReturnValueOnce(subscriptionQuery.client)
      .mockReturnValueOnce(expenseUpdate.client)
      .mockReturnValueOnce(receiptUpdate.client)
      .mockReturnValueOnce(subscriptionUpdate.client)
      .mockReturnValueOnce(aliasUpdate.client)
      .mockReturnValueOnce(sourceDelete.client);

    await expect(
      mergeMerchants('target', ['source-a', 'source-b']),
    ).resolves.toEqual({ affectedExpenses: 2 });

    for (const referenceUpdate of [
      expenseUpdate,
      receiptUpdate,
      subscriptionUpdate,
    ]) {
      expect(referenceUpdate.update).toHaveBeenCalledWith({
        merchant_id: 'target',
      });
      expect(referenceUpdate.inFilter).toHaveBeenCalledWith(
        'merchant_id',
        ['source-a', 'source-b'],
      );
      expect(referenceUpdate.eq).toHaveBeenCalledWith('user_id', 'user-1');
    }
    expect(aliasUpdate.update).toHaveBeenCalledWith({
      aliases: [
        'Target alias',
        'Source A',
        'A alias',
        'Source B',
        'B alias',
      ],
    });
    expect(sourceDelete.inFilter).toHaveBeenCalledWith('id', [
      'source-a',
      'source-b',
    ]);
    expect(sourceDelete.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  test('restores already moved references when a later update fails', async () => {
    const merchantQuery = selectInEqClient([target, sourceA]);
    const expenseQuery = selectInEqClient([
      { id: 'expense-a', merchant_id: 'source-a', user_id: 'user-1' },
    ]);
    const receiptQuery = selectInEqClient([
      { id: 'receipt-a', merchant_id: 'source-a', user_id: 'user-1' },
    ]);
    const subscriptionQuery = selectInEqClient([]);
    const expenseUpdate = updateInEqClient();
    const receiptUpdate = updateInEqClient();
    const subscriptionUpdate = updateInEqClient({ message: 'write failed' });
    const receiptRestore = updateInEqClient();
    const expenseRestore = updateInEqClient();

    fromMock
      .mockReturnValueOnce(merchantQuery.client)
      .mockReturnValueOnce(expenseQuery.client)
      .mockReturnValueOnce(receiptQuery.client)
      .mockReturnValueOnce(subscriptionQuery.client)
      .mockReturnValueOnce(expenseUpdate.client)
      .mockReturnValueOnce(receiptUpdate.client)
      .mockReturnValueOnce(subscriptionUpdate.client)
      .mockReturnValueOnce(receiptRestore.client)
      .mockReturnValueOnce(expenseRestore.client);

    await expect(
      mergeMerchants('target', ['source-a']),
    ).rejects.toEqual({ message: 'write failed' });

    expect(receiptRestore.update).toHaveBeenCalledWith({
      merchant_id: 'source-a',
    });
    expect(receiptRestore.inFilter).toHaveBeenCalledWith('id', [
      'receipt-a',
    ]);
    expect(expenseRestore.update).toHaveBeenCalledWith({
      merchant_id: 'source-a',
    });
    expect(expenseRestore.inFilter).toHaveBeenCalledWith('id', [
      'expense-a',
    ]);
  });
});
