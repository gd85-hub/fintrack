# HANDOFF — Fintrack
_Обновлено: 2026-11-26 · автор витка: Claude · задача: MERCHANT-02_

Это краткая дельта. Долгий контекст и обязательные правила — в `README.md` и `AGENTS.md`.

## Где мы

Создание дубликата места теперь обрабатывается явно: client-side preflight в `MerchantPicker` плюс typed DB-fallback на unique violation. DB schema/index, RLS, aliases, merge/delete, receipt matching и rename UX не менялись (rename лишь внутренне переиспользует общий helper). Предыдущий виток (REPORTS-02.3, векторный PDF на Web) остаётся актуальным и ждёт ручной проверки после отдельного Web deploy.

## Только что сделано

- `lib/merchantManagement.ts`: добавлен общий pure helper `findMerchantNameCollision(merchants, nextName, excludeMerchantId?)` с единым normalization contract (`normalizeMerchantName`). `findMerchantRenameCollision` переписан как тонкая обёртка над ним (`excludeMerchantId = merchantId`) — rename-семантика без изменений.
- `lib/db/merchants.ts`: добавлен typed `MerchantAlreadyExistsError` (поле `merchantName`). `createMerchant()` при Postgres `code === '23505'` бросает его (без парсинга текста сообщения); прочие DB-ошибки пробрасываются как раньше.
- `components/MerchantPicker.tsx`: перед `createMerchant()` — preflight через `findMerchantNameCollision` по уже загруженным `merchants`. При совпадении: `createMerchant` не вызывается, picker не закрывается, показывается inline `merchant.existsAdd` с именем существующего места; авто-выбор не делается. В catch `MerchantAlreadyExistsError` → тот же `merchant.existsAdd`; остальное → прежний `merchant.addFailed`.
- i18n: новый ключ `merchant.existsAdd` в `ru.ts`/`en.ts` (отдельно от `existsRename`, где совет про Merge).
- Тесты (`merchantManagement.test.ts`): `findMerchantNameCollision` (точное/регистр/пробелы/кириллица/другое имя/exclude id), `createMerchant` (`23505` → `MerchantAlreadyExistsError` с `merchantName`; прочая ошибка пробрасывается). MerchantPicker render-harness не заводился (его нет; логика покрыта pure-тестом).

## Состояние origin/main

Ветка `main`. Один атомарный commit `fix(merchants): handle duplicate creation`, запушен в `origin/main`. DB schema/index, migrations, RLS, aliases, merge/delete, receipt matching и search не затронуты.

## Следующий шаг

Вернуться к висящему ручному этапу REPORTS-02.3: проверка Web PDF после отдельного Web deploy.

## Открытые решения и риски

- Preflight использует состояние уже загруженного списка; гонку (другой клиент создал место после загрузки) закрывает DB unique index + `23505`-fallback. Оба пути ведут к одному сообщению `existsAdd`.
- Сообщение `existsAdd` при preflight показывает каноничное имя существующего места (`collision.name`), при `23505`-fallback — введённое имя (`error.merchantName`), т.к. строка существующей записи там недоступна.
- `typecheck` зелёный; targeted `merchantManagement.test.ts` 15/15; полный `test:ci` 920/920.
- Остальные открытые риски — прежние, по REPORTS-02.3: фактическое browser/OS сохранение PDF остаётся manual verification.

## Не трогать

- `findMerchantNameCollision` — единый источник normalization для create+rename; не заводить второй алгоритм нормализации.
- Не менять DB schema/index, migrations, RLS, aliases, merge/delete, receipt matching, search и rename UX (кроме внутреннего reuse helper).
- Не переносить pdfmake/VFS в общий или native entry; Web PDF-движок должен оставаться lazy-loaded.
