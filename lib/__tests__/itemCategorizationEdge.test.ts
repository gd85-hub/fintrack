import { describe, expect, test } from '@jest/globals';

import {
  itemCategorizationSystemPrompt,
  validateCategorizationOutput,
} from '../../supabase/functions/categorize-items/index';

describe('categorize-items Edge Function', () => {
  test('keeps category labels constrained and treats labels as data', () => {
    expect(itemCategorizationSystemPrompt).toContain('MLEKO');
    expect(itemCategorizationSystemPrompt).toContain('Пакет');
    expect(itemCategorizationSystemPrompt).toContain('Не распознано');
    expect(itemCategorizationSystemPrompt).toContain('untrusted data');
  });

  test('accepts one ordered result per requested item', () => {
    expect(
      validateCategorizationOutput(
        {
          results: [
            {
              name: 'MLEKO',
              displayName: 'Молоко',
              categoryName: 'Продукты',
            },
            {
              name: 'VLAZNE MARAMICE',
              displayName: 'Влажные салфетки',
              categoryName: 'Гигиена',
            },
          ],
        },
        [{ name: 'MLEKO' }, { name: 'VLAZNE MARAMICE' }],
        new Set(['Продукты', 'Гигиена', 'Не распознано']),
      ),
    ).toEqual({
      ok: true,
      results: [
        {
          name: 'MLEKO',
          displayName: 'Молоко',
          categoryName: 'Продукты',
        },
        {
          name: 'VLAZNE MARAMICE',
          displayName: 'Влажные салфетки',
          categoryName: 'Гигиена',
        },
      ],
    });
  });

  test('falls back to the raw name when displayName is missing or empty', () => {
    const items = [{ name: 'KESA TREGERICA' }];
    const categoryNames = new Set(['Прочее', 'Не распознано']);

    expect(
      validateCategorizationOutput(
        { results: [{ name: 'KESA TREGERICA', categoryName: 'Прочее' }] },
        items,
        categoryNames,
      ),
    ).toMatchObject({
      results: [{ name: 'KESA TREGERICA', displayName: 'KESA TREGERICA' }],
    });
    expect(
      validateCategorizationOutput(
        {
          results: [
            {
              name: 'KESA TREGERICA',
              displayName: '   ',
              categoryName: 'Прочее',
            },
          ],
        },
        items,
        categoryNames,
      ),
    ).toMatchObject({
      results: [{ name: 'KESA TREGERICA', displayName: 'KESA TREGERICA' }],
    });
  });

  test('rejects invented categories and reordered item names', () => {
    const items = [{ name: 'MLEKO' }];
    const categoryNames = new Set(['Продукты', 'Не распознано']);

    expect(
      validateCategorizationOutput(
        { results: [{ name: 'MLEKO', categoryName: 'Молочное' }] },
        items,
        categoryNames,
      ),
    ).toBeNull();
    expect(
      validateCategorizationOutput(
        { results: [{ name: 'OTHER', categoryName: 'Продукты' }] },
        items,
        categoryNames,
      ),
    ).toBeNull();
  });
});
