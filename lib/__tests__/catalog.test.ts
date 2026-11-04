import { describe, expect, it } from '@jest/globals';

import {
  localizeCategoryName,
  localizeGroup,
  localizeMerchantType,
} from '../catalog';
import type { Translate } from '../i18n';

const t: Translate = (key) => `T:${key}`;

describe('localizeCategoryName', () => {
  it('maps seeded category names to category translation keys', () => {
    expect(localizeCategoryName('Продукты', t)).toBe(
      'T:catalog.category.groceries',
    );
    expect(localizeCategoryName('Кафе и рестораны', t)).toBe(
      'T:catalog.category.cafeRestaurants',
    );
    expect(localizeCategoryName('Не распознано', t)).toBe(
      'T:catalog.category.uncategorized',
    );
  });

  it('passes user-created category names through untranslated', () => {
    expect(localizeCategoryName('Мой магазин', t)).toBe('Мой магазин');
  });

  it('passes an empty category name through unchanged', () => {
    expect(localizeCategoryName('', t)).toBe('');
  });
});

describe('localizeGroup', () => {
  it('maps seeded group names and passes unknown groups through', () => {
    expect(localizeGroup('Еда', t)).toBe('T:catalog.group.food');
    expect(localizeGroup('Нечто', t)).toBe('Нечто');
  });
});

describe('localizeMerchantType', () => {
  it('maps seeded merchant-type slugs and passes unknown slugs through', () => {
    expect(localizeMerchantType('cafe', t)).toBe(
      'T:catalog.merchantType.cafe',
    );
    expect(localizeMerchantType('shop', t)).toBe(
      'T:catalog.merchantType.shop',
    );
    expect(localizeMerchantType('kiosk', t)).toBe('kiosk');
  });
});

describe('category and group homonyms', () => {
  it('uses independent translation maps for Прочее and Транспорт', () => {
    expect(localizeCategoryName('Прочее', t)).toBe(
      'T:catalog.category.other',
    );
    expect(localizeGroup('Прочее', t)).toBe('T:catalog.group.other');
    expect(localizeCategoryName('Транспорт', t)).toBe(
      'T:catalog.category.transport',
    );
    expect(localizeGroup('Транспорт', t)).toBe(
      'T:catalog.group.transport',
    );
  });
});
