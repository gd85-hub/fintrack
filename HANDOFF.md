# HANDOFF — Fintrack
_Обновлено: 2026-11-28 · автор витка: Codex · задача: SEARCH-01A_

Это краткая дельта. Долгий контекст и обязательные правила — в `README.md` и `AGENTS.md`.

## Где мы

SEARCH-01 начат первым атомарным вкладом: pure local expense search engine готов, но пользовательского поиска на Home ещё нет. Родитель остаётся `In progress`; впереди SEARCH-01B…01E. Все принятые DUP-01…DUP-02B.3 остаются в `main` без изменений. REPORTS-02.3 по-прежнему ждёт ручной проверки browser/OS-сохранения после отдельного Web deploy.

## Только что сделано

- Добавлен `lib/expenseSearch.ts` с двумя публичными операциями: `buildExpenseSearchIndex(expenses, options?)` один раз нормализует уже загруженные строки; `searchExpenseIndex(index, query)` оценивает запрос без повторной нормализации набора.
- Индексирует `description`, `rawName`, `merchantName`, `merchantLabel`, `categoryName`, `note` и опциональные `trustedLabelsForExpense`. Category localization внутри engine отсутствует: корректные системные aliases должен передать integration layer по стабильным метаданным, не по совпадению имени (BUG-5 не маскируется).
- Нормализация: NFKC/lowercase; `ё→е`; диакритики снимаются только с латинской основы (č/ć/š/ž), отдельные non-decomposing Latin letters включая `đ` получают plain form; кириллическое `й` сохраняется; punctuation/symbols становятся пробелами, whitespace схлопывается.
- Семантика: partial substring, AND по токенам внутри одной Expense-записи; токены могут совпасть в разных полях этой записи, но не в разных строках/позициях. Пустой query возвращает весь input; punctuation-only — ничего. Ranking, transliteration, fuzzy/stemming/synonyms отсутствуют.
- Результаты сохраняют исходный порядок, ссылки на исходные объекты и идентификаторы; records не мутируются и не клонируются глубоко. Индекс пересобирается только при смене набора/aliases; глобального кэша и I/O нет.
- Добавлены 23 regression tests: все поля, Unicode/Serbian/ё-й, punctuation, AND/no-cross-record, nulls, aliases, order/identity/no-mutation и deterministic dataset на 5,000 строк.
- Проверки зелёные: targeted suite 23/23, `npm run typecheck`, полный `npm run test:ci` — 57 suites / 1082 tests.
- `BACKLOG.md` фиксирует decomposition: SEARCH-01A Done; SEARCH-01B purchase model, 01C Home field, 01D matching-item UX, 01E integration/a11y/perf audit открыты.

## Состояние origin/main

Стартовый и удалённый baseline: `87cec1c30b4c5c15c8eccd6423fce6ac46ca119d`. SEARCH-01A готовится одним коммитом `feat(search): add deterministic local expense search engine`; production schema/data/deploy не затронуты.

## Следующий шаг

SEARCH-01B: построить purchase-level result model поверх item-level совпадений так, чтобы покупка возвращалась целиком с полным total/identity/day grouping, но AND-токены никогда не объединялись между разными позициями одного чека.

## Открытые решения и риски

- Engine ищет только по уже загруженным Expense rows; UI, current-month wiring, Needs-review independence и purchase presentation ещё отсутствуют.
- Amount/currency/date/id search, all-history, server FTS, fuzzy matching, transliteration и ranking вне SEARCH-01A.
- `categoryName` ищется как сохранённый текст. Безопасный локализованный alias возможен через `trustedLabelsForExpense`, но его корректное получение требует stable seeded metadata; BUG-5 решается отдельно.
- Dataset на 5,000 synthetic rows покрывает детерминизм без brittle wall-clock threshold; реальный Home performance измеряется в SEARCH-01E.
- Merge в `main` не означает Web/Android deploy. DUP contributions и REPORTS-02.3 manual verification остаются актуальными.

## Не трогать

- Не подключать SEARCH-01A к Home до purchase-level модели SEARCH-01B: совпадение одной receipt item должно показывать полную покупку, но query AND остаётся в рамках одной item/Expense.
- Не переиспользовать merchant identity normalization: она транслитерирует кириллицу и удаляет legal suffixes, что запрещено для общего поиска.
- Не переводить пользовательские категории по совпадению текста; aliases принимаются только как доверенный caller input.
- Не добавлять global cache, network/database calls, amount search, ranking или новые зависимости в search engine.
- Сохранять DUP account/session/write guards и Web PDF lazy boundary; не включать `.env`, `supabase/.temp/*` или временные артефакты в коммиты.
