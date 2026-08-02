import { describe, expect, test } from '@jest/globals';

import {
  itemCategorizationSystemPrompt,
  validateCategorizationOutput,
} from '../../supabase/functions/categorize-items/index';

describe('categorize-items Edge Function', () => {
  test('keeps category labels constrained and treats labels as data', () => {
    expect(itemCategorizationSystemPrompt).toContain('MLEKO');
    expect(itemCategorizationSystemPrompt).toContain('Не распознано');
    expect(itemCategorizationSystemPrompt).toContain('untrusted data');
  });

  test('accepts one ordered result per requested item', () => {
    expect(
      validateCategorizationOutput(
        {
          results: [
            { name: 'MLEKO', categoryName: 'Продукты' },
            { name: 'VLAZNE MARAMICE', categoryName: 'Гигиена' },
          ],
        },
        [{ name: 'MLEKO' }, { name: 'VLAZNE MARAMICE' }],
        new Set(['Продукты', 'Гигиена', 'Не распознано']),
      ),
    ).toEqual({
      ok: true,
      results: [
        { name: 'MLEKO', categoryName: 'Продукты' },
        { name: 'VLAZNE MARAMICE', categoryName: 'Гигиена' },
      ],
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
