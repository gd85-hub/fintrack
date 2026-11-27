# HANDOFF — Fintrack
_Обновлено: 2026-11-27 · автор витка: Claude · задача: DUP-01_

Это краткая дельта. Долгий контекст и обязательные правила — в `README.md` и `AGENTS.md`.

## Где мы

Добавлена чистая детерминированная логика определения вероятного дубля чека (`lib/receiptDuplicates.ts`) — первый шаг P0 «QR + photo duplicate protection». Только matching-логика: retrieval кандидатов, preflight в save-flow и предупреждение в UI — это DUP-02 и в этом витке не делались. Схема, RLS, FX, парсинг чеков и `saveFiscalReceipt` не менялись. Предыдущий виток (REPORTS-02.3, векторный PDF на Web) остаётся актуальным и ждёт ручной проверки после отдельного Web deploy.

## Только что сделано

- `lib/receiptDuplicates.ts`: `matchReceiptDuplicate(incoming, candidate)` — симметричный, pure. Вход `ReceiptDuplicateInput` (`totalCents`, `currency`, `occurredOn`, опц. `occurredAt`, `merchantId`, `merchantName`, `merchantLabel`, `taxId`) — только реально доступные/выводимые поля; стабильного фискального номера в контракте нет и он не выдумывается. Переиспользует `isPositiveCents`/`normalizeCurrencyCode` (money), `normalizeMerchantName` (receipts), `parseLocalISO` (dates).
- **Контракт matching (всё обязательно для probable):** совпадение положительного integer-cent `total`; совпадение нормализованной валюты; совпадение валидной локальной даты; «осмысленная» merchant-идентичность — равный `merchantId` ИЛИ равное нормализованное имя. **Усиление:** равный tax-id и совпадающий точный timestamp. **Блокировка:** конфликт известных tax-id, либо заметно разные известные времена. `null` никогда не равенство. Результат `{ isProbableDuplicate, confidence: 'confirmed'|'probable'|'none', evidence }`.
- **Confidence:** `confirmed` — все обязательные + совпавший точный timestamp (оба `occurredAt`, |Δ| ≤ 60 c — узкое окно только для суб-минутных различий форматирования одного и того же инстанта); `probable` — обязательные выполнены, но без timestamp-доказательства (напр. date-only OCR против QR); `none` — иначе или при блокировке. Локальная дата берётся из уже-локального `occurredOn` или литерального префикса `occurredAt` (без UTC-сдвига).
- Тесты: `lib/__tests__/receiptDuplicates.test.ts` (27) — QR↔OCR одного чека; дважды QR (confirmed) / дважды фото (probable); другая валюта/total/merchant/дата; конфликт tax-id; заметно разные времена; OCR без времени; нормализованное/кириллица-латиница имя; missing/invalid total/currency/date/merchant; custom-валюта; граница локальной даты без UTC-сдвига; детерминизм и симметрия. `supabase` замокан (helper её не использует).

## Состояние origin/main

Ветка `main`. Один атомарный commit `feat(receipts): add deterministic duplicate detection`, запушен в `origin/main`. Новый файл + тесты + docs; прикладной save/parse/UI не трогались.

## Следующий шаг

DUP-02: подключить `matchReceiptDuplicate` к save-flow и показать предупреждение (пользователь решает сам), без auto-merge/delete. Интеграция — ниже в «Открытых решениях».

## Открытые решения и риски

- **Интеграция DUP-02:** retrieval кандидатов — выбрать существующие чеки того же `user_id` за ту же локальную дату (и при наличии — тот же `merchant_id`/нормализованное имя и `total`) через общий paginated helper; маппить каждую строку `receipts` + входящий `ParsedReceipt` в `ReceiptDuplicateInput` (дату входящего — через `parsedReceiptDate`/префикс `occurredAt`); вызвать `matchReceiptDuplicate`; при `isProbableDuplicate` показать предупреждение в review перед сохранением. Save не блокировать и ничего не мёржить автоматически.
- **Ограничения:** нет стабильного фискального номера → абсолютная идентичность недоступна; `confirmed` опирается на точный timestamp. Две разные покупки с одинаковыми merchant/total/currency/датой и без времени классифицируются как probable (это предупреждение, не авто-действие).
- `typecheck` зелёный; targeted `receiptDuplicates` 27/27; полный `test:ci` — см. виток.
- Остальные открытые риски — прежние, по REPORTS-02.3: фактическое browser/OS сохранение PDF остаётся manual verification.

## Не трогать

- `matchReceiptDuplicate` — pure и детерминированный: без fuzzy-матчинга, произвольных весов, конвертации валют и спекулятивных идентификаторов. Timestamp-окно 60 c менять только с обоснованием.
- Не считать совпадение одного tax-id доказательством одной покупки; null не равенство.
- DUP-02 (retrieval/save/UI) здесь не реализован — не смешивать с этим витком.
- Не переносить pdfmake/VFS в общий или native entry; Web PDF-движок должен оставаться lazy-loaded.
