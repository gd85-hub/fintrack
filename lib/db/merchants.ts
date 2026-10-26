import {
  findMerchantRenameCollision,
  merchantUsageCounts,
} from '../merchantManagement';
import { merchantAliasesWithIncoming } from '../receipts';
import { supabase } from '../supabase';
import { authenticatedUserId } from './internal';
import type {
  ManagedMerchant,
  Merchant,
  MerchantType,
  MergeMerchantsResult,
  RenameMerchantResult,
} from './types';

type MerchantTypeQueryRow = {
  id: string;
  emoji: string;
  name: string;
  slug: string;
  sort: number;
};

type MerchantQueryRow = {
  id: string;
  name: string;
  aliases: string[];
  created_at: string;
  updated_at: string;
};

type MerchantManagementQueryRow = MerchantQueryRow & {
  user_id: string;
};

type ExpenseMerchantReferenceRow = {
  merchant_id: string | null;
};

type MerchantReferenceRow = {
  id: string;
  merchant_id: string | null;
  user_id: string;
};


export async function listMerchantTypes(): Promise<MerchantType[]> {
  const { data, error } = await supabase
    .from('merchant_types')
    .select('id,emoji,name,slug,sort')
    .eq('active', true)
    .order('sort', { ascending: true });

  if (error) {
    throw error;
  }

  return (data as unknown as MerchantTypeQueryRow[]).map((row) => ({
    id: row.id,
    emoji: row.emoji,
    name: row.name,
    slug: row.slug,
    sort: row.sort,
  }));
}
export async function listMerchants(): Promise<Merchant[]> {
  const { data, error } = await supabase
    .from('merchants')
    .select('id,name,aliases,created_at,updated_at')
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data as unknown as MerchantQueryRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    aliases: row.aliases,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createMerchant(
  name: string,
  aliases: string[] = [],
): Promise<Merchant> {
  const userId = await authenticatedUserId();
  const { data, error } = await supabase
    .from('merchants')
    .insert({
      user_id: userId,
      name: name.trim(),
      type_id: null,
      aliases,
    })
    .select('id,name,aliases,created_at,updated_at')
    .single();

  if (error) {
    throw error;
  }

  const row = data as unknown as MerchantQueryRow;
  return {
    id: row.id,
    name: row.name,
    aliases: row.aliases,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listMerchantsForManagement(): Promise<
  ManagedMerchant[]
> {
  const [merchants, expenseResult] = await Promise.all([
    listMerchants(),
    supabase
      .from('expenses')
      .select('merchant_id')
      .not('merchant_id', 'is', null),
  ]);
  if (expenseResult.error) {
    throw expenseResult.error;
  }

  const counts = merchantUsageCounts(
    merchants.map((merchant) => merchant.id),
    (expenseResult.data as unknown as ExpenseMerchantReferenceRow[]).map(
      (expense) => expense.merchant_id,
    ),
  );

  return merchants.map((merchant) => ({
    ...merchant,
    usageCount: counts.get(merchant.id) ?? 0,
  }));
}

export async function renameMerchant(
  merchantId: string,
  nextName: string,
): Promise<RenameMerchantResult> {
  const trimmedName = nextName.trim();
  if (!trimmedName) {
    throw new Error('Укажите название места.');
  }

  const userId = await authenticatedUserId();
  const { data, error } = await supabase
    .from('merchants')
    .select(
      'id,user_id,name,aliases,created_at,updated_at',
    )
    .eq('user_id', userId);
  if (error) {
    throw error;
  }

  const merchants = data as unknown as MerchantManagementQueryRow[];
  const current = merchants.find(
    (merchant) => merchant.id === merchantId,
  );
  if (!current) {
    throw new Error('Место не найдено.');
  }
  const collision = findMerchantRenameCollision(
    merchants,
    merchantId,
    trimmedName,
  );
  if (collision) {
    return {
      kind: 'collision',
      merchantId: collision.id,
      merchantName: collision.name,
    };
  }

  const aliases = merchantAliasesWithIncoming(
    { aliases: current.aliases, name: trimmedName },
    current.name,
  );
  const { error: updateError } = await supabase
    .from('merchants')
    .update({ aliases, name: trimmedName, type_id: null })
    .eq('id', merchantId)
    .eq('user_id', userId);
  if (updateError) {
    throw updateError;
  }

  return { kind: 'renamed' };
}

export async function deleteMerchant(merchantId: string): Promise<void> {
  const userId = await authenticatedUserId();
  const { error } = await supabase
    .from('merchants')
    .delete()
    .eq('id', merchantId)
    .eq('user_id', userId);
  if (error) {
    throw error;
  }
}

type MerchantReferenceTable =
  | 'expenses'
  | 'receipts'
  | 'subscriptions';

const merchantReferenceTables: readonly MerchantReferenceTable[] = [
  'expenses',
  'receipts',
  'subscriptions',
];

async function loadMerchantReferences(
  table: MerchantReferenceTable,
  sourceIds: readonly string[],
  userId: string,
): Promise<MerchantReferenceRow[]> {
  const { data, error } = await supabase
    .from(table)
    .select('id,merchant_id,user_id')
    .in('merchant_id', [...sourceIds])
    .eq('user_id', userId);
  if (error) {
    throw error;
  }
  return data as unknown as MerchantReferenceRow[];
}

async function restoreMerchantReferences(
  table: MerchantReferenceTable,
  references: readonly MerchantReferenceRow[],
  userId: string,
): Promise<void> {
  const idsByMerchant = new Map<string, string[]>();
  for (const reference of references) {
    if (!reference.merchant_id) {
      continue;
    }
    const ids = idsByMerchant.get(reference.merchant_id) ?? [];
    ids.push(reference.id);
    idsByMerchant.set(reference.merchant_id, ids);
  }

  for (const [merchantId, referenceIds] of idsByMerchant) {
    const { error } = await supabase
      .from(table)
      .update({ merchant_id: merchantId })
      .in('id', referenceIds)
      .eq('user_id', userId);
    if (error) {
      console.error(
        `Unable to restore ${table} after merchant merge:`,
        error,
      );
    }
  }
}

function aliasesAfterMerchantMerge(
  target: MerchantManagementQueryRow,
  sources: readonly MerchantManagementQueryRow[],
): string[] {
  let aliases = [...target.aliases];

  for (const source of sources) {
    for (const spelling of [source.name, ...source.aliases]) {
      aliases = merchantAliasesWithIncoming(
        { aliases, name: target.name },
        spelling,
      );
    }
  }

  return aliases;
}

export async function mergeMerchants(
  targetId: string,
  sourceIds: readonly string[],
): Promise<MergeMerchantsResult> {
  const uniqueSourceIds = [...new Set(sourceIds)].filter(
    (sourceId) => sourceId !== targetId,
  );
  if (!targetId || uniqueSourceIds.length === 0) {
    throw new Error('Выберите целевое место и хотя бы один дубликат.');
  }

  const userId = await authenticatedUserId();
  const merchantIds = [targetId, ...uniqueSourceIds];
  const { data, error } = await supabase
    .from('merchants')
    .select(
      'id,user_id,name,aliases,created_at,updated_at',
    )
    .in('id', merchantIds)
    .eq('user_id', userId);
  if (error) {
    throw error;
  }

  const merchants = data as unknown as MerchantManagementQueryRow[];
  if (
    merchants.length !== merchantIds.length ||
    new Set(merchants.map((merchant) => merchant.id)).size !==
      merchantIds.length
  ) {
    throw new Error('Одно из выбранных мест не найдено.');
  }
  const target = merchants.find((merchant) => merchant.id === targetId);
  const merchantById = new Map(
    merchants.map((merchant) => [merchant.id, merchant]),
  );
  const sources = uniqueSourceIds.map((sourceId) =>
    merchantById.get(sourceId),
  );
  if (!target || sources.some((source) => source === undefined)) {
    throw new Error('Одно из выбранных мест не найдено.');
  }
  const sourceMerchants = sources as MerchantManagementQueryRow[];
  const mergedAliases = aliasesAfterMerchantMerge(
    target,
    sourceMerchants,
  );
  const [expenseReferences, receiptReferences, subscriptionReferences] =
    await Promise.all([
      loadMerchantReferences('expenses', uniqueSourceIds, userId),
      loadMerchantReferences('receipts', uniqueSourceIds, userId),
      loadMerchantReferences('subscriptions', uniqueSourceIds, userId),
    ]);
  const referencesByTable: Record<
    MerchantReferenceTable,
    MerchantReferenceRow[]
  > = {
    expenses: expenseReferences,
    receipts: receiptReferences,
    subscriptions: subscriptionReferences,
  };
  const updatedTables: MerchantReferenceTable[] = [];
  let aliasesUpdated = false;

  try {
    for (const table of merchantReferenceTables) {
      const { error: referenceError } = await supabase
        .from(table)
        .update({ merchant_id: targetId })
        .in('merchant_id', uniqueSourceIds)
        .eq('user_id', userId);
      if (referenceError) {
        throw referenceError;
      }
      updatedTables.push(table);
    }

    const { error: aliasError } = await supabase
      .from('merchants')
      .update({ aliases: mergedAliases, type_id: null })
      .eq('id', targetId)
      .eq('user_id', userId);
    if (aliasError) {
      throw aliasError;
    }
    aliasesUpdated = true;

    const { error: deleteError } = await supabase
      .from('merchants')
      .delete()
      .in('id', uniqueSourceIds)
      .eq('user_id', userId);
    if (deleteError) {
      throw deleteError;
    }

    return { affectedExpenses: expenseReferences.length };
  } catch (mergeError: unknown) {
    if (aliasesUpdated) {
      const { error: aliasRestoreError } = await supabase
        .from('merchants')
        .update({ aliases: target.aliases })
        .eq('id', targetId)
        .eq('user_id', userId);
      if (aliasRestoreError) {
        console.error(
          'Unable to restore target aliases after merchant merge:',
          aliasRestoreError,
        );
      }
    }

    for (const table of [...updatedTables].reverse()) {
      await restoreMerchantReferences(
        table,
        referencesByTable[table],
        userId,
      );
    }
    throw mergeError;
  }
}
