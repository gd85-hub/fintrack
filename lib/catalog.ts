import type { Translate } from './i18n';

// Display-translation layer for system reference data. The DB seeds system
// categories, groups, and merchant types with Russian labels; these maps turn
// the seeded label into an i18n key so the UI can show them in the active
// locale. Only seeded system labels are mapped — unknown strings (user-created
// names) pass through unchanged, so user content is never translated.

// seeded Russian category name -> i18n key
const CATEGORY_KEYS: Record<string, string> = {
  'Не распознано': 'catalog.category.uncategorized',
  'Кафе и рестораны': 'catalog.category.cafeRestaurants',
  Продукты: 'catalog.category.groceries',
  Кофе: 'catalog.category.coffee',
  Аренда: 'catalog.category.rent',
  Коммуналка: 'catalog.category.utilities',
  Интернет: 'catalog.category.internet',
  Транспорт: 'catalog.category.transport',
  Бензин: 'catalog.category.fuel',
  Здоровье: 'catalog.category.health',
  Аптека: 'catalog.category.pharmacy',
  Развлечения: 'catalog.category.entertainment',
  Путешествия: 'catalog.category.travel',
  Одежда: 'catalog.category.clothing',
  Подарки: 'catalog.category.gifts',
  Животные: 'catalog.category.pets',
  Гигиена: 'catalog.category.toiletries',
  'Мобильная связь': 'catalog.category.mobile',
  Подписки: 'catalog.category.subscriptions',
  Образование: 'catalog.category.education',
  Работа: 'catalog.category.work',
  Налоги: 'catalog.category.taxes',
  Ремонт: 'catalog.category.repairs',
  Быт: 'catalog.category.household',
  Техника: 'catalog.category.electronics',
  Прочее: 'catalog.category.other',
};

// seeded Russian group name -> i18n key
const GROUP_KEYS: Record<string, string> = {
  Прочее: 'catalog.group.other',
  Еда: 'catalog.group.food',
  Жильё: 'catalog.group.housing',
  Транспорт: 'catalog.group.transport',
  Здоровье: 'catalog.group.health',
  Досуг: 'catalog.group.leisure',
  Личное: 'catalog.group.personal',
  Сервисы: 'catalog.group.services',
  Развитие: 'catalog.group.development',
  Работа: 'catalog.group.work',
  Дом: 'catalog.group.home',
};

// merchant-type slug -> i18n key (keyed by slug, not the seeded name)
const MERCHANT_TYPE_KEYS: Record<string, string> = {
  shop: 'catalog.merchantType.shop',
  cafe: 'catalog.merchantType.cafe',
  restaurant: 'catalog.merchantType.restaurant',
  online: 'catalog.merchantType.online',
  other: 'catalog.merchantType.other',
};

export function localizeCategoryName(name: string, t: Translate): string {
  const key = CATEGORY_KEYS[name];
  return key ? t(key) : name;
}

export function localizeGroup(group: string, t: Translate): string {
  const key = GROUP_KEYS[group];
  return key ? t(key) : group;
}

export function localizeMerchantType(slug: string, t: Translate): string {
  const key = MERCHANT_TYPE_KEYS[slug];
  return key ? t(key) : slug;
}
