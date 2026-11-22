import { describe, expect, jest, test } from '@jest/globals';

import { fetchAllRows } from '../db/pagination';

type FixtureRow = { id: string };

function row(id: number): FixtureRow {
  return { id: `row-${id}` };
}

function createLoader(
  rows: readonly FixtureRow[],
  options: { errorPage?: number; serverLimit?: number } = {},
) {
  let page = 0;
  const load = jest.fn(
    async (from: number, to: number) => {
      const currentPage = page;
      page += 1;

      if (currentPage === options.errorPage) {
        return { data: null, error: new Error(`page-${currentPage}`) };
      }

      const requested = to - from + 1;
      const returned = Math.min(
        requested,
        options.serverLimit ?? requested,
      );
      return {
        data: rows.slice(from, from + returned),
        error: null,
      };
    },
  );

  return load;
}

describe('fetchAllRows', () => {
  const cases: Array<[string, number, number, number | undefined]> = [
    ['empty dataset', 0, 2, undefined],
    ['one record', 1, 2, undefined],
    ['smaller than one page', 2, 3, undefined],
    ['exactly one full page', 2, 2, undefined],
    ['one record larger than a page', 3, 2, undefined],
    ['multiple full pages', 4, 2, undefined],
    ['full pages plus a partial final page', 5, 2, undefined],
    ['server limit smaller than requested page', 5, 4, 2],
  ];

  test.each(cases)(
    'returns every row once for %s',
    async (_label, count, pageSize, serverLimit) => {
      const rows = Array.from({ length: count }, (_, index) => row(index));
      const load = createLoader(rows, { serverLimit });

      const result = await fetchAllRows<FixtureRow>(load, pageSize);

      expect(result).toEqual(rows);
      expect(new Set(result.map(({ id }) => id)).size).toBe(count);
      expect(load).toHaveBeenLastCalledWith(
        count,
        count + pageSize - 1,
      );
    },
  );

  test('fails the whole retrieval when the first page fails', async () => {
    const load = createLoader([row(0)], { errorPage: 0 });

    await expect(fetchAllRows(load, 2)).rejects.toThrow('page-0');
    expect(load).toHaveBeenCalledTimes(1);
  });

  test('fails the whole retrieval when a later page fails', async () => {
    const load = createLoader([row(0), row(1), row(2)], {
      errorPage: 1,
    });

    await expect(fetchAllRows(load, 2)).rejects.toThrow('page-1');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
