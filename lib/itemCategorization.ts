import { supabase } from './supabase';

export type ItemCategorizationCategory = {
  id: string;
  name: string;
  slug: string | null;
};

export type ItemCategoryResolution = {
  categoryId: string;
  displayName: string;
  excluded: boolean;
};

export type ItemCategoryRule = {
  normalizedName: string;
  categoryId: string | null;
  displayName: string | null;
  action: 'categorize' | 'exclude';
};

export type ItemCategorySelection = {
  rawName: string;
  displayName: string;
  categoryId: string | null;
  excluded: boolean;
};

export type ItemCategoryRuleWrite = ItemCategoryRule;

type CategorizationResult = {
  name: string;
  displayName: string;
  categoryName: string;
};

type ResolverDependencies = {
  loadRules: (
    normalizedNames: readonly string[],
  ) => Promise<ItemCategoryRule[]>;
  categorize: (
    items: readonly { name: string }[],
    categories: readonly ItemCategorizationCategory[],
  ) => Promise<CategorizationResult[]>;
};

type RuleWriter = (
  rules: readonly ItemCategoryRuleWrite[],
) => Promise<void>;

type ItemCategoryRuleQueryRow = {
  normalized_name: string;
  category_id: string | null;
  display_name: string | null;
  action: 'categorize' | 'exclude';
};

type ItemCategoryRuleHitRow = {
  normalized_name: string;
  hit_count: number;
};

const maximumAiItems = 60;
const trailingParentheticalNoise =
  /\s*\(\s*(?:k\s*o\s*m|\p{L})\s*\)\s*$/iu;
const trailingSizeNoise =
  /\s*(?:\d+(?:[.,]\d+)?\s*(?:ml|cl|dl|mg|gr|kg|l|g|мл|кл|дл|мг|гр|кг|л|г|kom\.?|kpl|ком|шт\.?)(?![\p{L}\p{N}])|\d+\s*\/\s*\d+)\s*$/iu;
const trailingCountNoise =
  /(?:\s*\/\s*|\s+)(?:kom\.?|kpl|ком|шт\.?)\s*$/iu;
const separatorNoise = /[-–—/·]+/gu;
const leadingArticleNoise = /^\d{6,}(?=\s|$)\s*/u;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeCategoryName(value: string) {
  return value.normalize('NFKC').trim().toLowerCase();
}

export function normalizeItemName(name: string) {
  let normalized = name
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, ' ');

  for (let pass = 0; pass < 12; pass += 1) {
    const withoutNoise = normalized
      .replace(trailingParentheticalNoise, '')
      .replace(trailingSizeNoise, '')
      .replace(trailingCountNoise, '')
      .replace(separatorNoise, ' ')
      // Preserve a dot only when it has a digit on both sides.
      .replace(/(^|[^\d])\./gu, '$1 ')
      .replace(/\.(?=$|[^\d])/gu, ' ')
      .replace(leadingArticleNoise, '')
      .trim()
      .replace(/\s+/gu, ' ');
    if (withoutNoise === normalized) {
      break;
    }
    normalized = withoutNoise;
  }

  return normalized
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, ' ');
}

async function authenticatedUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Требуется вход в аккаунт.');
  }
  return session.user.id;
}

export async function loadItemCategoryRules(
  normalizedNames: readonly string[],
): Promise<ItemCategoryRule[]> {
  if (normalizedNames.length === 0) {
    return [];
  }

  const userId = await authenticatedUserId();
  const { data, error } = await supabase
    .from('item_category_rules')
    .select('normalized_name,category_id,display_name,action')
    .eq('user_id', userId)
    .in('normalized_name', [...normalizedNames]);
  if (error) {
    throw error;
  }

  return (data as unknown as ItemCategoryRuleQueryRow[]).map((row) => ({
    normalizedName: row.normalized_name,
    categoryId: row.category_id,
    displayName: row.display_name,
    action: row.action,
  }));
}

function validateCategorizationResponse(
  value: unknown,
  requestedItems: readonly { name: string }[],
  categoryNames: ReadonlySet<string>,
): CategorizationResult[] | null {
  if (
    !isObject(value) ||
    value.ok !== true ||
    !Array.isArray(value.results) ||
    value.results.length !== requestedItems.length
  ) {
    return null;
  }

  const results: CategorizationResult[] = [];
  for (let index = 0; index < value.results.length; index += 1) {
    const result = value.results[index];
    const requested = requestedItems[index];
    if (
      !requested ||
      !isObject(result) ||
      result.name !== requested.name ||
      ('displayName' in result && typeof result.displayName !== 'string') ||
      typeof result.categoryName !== 'string' ||
      !categoryNames.has(result.categoryName)
    ) {
      return null;
    }
    results.push({
      name: requested.name,
      displayName:
        typeof result.displayName === 'string' && result.displayName.trim()
          ? result.displayName.trim()
          : requested.name,
      categoryName: result.categoryName,
    });
  }
  return results;
}

export async function categorizeItemsWithAi(
  items: readonly { name: string }[],
  categories: readonly ItemCategorizationCategory[],
): Promise<CategorizationResult[]> {
  if (items.length === 0) {
    return [];
  }

  try {
    const { data, error } = await supabase.functions.invoke<unknown>(
      'categorize-items',
      {
        body: {
          items,
          categories: categories.map(({ id, name }) => ({ id, name })),
        },
      },
    );
    if (error) {
      console.error('Unable to categorize receipt items: Edge Function error.');
      return [];
    }
    const validated = validateCategorizationResponse(
      data,
      items,
      new Set(categories.map(({ name }) => name)),
    );
    if (!validated) {
      console.error('Unable to categorize receipt items: invalid response.');
      return [];
    }
    return validated;
  } catch {
    console.error('Unable to categorize receipt items: request failed.');
    return [];
  }
}

const defaultResolverDependencies: ResolverDependencies = {
  loadRules: loadItemCategoryRules,
  categorize: categorizeItemsWithAi,
};

export async function resolveCategoriesForItems(
  items: readonly { name: string }[],
  categories: readonly ItemCategorizationCategory[],
  dependencies: ResolverDependencies = defaultResolverDependencies,
): Promise<ItemCategoryResolution[]> {
  const uncategorized = categories.find(
    (category) => category.slug === 'uncategorized',
  );
  if (!uncategorized) {
    throw new Error('Категория «Не распознано» не найдена.');
  }
  if (items.length === 0) {
    return [];
  }

  const normalizedNames = items.map(({ name }) => normalizeItemName(name));
  const uniqueNames = [...new Set(normalizedNames.filter(Boolean))];
  const rules = await dependencies.loadRules(uniqueNames);
  const rulesByName = new Map(
    rules.map((rule) => [rule.normalizedName, rule]),
  );
  const categoryIds = new Set(categories.map(({ id }) => id));
  const categoryIdsByName = new Map(
    categories.map((category) => [
      normalizeCategoryName(category.name),
      category.id,
    ]),
  );
  const resolutions: Array<ItemCategoryResolution | null> = items.map(
    () => null,
  );
  const unresolvedByName = new Map<
    string,
    { item: { name: string }; indexes: number[] }
  >();

  items.forEach((item, index) => {
    const normalizedName = normalizedNames[index] ?? '';
    if (!normalizedName) {
      resolutions[index] = {
        categoryId: uncategorized.id,
        displayName: item.name.trim(),
        excluded: false,
      };
      return;
    }

    const rule = rulesByName.get(normalizedName);
    if (rule?.action === 'exclude') {
      resolutions[index] = {
        categoryId: uncategorized.id,
        displayName: rule.displayName?.trim() || item.name.trim(),
        excluded: true,
      };
      return;
    }
    if (
      rule?.action === 'categorize' &&
      rule.categoryId &&
      categoryIds.has(rule.categoryId)
    ) {
      resolutions[index] = {
        categoryId: rule.categoryId,
        displayName: rule.displayName?.trim() || item.name.trim(),
        excluded: false,
      };
      return;
    }

    const unresolved = unresolvedByName.get(normalizedName);
    if (unresolved) {
      unresolved.indexes.push(index);
    } else {
      unresolvedByName.set(normalizedName, {
        item: { name: item.name.trim() },
        indexes: [index],
      });
    }
  });

  const unresolved = [...unresolvedByName.entries()];
  for (let start = 0; start < unresolved.length; start += maximumAiItems) {
    const chunk = unresolved.slice(start, start + maximumAiItems);
    const aiResults = await dependencies.categorize(
      chunk.map(([, value]) => value.item),
      categories,
    );
    const aiResultsByName = new Map(
      aiResults.map((result) => [normalizeItemName(result.name), result]),
    );

    for (const [normalizedName, value] of chunk) {
      const result = aiResultsByName.get(normalizedName);
      const categoryId = result
        ? categoryIdsByName.get(
            normalizeCategoryName(result.categoryName),
          )
        : null;
      const displayName = result?.displayName.trim() || value.item.name;
      for (const index of value.indexes) {
        resolutions[index] = {
          categoryId: categoryId ?? uncategorized.id,
          displayName,
          excluded: false,
        };
      }
    }
  }

  return resolutions.map(
    (resolution, index) =>
      resolution ?? {
        categoryId: uncategorized.id,
        displayName: items[index]?.name.trim() ?? '',
        excluded: false,
      },
  );
}

export async function upsertItemCategoryRules(
  rules: readonly ItemCategoryRuleWrite[],
): Promise<void> {
  if (rules.length === 0) {
    return;
  }

  const userId = await authenticatedUserId();
  const normalizedNames = rules.map(({ normalizedName }) => normalizedName);
  const { data: existingData, error: existingError } = await supabase
    .from('item_category_rules')
    .select('normalized_name,hit_count')
    .eq('user_id', userId)
    .in('normalized_name', normalizedNames);
  if (existingError) {
    throw existingError;
  }

  const hitsByName = new Map(
    (existingData as unknown as ItemCategoryRuleHitRow[]).map((row) => [
      row.normalized_name,
      row.hit_count,
    ]),
  );
  const rows = rules.map((rule) => ({
    user_id: userId,
    normalized_name: rule.normalizedName,
    category_id: rule.action === 'exclude' ? null : rule.categoryId,
    display_name: rule.displayName?.trim() || null,
    action: rule.action,
    hit_count: (hitsByName.get(rule.normalizedName) ?? 0) + 1,
  }));
  const { error } = await supabase
    .from('item_category_rules')
    .upsert(rows, { onConflict: 'user_id,normalized_name' });
  if (error) {
    throw error;
  }
}

export async function learnItemCategoryRules(
  selections: readonly ItemCategorySelection[],
  writer: RuleWriter = upsertItemCategoryRules,
): Promise<void> {
  const rulesByName = new Map<string, ItemCategoryRuleWrite>();
  for (const selection of selections) {
    const rawName = selection.rawName.trim();
    const normalizedName = normalizeItemName(rawName);
    if (!normalizedName || (!selection.excluded && !selection.categoryId)) {
      continue;
    }
    rulesByName.set(normalizedName, {
      normalizedName,
      categoryId: selection.excluded ? null : selection.categoryId,
      displayName: selection.displayName.trim() || rawName || null,
      action: selection.excluded ? 'exclude' : 'categorize',
    });
  }

  if (rulesByName.size > 0) {
    await writer([...rulesByName.values()]);
  }
}
