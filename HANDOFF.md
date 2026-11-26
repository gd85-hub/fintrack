# HANDOFF — Fintrack
_Обновлено: 2026-11-26 · автор витка: Claude · задача: EXPENSE-AMOUNT-01_

Это краткая дельта. Долгий контекст и обязательные правила — в `README.md` и `AGENTS.md`.

## Где мы

На write-слое введён единый инвариант: сохраняемая сумма расхода — строго положительное safe-integer число центов. Применён к ручным тратам и новым позициям чека. Схема, FX-формулы, refunds-модель и UI не менялись. Предыдущий виток (REPORTS-02.3, векторный PDF на Web) остаётся актуальным и ждёт ручной проверки после отдельного Web deploy.

## Только что сделано

- В `lib/money.ts` добавлен чистый helper `isPositiveCents(value): boolean` = `Number.isSafeInteger(value) && value > 0`. Это write-layer contract, отдельный от reports-only `exportPdfModel.assertCents`; `convertAll` сознательно не трогался (для чистой конверсии ноль допустим).
- `lib/db/expenses.ts`: `insertExpense` и `updateExpense` отклоняют невалидную сумму (`Сумма должна быть больше нуля.`) сразу после проверки валюты — **до** FX (`ratesForExpense`/`anchorRateForExpense`), чтения существующей строки и записи в Supabase.
- `lib/db/fiscalReceipts.ts`: `saveFiscalReceipt` проверяет каждую `input.expenses[].amountCents` через `isPositiveCents` сразу после проверки непустого списка — **до** FX, создания merchant и любых receipt/expense rows (partial receipt не создаётся). Сообщение `Исправьте суммы выбранных позиций.`
- `updateFiscalReceipt`/`validateReceiptEditExpenses`: поведение и сообщение не менялись; только убрано дублирование — `!Number.isSafeInteger(x) || x <= 0` заменено на `!isPositiveCents(x)` при сохранённой `=== null` проверке (для числа это тождественно).
- Тесты: `money.test.ts` — unit-таблица helper (accepted `1`/`100`/`MAX_SAFE_INTEGER`; rejected `0`/`-1`/`1.5`/`NaN`/`Infinity`/`MAX_SAFE+1`); `merchantRecency.test.ts` — insert `0` и update overflow отклоняются до FX/записи (`fromMock` не вызван); `receiptDisplayNames.test.ts` — receipt-item `0` отклоняется до любого write.

## Состояние origin/main

Ветка `main`. Один атомарный commit `fix(expenses): enforce positive amounts on write`, запушен в `origin/main`. Схема, миграции, FX-формулы, currency support, receipt reconciliation, UI, export и analytics не затронуты.

## Следующий шаг

Вернуться к висящему ручному этапу REPORTS-02.3: проверка Web PDF после отдельного Web deploy.

## Открытые решения и риски

- DB constraint `original_amount >= 0` по-прежнему допускает ноль на уровне БД — это осознанно не трогалось (задача без schema/migrations); гарантия обеспечивается приложением на write-слое.
- `convertAll` оставлен non-negative (ноль валиден для чистой математики); инвариант применяется только к financial write paths.
- `typecheck` зелёный; targeted money/expense/receipt тесты зелёные; полный `test:ci` 916/916.
- Остальные открытые риски — прежние, по REPORTS-02.3: фактическое browser/OS сохранение PDF остаётся manual verification.

## Не трогать

- Не менять `convertAll` на positive-only без аудита всех его callers; ноль там валиден.
- Не трогать DB schema/migrations, FX-формулы, refunds-модель, receipt reconciliation, UI, export, analytics.
- `isPositiveCents` — единый write-invariant; не заводить параллельные проверки с другим контрактом.
- Не переносить pdfmake/VFS в общий или native entry; Web PDF-движок должен оставаться lazy-loaded.
