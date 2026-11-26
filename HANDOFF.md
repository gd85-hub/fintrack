# HANDOFF — Fintrack
_Обновлено: 2026-11-26 · автор витка: Claude · задача: RECEIPT-01_

Это краткая дельта. Долгий контекст и обязательные правила — в `README.md` и `AGENTS.md`.

## Где мы

`saveFiscalReceipt` теперь удаляет merchant, созданный именно этим save-flow, если сохранение чека не завершилось успешно. Схема, RLS, FX, receipt parsing/editing, merge/duplicate logic и UI не менялись. Предыдущий виток (REPORTS-02.3, векторный PDF на Web) остаётся актуальным и ждёт ручной проверки после отдельного Web deploy.

## Только что сделано

- `lib/db/fiscalReceipts.ts` → `saveFiscalReceipt`: добавлен `createdMerchantId` (non-null только когда merchant создан этим вызовом). В compensating cleanup (`catch`): если receipt создавался — чистятся expenses, затем receipt (прежняя последовательность), с флагом `dependentCleanupOk`. Созданный merchant удаляется (`delete().eq('id').eq('user_id')`) только когда `createdMerchantId !== null` и зависимые строки убраны успешно (или receipt вообще не создавался). Existing merchant (`{ existingId }`) не трогается. Ошибка merchant-cleanup логируется (`Unable to clean up newly created merchant:`) и не заменяет исходную save-ошибку.
- Тесты: в `lib/__tests__/receiptDisplayNames.test.ts` добавлен блок `saveFiscalReceipt failure cleanup` (A–E): new+receipt-fail → merchant удалён, expenses insert не вызван; new+expense-fail → cleanup expenses/receipt → merchant удалён; existing+expense-fail → merchant delete не вызван; dependent-cleanup-fail → merchant сохранён; merchant-cleanup-fail → исходная ошибка всё равно брошена (+ scoped `console.error` spy с restore).
- `BUGS.md`: добавлен `BUG-10` (fixed).

## Состояние origin/main

Ветка `main`. Один атомарный commit `fix(receipts): clean up orphan merchants on failed save`, запушен в `origin/main`. Схема, миграции, RLS, FX, receipt parsing/editing, merge/duplicate detection и UI не затронуты.

## Следующий шаг

Вернуться к висящему ручному этапу REPORTS-02.3: проверка Web PDF после отдельного Web deploy.

## Открытые решения и риски

- Это НЕ транзакция: при частичном сбое cleanup (expenses/receipt) merchant сознательно сохраняется, чтобы не оставить зависимую строку без ссылки. Полная SQL-транзакция save — отдельная архитектурная задача, если понадобится.
- Docs-only: закрыты два audit-only backlog-пункта — `EXPENSE-01` (RLS уже ограничивает `user_id = auth.uid()`, второй filter не добавлялся) и `CATEGORY-01` (repository trim/required валидация есть; дубли имён намеренно разрешены и решаются через Merge). Application code для них не менялся.
- `typecheck` зелёный; targeted `receiptDisplayNames` 10/10; полный `test:ci` — см. ниже.
- Остальные открытые риски — прежние, по REPORTS-02.3: фактическое browser/OS сохранение PDF остаётся manual verification.

## Не трогать

- Не превращать `saveFiscalReceipt` в SQL-транзакцию/RPC без отдельной задачи; не менять merge/duplicate logic, `MerchantAlreadyExistsError`, receipt parsing/editing, FX, схему, RLS, UI.
- Не удалять existing merchant (`{ existingId }`) в cleanup ни при каких обстоятельствах.
- Не удалять созданный merchant, если cleanup зависимых строк не удался.
- Не переносить pdfmake/VFS в общий или native entry; Web PDF-движок должен оставаться lazy-loaded.
