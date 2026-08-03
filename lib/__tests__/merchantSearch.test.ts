import { describe, expect, jest, test } from '@jest/globals';

import { filterAndSortMerchants } from '../merchantSearch';

jest.mock('../supabase', () => ({
  supabase: {},
}));

type Candidate = {
  aliases: string[];
  id: string;
  name: string;
  updatedAt: string;
};

function candidate(
  id: string,
  name: string,
  updatedAt: string,
  aliases: string[] = [],
): Candidate {
  return { aliases, id, name, updatedAt };
}

describe('merchant picker search', () => {
  test('matches Cyrillic input against a normalized Latin name', () => {
    const merchants = [
      candidate('other', 'Idea', '2026-08-03T10:00:00Z'),
      candidate('lidl', 'LIDL', '2026-08-01T10:00:00Z'),
    ];

    expect(filterAndSortMerchants(merchants, 'лидл')).toEqual([
      merchants[1],
    ]);
  });

  test('uses aliases as searchable spellings', () => {
    const merchant = candidate(
      'alias',
      'Балкан Фудс',
      '2026-08-01T10:00:00Z',
      ['LIDL'],
    );

    expect(filterAndSortMerchants([merchant], 'lidl')).toEqual([
      merchant,
    ]);
  });

  test('orders an empty search by recency then alphabetically', () => {
    const merchants = [
      candidate('older', 'Бета', '2026-08-01T10:00:00Z'),
      candidate('alpha', 'Альфа', '2026-08-03T10:00:00Z'),
      candidate('gamma', 'Гамма', '2026-08-03T10:00:00Z'),
    ];

    expect(
      filterAndSortMerchants(merchants, '').map(({ id }) => id),
    ).toEqual(['alpha', 'gamma', 'older']);
  });

  test('ranks exact, prefix, and substring matches before recency', () => {
    const merchants = [
      candidate('includes', 'Super LIDL Center', '2026-08-05T10:00:00Z'),
      candidate('prefix-old', 'LIDL Centar', '2026-08-02T10:00:00Z'),
      candidate('exact', 'LIDL', '2026-08-01T10:00:00Z'),
      candidate('prefix-new', 'LIDL Zemun', '2026-08-04T10:00:00Z'),
    ];

    expect(
      filterAndSortMerchants(merchants, 'lidl').map(({ id }) => id),
    ).toEqual(['exact', 'prefix-new', 'prefix-old', 'includes']);
  });
});
