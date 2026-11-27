# HANDOFF — Fintrack
_Обновлено: 2026-11-27 · автор витка: Claude · задача: DUP-02A_

Это краткая дельта. Долгий контекст и обязательные правила — в `README.md` и `AGENTS.md`.

## Где мы

Добавлен read-only репозиторный `findReceiptDuplicates`: по входящему чеку возвращает существующие вероятные дубли аккаунта. Это data-access часть DUP-02; пользовательская интеграция (предупреждение в review/save) — DUP-02B, здесь НЕ сделана. Save-flow, OCR/QR-парсинг, схема, RLS и FX не менялись. Предыдущий виток (REPORTS-02.3, векторный PDF на Web) остаётся актуальным и ждёт ручной проверки после отдельного Web deploy.

## Только что сделано

- `lib/db/receiptDuplicates.ts` → `findReceiptDuplicates(incoming)`:
  - **Контракт даты кандидата:** кандидаты — чеки, у которых есть expense на ту же локальную дату (`expenses.occurred_on`, авторитетная сохранённая дата). НЕ выводится из `receipts.occurred_at` (timestamptz может не сохранить локальный префикс) и НЕ из OCR `raw_json` (там может быть до-подтверждённый ответ модели). Дата кандидата берётся из сопоставленной `expenses.occurred_on`.
  - **Account isolation:** `authenticatedUserId()` + явный `.eq('user_id', userId)` на обоих запросах, поверх RLS.
  - **Query/пагинация:** два запроса — expenses (`select id,receipt_id,occurred_on` c `.eq(user).eq(occurred_on).not(receipt_id is null)`) и receipts (`.in('id', receiptIds)` с embed `merchant:merchants!receipts_merchant_id_fkey(name)`). Оба через `fetchAllRows` с `order('id')`. Не фильтруется по merchant_id (имя-матчинг QR/OCR остаётся возможным). Один чек → один кандидат (dedupe `receipt_id`); saved `total`/`currency`, не суммы конвертаций. Ошибка любой страницы пробрасывается (не превращается в «дублей нет»).
  - **Return:** `ReceiptDuplicateCandidate[]` = `{ receiptId, source, merchantId, merchantName, merchantLabel, occurredOn, occurredAt, totalCents, currency, match }` (включая evidence/confidence из `matchReceiptDuplicate`). Пусто при отсутствии совпадений и при невалидной входящей дате.
- Hardening матчера `lib/receiptDuplicates.ts`: `confidence 'confirmed'` → `'strong'` (ни одно поле не доказывает абсолютную идентичность — всё advisory); `parseInstant` требует явный offset/`Z` (offset-less/битые метки не становятся exact-time доказательством через локальный `Date.parse`); fallback: пустое имя места → осмысленный label. Консервативная политика и 60-сек допуск сохранены.
- Тесты: `lib/__tests__/dbReceiptDuplicates.test.ts` (13, mocked Supabase, table-keyed dispatch + пагинация) и расширенный `lib/__tests__/receiptDuplicates.test.ts` (30, +boundary 00:15 +01:00, label-fallback, offset-less timestamp).

## Состояние origin/main

Ветка `main`. Один атомарный commit `feat(receipts): retrieve probable duplicate candidates`, запушен в `origin/main`. Новый репозиторный файл + hardening матчера + тесты + docs; save/parse/UI не трогались.

## Следующий шаг

DUP-02B: вызвать `findReceiptDuplicates` в review/save flow (построить `IncomingReceiptForDuplicates` из `ParsedReceipt`: дату — через `parsedReceiptDate`), при непустом результате показать advisory-предупреждение; пользователь решает. Без auto-merge/delete/блокировки.

## Открытые решения и риски

- Пользовательской защиты ещё НЕТ — только retrieval. Не заявлять, что защита от дублей завершена.
- `confirmed`→`strong`: даже сильный матч advisory (нет стабильного фискального номера). Timestamp-доказательство — только при явном offset.
- Если входящая дата невалидна — `findReceiptDuplicates` возвращает `[]` (не ошибка): нет базы для account-scoped выборки.
- `typecheck` зелёный; targeted `dbReceiptDuplicates` 13/13, `receiptDuplicates` 30/30; полный `test:ci` — см. виток.
- Остальные открытые риски — прежние, по REPORTS-02.3: фактическое browser/OS сохранение PDF остаётся manual verification.

## Не трогать

- Дата кандидата — только из `expenses.occurred_on`; не выводить из `receipts.occurred_at`/`raw_json`.
- Не фильтровать кандидатов исключительно по `merchant_id` (сломает QR/OCR имя-матчинг).
- `matchReceiptDuplicate` остаётся pure/детерминированным; 60-сек окно и политику менять только с обоснованием.
- DUP-02B (review/save/UI) здесь не реализован — не смешивать.
- Не переносить pdfmake/VFS в общий или native entry; Web PDF-движок должен оставаться lazy-loaded.
