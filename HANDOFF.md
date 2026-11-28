# HANDOFF — Fintrack
_Обновлено: 2026-11-28 · автор витка: Codex · задача: SEARCH-01B_

Это краткая дельта. Долгий контекст и обязательные правила — в `README.md` и `AGENTS.md`.

## Где мы

SEARCH-01A и SEARCH-01B дают чистое локальное matching-ядро и Home-compatible purchase-level result model. Пользовательского поиска на Home ещё нет: родитель SEARCH-01 остаётся `In progress`, SEARCH-01C…01E открыты. Принятые DUP-01…DUP-02B.3 сохранены; REPORTS-02.3 всё ещё ждёт ручной browser/OS-проверки после отдельного Web deploy.

## Только что сделано

- Home grouping без изменения алгоритма вынесен в `lib/homePurchaseGrouping.ts`: `groupExpensesByDate()` сохраняет порядок локальных дат из входа, `buildPurchaseUnits()` сохраняет receipt/manual units, ключи `receipt:<id>` / `expense:<id>`, порядок и исходные Expense references. Home продолжает использовать эти же helpers.
- `lib/purchaseSearch.ts`: `buildPurchaseSearchIndex()` один раз строит SEARCH-01A index и purchase/day structure; `searchPurchaseIndex()` выполняет query и возвращает ordered days, полные покупки, `matchingExpenses`, `purchaseCount` и `matchingExpenseCount`.
- `assemblePurchaseSearchResults()` отделяет result assembly от match provider: будущий lexical/semantic provider может передать persisted expense IDs, не меняя purchase identity, day grouping, totals или edit/delete keys.
- `purchase.expenses` всегда остаётся полным составом загруженной покупки; matching subtotal никогда не заменяет purchase total. Match выполняется до визуального collapse, AND-токены не объединяются между позициями чека, пустые дни исключаются.
- Добавлен dedicated suite на empty/no-match/punctuation, receipt/manual grouping, ordering/identity, no-cross-item AND, full-vs-matching totals, honest-null FX/custom currency, trusted labels, future-provider assembly, отсутствие мутаций, consecutive queries и 5,000 synthetic rows.
- Проверки зелёные: targeted search/Home suites 56/56, `npm run typecheck`, полный `npm run test:ci` — 58 suites / 1100 tests.

## Состояние origin/main

Стартовый baseline: `570d904a7fbb5c9b36c5f3cf14e49254e7d41103` (SEARCH-01A). SEARCH-01B готовится одним коммитом `feat(search): add purchase-level expense search results`; schema, data, UI и deploy не затронуты.

## Следующий шаг

SEARCH-01C: подключить постоянный DS `SearchField` на Home и inline-фильтрацию уже загруженного полного месяца через подготовленный purchase index, не меняя financial summary и не смешивая поиск с обычным Needs review filter.

## Открытые решения и риски

- User-facing search пока отсутствует. Result model работает только по переданному уже загруженному dataset; all-history retrieval остаётся SEARCH-02.
- Full purchase означает все persisted Expense rows этой покупки в переданном dataset, не отсутствующие/исключённые fiscal items.
- `matchingExpenseCount` считает persisted rows, не визуально collapsed позиции и не physical quantity.
- SEARCH-03 (multilingual/semantic) остаётся отдельной инициативой: model/provider, privacy, cost и quality evaluation требуют product approval. Текущий assembly API готов принять независимые match IDs без speculative provider framework.
- Amount/currency search и advanced filters вынесены в SEARCH-04/05. BUG-5 category provenance отдельно не исправлялся; trusted aliases по-прежнему обязан безопасно подготовить caller.
- Merge в `main` не означает Web/Android deploy; REPORTS-02.3 manual verification остаётся актуальной.

## Не трогать

- В SEARCH-01C не фильтровать `purchase.expenses` до `matchingExpenses`: total, edit/delete и expansion должны работать с полной покупкой.
- Не объединять query tokens между разными Expense rows одного receipt; matching всегда остаётся record-level до purchase assembly.
- Не дублировать Home grouping и не возвращать grouping обратно в screen; shared helpers — единый источник поведения.
- Не переводить user content по текстовому совпадению, не добавлять global cache, network-per-keystroke, ranking, amount search, semantic dependencies или schema changes без отдельной задачи.
- Сохранять DUP account/session/write guards и Web PDF lazy boundary; не включать `.env`, `supabase/.temp/*` и временные артефакты в коммиты.
