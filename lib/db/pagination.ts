export const EXPENSE_QUERY_PAGE_SIZE = 1_000;

type PageResult = {
  data: unknown[] | null;
  error: unknown;
};

type PageLoader = (
  from: number,
  to: number,
) => PromiseLike<PageResult>;

export async function fetchAllRows<Row>(
  loadPage: PageLoader,
  pageSize = EXPENSE_QUERY_PAGE_SIZE,
): Promise<Row[]> {
  if (!Number.isSafeInteger(pageSize) || pageSize <= 0) {
    throw new Error('Page size must be a positive integer.');
  }

  const rows: Row[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await loadPage(
      from,
      from + pageSize - 1,
    );
    if (error) {
      throw error;
    }

    // A short page is not proof of exhaustion: PostgREST may cap responses
    // below the requested range. Only an empty page is terminal.
    const page = (data ?? []) as Row[];
    if (page.length === 0) {
      return rows;
    }

    rows.push(...page);
    from += page.length;
  }
}
