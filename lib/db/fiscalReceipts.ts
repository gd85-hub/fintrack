import { parseLocalISO } from '../dates';
import { ratesForExpense } from '../fx';
import {
  centsToDecimal,
  decimalToCents,
  distributeCents,
  isCurrency,
  normalizeCurrencyCode,
} from '../money';
import {
  merchantAliasesWithIncoming,
  normalizeMerchantName,
  parsedReceiptDate,
  type ParsedReceipt,
} from '../receipts';
import { supabase } from '../supabase';
import {
  authenticatedUserId,
  bumpMerchantUsage,
  EXPENSE_SELECT,
  mapExpense,
  receiptExpenseAmounts,
  type ExpenseQueryRow,
} from './internal';
import type {
  Expense,
  FiscalReceiptEditDraft,
  FiscalReceiptEditReceipt,
  FiscalReceiptMerchantInput,
  SaveFiscalReceiptInput,
  UpdateFiscalReceiptExpenseInput,
  UpdateFiscalReceiptInput,
  UpdateFiscalReceiptResult,
} from './types';

export { receiptExpenseAmounts };

type ReceiptForEditQueryRow = {
  id: string;
  merchant_id: string | null;
  merchant_label: string | null;
  total: number | string | null;
  currency: string | null;
  payment_type: string | null;
  raw_json: unknown;
  merchant: {
    name: string;
  } | null;
};

type ReceiptMutationSnapshotRow = {
  id: string;
  user_id: string;
  source: string;
  merchant_id: string | null;
  merchant_label: string | null;
  tax_id: string | null;
  occurred_at: string | null;
  total: number | string | null;
  currency: string | null;
  payment_type: string | null;
  raw_json: unknown;
  parsed_ok: boolean;
  created_at: string;
};

type ExpenseMutationSnapshotRow = {
  id: string;
  user_id: string;
  occurred_on: string;
  occurred_at: string | null;
  description: string;
  raw_name: string | null;
  category_id: string;
  merchant_id: string | null;
  original_amount: number | string;
  original_currency: string;
  amount_rsd: number | string | null;
  amount_usd: number | string | null;
  amount_eur: number | string | null;
  fx_rate_date: string | null;
  note: string | null;
  source: string;
  receipt_id: string | null;
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
};


export function buildFiscalReceiptEditDraft(
  receipt: FiscalReceiptEditReceipt,
  expenses: readonly Expense[],
  manualRsdTotalCents: number | null = null,
): FiscalReceiptEditDraft {
  const firstExpense = expenses[0];
  if (!firstExpense) {
    throw new Error('В покупке нет позиций для редактирования.');
  }
  if (!parseLocalISO(firstExpense.occurredOn)) {
    throw new Error('Дата покупки некорректна.');
  }
  if (
    expenses.some(
      (expense) =>
        expense.receiptId !== receipt.id ||
        expense.occurredOn !== firstExpense.occurredOn,
    )
  ) {
    throw new Error('Позиции покупки содержат несогласованные данные.');
  }

  const currency = receipt.currency || firstExpense.originalCurrency;
  return {
    receiptId: receipt.id,
    merchantId: receipt.merchantId,
    merchantName: receipt.merchantName,
    merchantLabel: receipt.merchantLabel,
    occurredOn: firstExpense.occurredOn,
    totalCents: receipt.totalCents,
    currency,
    paymentType: receipt.paymentType,
    ...(!isCurrency(currency) ? { manualRsdTotalCents } : {}),
    items: expenses.map((expense) => ({
      id: expense.id,
      amountCents: expense.originalAmountCents,
      categoryId: expense.categoryId,
      description: expense.description,
      rawName: expense.rawName?.trim() || expense.description,
    })),
  };
}

export async function getFiscalReceiptForEdit(
  receiptId: string,
): Promise<FiscalReceiptEditDraft | null> {
  const { data: receiptData, error: receiptError } = await supabase
    .from('receipts')
    .select(
      'id,merchant_id,merchant_label,total,currency,payment_type,raw_json,merchant:merchants!receipts_merchant_id_fkey(name)',
    )
    .eq('id', receiptId)
    .maybeSingle();

  if (receiptError) {
    throw receiptError;
  }
  if (!receiptData) {
    return null;
  }

  const { data: expenseData, error: expensesError } = await supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('receipt_id', receiptId)
    .order('created_at', { ascending: true });

  if (expensesError) {
    throw expensesError;
  }

  const expenseRows = expenseData as unknown as ExpenseQueryRow[];
  const expenses = expenseRows.map(mapExpense);
  if (expenses.length === 0) {
    return null;
  }

  const receipt = receiptData as unknown as ReceiptForEditQueryRow;
  const merchantLabel =
    receipt.merchant_label?.trim() ||
    rawReceiptMerchantLabel(receipt.raw_json) ||
    receipt.merchant?.name ||
    '';
  const currency =
    receipt.currency ?? expenseRows[0]?.original_currency ?? '';
  const manualRsdTotalCents =
    !isCurrency(currency) &&
    expenseRows.every((expense) => expense.amount_rsd !== null)
      ? expenseRows.reduce(
          (total, expense) => total + decimalToCents(expense.amount_rsd),
          0,
        )
      : null;
  return buildFiscalReceiptEditDraft(
    {
      id: receipt.id,
      merchantId: receipt.merchant_id,
      merchantName: receipt.merchant?.name ?? '',
      merchantLabel,
      totalCents:
        receipt.total === null
          ? expenses.reduce(
              (total, expense) => total + expense.originalAmountCents,
              0,
            )
          : decimalToCents(receipt.total),
      currency,
      paymentType: receipt.payment_type,
    },
    expenses,
    manualRsdTotalCents,
  );
}
function receiptPayloadWithoutRaw(receipt: ParsedReceipt) {
  const { raw: _raw, ...payload } = receipt;
  return payload;
}


async function learnedAliasesForMerchant(
  merchantId: string,
  incomingName: string,
) {
  const { data, error } = await supabase
    .from('merchants')
    .select('name,aliases')
    .eq('id', merchantId)
    .single();
  if (error) {
    throw error;
  }
  const merchant = data as unknown as {
    aliases: string[];
    name: string;
  };
  const learnedAliases = merchantAliasesWithIncoming(
    merchant,
    incomingName,
  );
  return learnedAliases.length === merchant.aliases.length
    ? null
    : learnedAliases;
}

export async function saveFiscalReceipt(
  input: SaveFiscalReceiptInput,
): Promise<void> {
  if (input.expenses.length === 0) {
    throw new Error('Выберите хотя бы одну позицию чека.');
  }

  const occurredOn = parsedReceiptDate(input.receipt);
  const userId = await authenticatedUserId();
  const source = input.receipt.source ?? 'fiscal_qr';
  const currency = normalizeCurrencyCode(input.receipt.currency);
  if (!currency) {
    throw new Error('Укажите трёхбуквенный код валюты.');
  }
  const merchantLabel =
    input.receipt.merchantLabel?.trim() ||
    input.receipt.merchantName.trim();
  const rates = isCurrency(currency)
    ? await ratesForExpense(occurredOn)
    : null;
  const manualRsdShares =
    !isCurrency(currency) && input.manualRsdTotalCents !== null &&
    input.manualRsdTotalCents !== undefined
      ? distributeCents(
          input.manualRsdTotalCents,
          input.expenses.map((expense) => expense.amountCents),
        )
      : input.expenses.map(() => null);
  let merchantId: string;
  let learnedAliases: string[] | null = null;

  if ('existingId' in input.merchant) {
    merchantId = input.merchant.existingId;
    learnedAliases = await learnedAliasesForMerchant(
      merchantId,
      input.receipt.merchantName,
    );
  } else {
    const merchantName = input.merchant.name.trim();
    if (!merchantName) {
      throw new Error('Укажите название места.');
    }
    const aliases =
      learnedAliasesWithNormalizedIncoming(
        { aliases: [], name: merchantName },
        input.receipt.merchantName,
      ) ?? [];
    const { data, error } = await supabase
      .from('merchants')
      .insert({
        user_id: userId,
        name: merchantName,
        type_id: null,
        aliases,
      })
      .select('id')
      .single();
    if (error) {
      throw error;
    }
    const row = data as unknown as { id: string };
    merchantId = row.id;
  }

  let receiptId: string | null = null;

  try {
    const { data, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        user_id: userId,
        source,
        merchant_id: merchantId,
        merchant_label: merchantLabel || null,
        tax_id: input.receipt.taxId,
        occurred_at: input.receipt.occurredAt,
        total: centsToDecimal(input.receipt.totalCents),
        currency,
        payment_type: input.receipt.paymentType,
        raw_json: receiptPayloadWithoutRaw({
          ...input.receipt,
          currency,
        }),
        parsed_ok: true,
      })
      .select('id')
      .single();
    if (receiptError) {
      throw receiptError;
    }
    const receiptRow = data as unknown as { id: string };
    receiptId = receiptRow.id;

    const expenseRows = input.expenses.map((expense, index) => {
      const converted = receiptExpenseAmounts(
        expense.amountCents,
        currency,
        rates,
        manualRsdShares[index] ?? null,
      );
      return {
        user_id: userId,
        occurred_on: occurredOn,
        occurred_at: input.receipt.occurredAt,
        description: expense.description.trim(),
        raw_name: expense.rawName.trim() || null,
        category_id: expense.categoryId,
        merchant_id: merchantId,
        original_amount: centsToDecimal(expense.amountCents),
        original_currency: currency,
        ...converted,
        note: null,
        source,
        receipt_id: receiptId,
      };
    });
    const { error: expensesError } = await supabase
      .from('expenses')
      .insert(expenseRows);
    if (expensesError) {
      throw expensesError;
    }
    if (learnedAliases) {
      const { error: aliasError } = await supabase
        .from('merchants')
        .update({ aliases: learnedAliases })
        .eq('id', merchantId);
      if (aliasError) {
        throw aliasError;
      }
    }
  } catch (error: unknown) {
    if (receiptId) {
      const { error: cleanupExpensesError } = await supabase
        .from('expenses')
        .delete()
        .eq('receipt_id', receiptId);
      if (cleanupExpensesError) {
        console.error(
          'Unable to clean up receipt expenses:',
          cleanupExpensesError.message,
        );
      }
      const { error: cleanupReceiptError } = await supabase
        .from('receipts')
        .delete()
        .eq('id', receiptId);
      if (cleanupReceiptError) {
        console.error(
          'Unable to clean up receipt:',
          cleanupReceiptError.message,
        );
      }
    }
    throw error;
  }

  if ('existingId' in input.merchant && !learnedAliases) {
    await bumpMerchantUsage(merchantId);
  }
}

const RECEIPT_MUTATION_SELECT =
  'id,user_id,source,merchant_id,merchant_label,tax_id,occurred_at,total,currency,payment_type,raw_json,parsed_ok,created_at';
const EXPENSE_MUTATION_SELECT =
  'id,user_id,occurred_on,occurred_at,description,raw_name,category_id,merchant_id,original_amount,original_currency,amount_rsd,amount_usd,amount_eur,fx_rate_date,note,source,receipt_id,is_recurring,created_at,updated_at';

type FiscalReceiptMutationSnapshot = {
  receipt: ReceiptMutationSnapshotRow;
  expenses: ExpenseMutationSnapshotRow[];
};

type ResolvedReceiptEditMerchant = {
  created: boolean;
  id: string;
  learnedAliases: string[] | null;
  originalAliases: string[] | null;
};

async function loadFiscalReceiptMutationSnapshot(
  receiptId: string,
  userId: string,
): Promise<FiscalReceiptMutationSnapshot> {
  const { data: receiptData, error: receiptError } = await supabase
    .from('receipts')
    .select(RECEIPT_MUTATION_SELECT)
    .eq('id', receiptId)
    .maybeSingle();
  if (receiptError) {
    throw receiptError;
  }
  if (!receiptData) {
    throw new Error('Покупка не найдена.');
  }

  const receipt = receiptData as unknown as ReceiptMutationSnapshotRow;
  if (receipt.user_id !== userId) {
    throw new Error('Покупка не найдена.');
  }

  const { data: expenseData, error: expensesError } = await supabase
    .from('expenses')
    .select(EXPENSE_MUTATION_SELECT)
    .eq('receipt_id', receiptId)
    .order('created_at', { ascending: true });
  if (expensesError) {
    throw expensesError;
  }

  const expenses = expenseData as unknown as ExpenseMutationSnapshotRow[];
  if (
    expenses.length === 0 ||
    expenses.some(
      (expense) =>
        expense.user_id !== userId || expense.receipt_id !== receiptId,
    )
  ) {
    throw new Error('Позиции покупки не найдены.');
  }

  return { receipt, expenses };
}

function rawReceiptMerchantName(rawJson: unknown): string {
  if (typeof rawJson !== 'object' || rawJson === null) {
    return '';
  }

  const merchantName = (rawJson as Record<string, unknown>).merchantName;
  return typeof merchantName === 'string' ? merchantName.trim() : '';
}

function rawReceiptMerchantLabel(rawJson: unknown): string {
  if (typeof rawJson !== 'object' || rawJson === null) {
    return '';
  }

  const receipt = rawJson as Record<string, unknown>;
  const merchantLabel = receipt.merchantLabel;
  if (typeof merchantLabel === 'string' && merchantLabel.trim()) {
    return merchantLabel.trim();
  }
  const merchantName = receipt.merchantName;
  return typeof merchantName === 'string' ? merchantName.trim() : '';
}

function learnedAliasesWithNormalizedIncoming(
  merchant: { aliases: readonly string[]; name: string },
  incomingName: string,
): string[] | null {
  const incomingKey = normalizeMerchantName(incomingName);
  if (
    !incomingKey ||
    [merchant.name, ...merchant.aliases].some(
      (name) => normalizeMerchantName(name) === incomingKey,
    )
  ) {
    return null;
  }

  const aliases = merchantAliasesWithIncoming(merchant, incomingName);
  return aliases.length === merchant.aliases.length ? null : aliases;
}

async function resolveReceiptEditMerchant(
  merchant: FiscalReceiptMerchantInput,
  incomingName: string,
  userId: string,
): Promise<ResolvedReceiptEditMerchant> {
  if ('existingId' in merchant) {
    const { data, error } = await supabase
      .from('merchants')
      .select('name,aliases')
      .eq('id', merchant.existingId)
      .single();
    if (error) {
      throw error;
    }

    const existing = data as unknown as {
      aliases: string[];
      name: string;
    };
    return {
      created: false,
      id: merchant.existingId,
      learnedAliases: learnedAliasesWithNormalizedIncoming(
        existing,
        incomingName,
      ),
      originalAliases: [...existing.aliases],
    };
  }

  const merchantName = merchant.name.trim();
  if (!merchantName) {
    throw new Error('Укажите название места.');
  }
  const learnedAliases =
    learnedAliasesWithNormalizedIncoming(
      { aliases: [], name: merchantName },
      incomingName,
    ) ?? [];
  const { data, error } = await supabase
    .from('merchants')
    .insert({
      user_id: userId,
      name: merchantName,
      type_id: null,
      aliases: learnedAliases,
    })
    .select('id')
    .single();
  if (error) {
    throw error;
  }

  return {
    created: true,
    id: (data as unknown as { id: string }).id,
    learnedAliases: null,
    originalAliases: null,
  };
}

function receiptTimestampForDate(
  occurredAt: string | null,
  occurredOn: string,
): string | null {
  if (!occurredAt) {
    return null;
  }
  return occurredAt.replace(/^\d{4}-\d{2}-\d{2}(?=T)/u, occurredOn);
}

function validateReceiptEditExpenses(
  snapshot: FiscalReceiptMutationSnapshot,
  input: UpdateFiscalReceiptInput,
): UpdateFiscalReceiptExpenseInput[] {
  if (!parseLocalISO(input.occurredOn)) {
    throw new Error('Дата покупки некорректна.');
  }
  if (input.expenses.length !== snapshot.expenses.length) {
    throw new Error('Состав покупки изменился. Обновите экран и повторите.');
  }

  const existingIds = new Set(
    snapshot.expenses.map((expense) => expense.id),
  );
  const seenIds = new Set<string>();
  for (const expense of input.expenses) {
    if (!existingIds.has(expense.id) || seenIds.has(expense.id)) {
      throw new Error('Состав покупки изменился. Обновите экран и повторите.');
    }
    seenIds.add(expense.id);
    if (
      expense.included &&
      (expense.amountCents === null ||
        !Number.isSafeInteger(expense.amountCents) ||
        expense.amountCents <= 0)
    ) {
      throw new Error('Исправьте суммы включённых позиций.');
    }
  }

  return input.expenses.filter((expense) => expense.included);
}

function receiptEditTotal(
  expenses: readonly UpdateFiscalReceiptExpenseInput[],
): number {
  let total = 0;
  for (const expense of expenses) {
    if (expense.amountCents === null) {
      throw new Error('Исправьте суммы включённых позиций.');
    }
    total += expense.amountCents;
    if (!Number.isSafeInteger(total)) {
      throw new Error('Итоговая сумма покупки слишком велика.');
    }
  }
  return total;
}

async function restoreFiscalReceiptSnapshot(
  snapshot: FiscalReceiptMutationSnapshot,
): Promise<void> {
  const { error: receiptError } = await supabase
    .from('receipts')
    .upsert(snapshot.receipt);
  if (receiptError) {
    console.error(
      'Unable to restore receipt after an edit failure:',
      receiptError.message,
    );
  }

  const { error: expensesError } = await supabase
    .from('expenses')
    .upsert(snapshot.expenses);
  if (expensesError) {
    console.error(
      'Unable to restore receipt expenses after an edit failure:',
      expensesError.message,
    );
  }
}

async function deleteFiscalReceiptForEdit(
  receiptId: string,
  snapshot: FiscalReceiptMutationSnapshot,
): Promise<UpdateFiscalReceiptResult> {
  try {
    const { error: expensesError } = await supabase
      .from('expenses')
      .delete()
      .eq('receipt_id', receiptId);
    if (expensesError) {
      throw expensesError;
    }

    const { error: receiptError } = await supabase
      .from('receipts')
      .delete()
      .eq('id', receiptId);
    if (receiptError) {
      throw receiptError;
    }
    return { deleted: true };
  } catch (error: unknown) {
    await restoreFiscalReceiptSnapshot(snapshot);
    throw error;
  }
}

export async function updateFiscalReceipt(
  receiptId: string,
  input: UpdateFiscalReceiptInput,
): Promise<UpdateFiscalReceiptResult> {
  const userId = await authenticatedUserId();
  const snapshot = await loadFiscalReceiptMutationSnapshot(
    receiptId,
    userId,
  );
  const keptExpenses = validateReceiptEditExpenses(snapshot, input);
  if (keptExpenses.length === 0) {
    return deleteFiscalReceiptForEdit(receiptId, snapshot);
  }
  if (!input.merchant) {
    throw new Error('Выберите место покупки.');
  }

  const snapshotById = new Map(
    snapshot.expenses.map((expense) => [expense.id, expense]),
  );
  const dateChanged = snapshot.expenses.some(
    (expense) => expense.occurred_on !== input.occurredOn,
  );
  const amountChanged = keptExpenses.some((expense) => {
    const existing = snapshotById.get(expense.id);
    return (
      existing !== undefined &&
      expense.amountCents !== null &&
      decimalToCents(existing.original_amount) !== expense.amountCents
    );
  });
  const currentCurrency = normalizeCurrencyCode(
    snapshot.receipt.currency ??
      snapshot.expenses[0]?.original_currency ??
      '',
  );
  if (!currentCurrency) {
    throw new Error('Валюта покупки не найдена.');
  }
  const currency =
    input.currency === undefined
      ? currentCurrency
      : normalizeCurrencyCode(input.currency);
  if (!currency) {
    throw new Error('Укажите трёхбуквенный код валюты.');
  }
  const currencyChanged = currency !== currentCurrency;
  const existingManualRsdTotal =
    !isCurrency(currentCurrency) &&
    snapshot.expenses.every((expense) => expense.amount_rsd !== null)
      ? snapshot.expenses.reduce(
          (total, expense) =>
            total + decimalToCents(expense.amount_rsd),
          0,
        )
      : null;
  const manualRsdTotalCents = isCurrency(currency)
    ? null
    : input.manualRsdTotalCents !== undefined
      ? input.manualRsdTotalCents
      : currencyChanged
        ? null
        : existingManualRsdTotal;
  const manualRsdShares =
    !isCurrency(currency) && manualRsdTotalCents !== null
      ? distributeCents(
          manualRsdTotalCents,
          keptExpenses.map((expense) => expense.amountCents ?? 0),
        )
      : keptExpenses.map(() => null);
  const rates =
    (dateChanged || amountChanged || currencyChanged) &&
    isCurrency(currency)
      ? await ratesForExpense(input.occurredOn)
      : null;
  const incomingMerchantName = rawReceiptMerchantName(
    snapshot.receipt.raw_json,
  );
  let resolvedMerchant: ResolvedReceiptEditMerchant | null = null;
  let aliasUpdateAttempted = false;

  try {
    resolvedMerchant = await resolveReceiptEditMerchant(
      input.merchant,
      incomingMerchantName,
      userId,
    );

    for (const [index, expense] of keptExpenses.entries()) {
      const existing = snapshotById.get(expense.id);
      if (!existing || expense.amountCents === null) {
        throw new Error(
          'Состав покупки изменился. Обновите экран и повторите.',
        );
      }
      const itemAmountChanged =
        decimalToCents(existing.original_amount) !== expense.amountCents;
      const converted = isCurrency(currency)
        ? dateChanged || itemAmountChanged || currencyChanged
          ? receiptExpenseAmounts(expense.amountCents, currency, rates)
          : {}
        : receiptExpenseAmounts(
            expense.amountCents,
            currency,
            null,
            manualRsdShares[index] ?? null,
          );
      const { error } = await supabase
        .from('expenses')
        .update({
          occurred_on: input.occurredOn,
          ...(dateChanged
            ? {
                occurred_at: receiptTimestampForDate(
                  existing.occurred_at,
                  input.occurredOn,
                ),
              }
            : {}),
          description: expense.description.trim() || expense.rawName.trim(),
          raw_name: expense.rawName.trim() || null,
          category_id: expense.categoryId,
          merchant_id: resolvedMerchant.id,
          original_amount: centsToDecimal(expense.amountCents),
          ...(currencyChanged ? { original_currency: currency } : {}),
          ...converted,
        })
        .eq('id', expense.id)
        .eq('receipt_id', receiptId);
      if (error) {
        throw error;
      }
    }

    for (const expense of input.expenses) {
      if (expense.included) {
        continue;
      }
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expense.id)
        .eq('receipt_id', receiptId);
      if (error) {
        throw error;
      }
    }

    const totalCents = receiptEditTotal(keptExpenses);
    const { error: receiptError } = await supabase
      .from('receipts')
      .update({
        merchant_id: resolvedMerchant.id,
        merchant_label: input.merchantLabel.trim() || null,
        ...(dateChanged
          ? {
              occurred_at: receiptTimestampForDate(
                snapshot.receipt.occurred_at,
                input.occurredOn,
              ),
            }
          : {}),
        total: centsToDecimal(totalCents),
        ...(currencyChanged ? { currency } : {}),
      })
      .eq('id', receiptId);
    if (receiptError) {
      throw receiptError;
    }

    if (resolvedMerchant.learnedAliases) {
      aliasUpdateAttempted = true;
      const { error: aliasError } = await supabase
        .from('merchants')
        .update({ aliases: resolvedMerchant.learnedAliases })
        .eq('id', resolvedMerchant.id);
      if (aliasError) {
        throw aliasError;
      }
    }

    if (!resolvedMerchant.created && !resolvedMerchant.learnedAliases) {
      await bumpMerchantUsage(resolvedMerchant.id);
    }

    return { deleted: false };
  } catch (error: unknown) {
    await restoreFiscalReceiptSnapshot(snapshot);

    if (
      resolvedMerchant &&
      !resolvedMerchant.created &&
      aliasUpdateAttempted &&
      resolvedMerchant.originalAliases
    ) {
      const { error: aliasRestoreError } = await supabase
        .from('merchants')
        .update({ aliases: resolvedMerchant.originalAliases })
        .eq('id', resolvedMerchant.id);
      if (aliasRestoreError) {
        console.error(
          'Unable to restore merchant aliases after an edit failure:',
          aliasRestoreError.message,
        );
      }
    }

    if (resolvedMerchant?.created) {
      const { error: merchantCleanupError } = await supabase
        .from('merchants')
        .delete()
        .eq('id', resolvedMerchant.id);
      if (merchantCleanupError) {
        console.error(
          'Unable to clean up a merchant after an edit failure:',
          merchantCleanupError.message,
        );
      }
    }
    throw error;
  }
}
