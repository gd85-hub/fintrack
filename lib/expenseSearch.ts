import type { Expense } from './db';

type SearchableValue = string | null | undefined;

export type ExpenseSearchOptions<T extends Expense> = Readonly<{
  /**
   * Additional labels whose provenance is already trusted by the caller.
   * The engine never localizes category names itself: integration code must
   * resolve system aliases from stable metadata so user-created labels are
   * not translated by text coincidence (BUG-5).
   */
  trustedLabelsForExpense?: (
    expense: T,
  ) => readonly SearchableValue[];
}>;

type ExpenseSearchEntry<T extends Expense> = Readonly<{
  expense: T;
  searchableText: string;
}>;

export type ExpenseSearchIndex<T extends Expense = Expense> = Readonly<{
  entries: readonly ExpenseSearchEntry<T>[];
}>;

const nonDecomposingLatinLetters: Readonly<Record<string, string>> = {
  æ: 'ae',
  ð: 'd',
  đ: 'd',
  ł: 'l',
  ø: 'o',
  œ: 'oe',
  þ: 'th',
};

const latinLetterPattern = /\p{Script=Latin}/u;
const combiningMarkPattern = /\p{M}/u;
const punctuationOrSymbolPattern = /[\p{P}\p{S}]+/gu;

/**
 * Search normalization is intentionally narrower than merchant identity:
 * - NFKC + lower case;
 * - Russian ё is equivalent to е;
 * - combining marks are removed only from Latin base letters, so Latin
 *   diacritics (including Serbian č/ć/š/ž) are ignored while Cyrillic й is
 *   not collapsed into и;
 * - common non-decomposing Latin letters, including Serbian đ, use their
 *   plain-Latin search form;
 * - Unicode punctuation/symbol runs and whitespace become one ASCII space.
 *
 * There is no cross-script transliteration, stemming, fuzzy match or synonym
 * expansion. The normalized value is used only for matching.
 */
function normalizeSearchText(value: string): string {
  const decomposed = value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/gu, 'е')
    .replace(
      /[æðđłøœþ]/gu,
      (letter) => nonDecomposingLatinLetters[letter] ?? letter,
    )
    .normalize('NFD');

  let withoutLatinMarks = '';
  let previousBaseWasLatin = false;
  for (const character of decomposed) {
    if (combiningMarkPattern.test(character)) {
      if (!previousBaseWasLatin) {
        withoutLatinMarks += character;
      }
      continue;
    }
    withoutLatinMarks += character;
    previousBaseWasLatin = latinLetterPattern.test(character);
  }

  return withoutLatinMarks
    .normalize('NFC')
    .replace(punctuationOrSymbolPattern, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}

function normalizedFields(values: readonly SearchableValue[]): string {
  return values
    .filter((value): value is string => typeof value === 'string')
    .map(normalizeSearchText)
    .filter(Boolean)
    .join(' ');
}

/**
 * Builds an immutable-by-contract search snapshot from already-loaded rows.
 * The six Expense display/content fields are normalized exactly once here;
 * the original records are retained by identity and are never copied deeply.
 * Rebuild the index when the caller's expense dataset or trusted labels change.
 */
export function buildExpenseSearchIndex<T extends Expense>(
  expenses: readonly T[],
  options: ExpenseSearchOptions<T> = {},
): ExpenseSearchIndex<T> {
  return {
    entries: expenses.map((expense) => ({
      expense,
      searchableText: normalizedFields([
        expense.description,
        expense.rawName,
        expense.merchantName,
        expense.merchantLabel,
        expense.categoryName,
        expense.note,
        ...(options.trustedLabelsForExpense?.(expense) ?? []),
      ]),
    })),
  };
}

/**
 * Evaluates an already-built index without re-normalizing expense fields.
 * Empty/whitespace queries return all original records. Other queries use
 * AND semantics across normalized whitespace-delimited tokens: every token
 * must occur as a substring somewhere in the same expense's searchable text.
 * Results retain input order and the original object references; no ranking,
 * cloning or mutation is performed.
 */
export function searchExpenseIndex<T extends Expense>(
  index: ExpenseSearchIndex<T>,
  query: string,
): T[] {
  if (!query.trim()) {
    return index.entries.map(({ expense }) => expense);
  }

  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }
  const tokens = normalizedQuery.split(' ');

  return index.entries
    .filter(({ searchableText }) =>
      tokens.every((token) => searchableText.includes(token)),
    )
    .map(({ expense }) => expense);
}
