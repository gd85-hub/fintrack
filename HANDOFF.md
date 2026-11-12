# HANDOFF — Fintrack
_Обновлено: 2026-11-12 · автор витка: ChatGPT · исполнитель: Claude Code_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

**RQ-1 сделан: заведён харнесс мерила** качества фото-распознавания чеков. Это только инструмент измерения — приложение, Edge Functions, vision-промпт и схема БД не менялись; харнесс read-only читает прод через существующие API. Дизайн эпика — `claude/архитектура/распознавание-чеков-точность.md`, идея мерила — §2.2. Параллельный **FX-трек** (FX-12 влит) этим витком не затрагивался и ждёт своего шага.

## Только что сделано

- Этот коммит — **RQ-1: харнесс пар «QR-истина + фото»**.
  - `scripts/receiptEvalCore.js` — чистая логика (CommonJS, ноль зависимостей, ноль I/O): матчинг позиций в два прохода (точный по `lineTotalCents` жадно в порядке печати — повторяющиеся цены не схлопываются; затем по именам среди остатков, порог общих токенов 0.5 → `matchedWrongTotal`), метрики пары и агрегация прогона.
  - Метрики пары: `truthCount`, `matchedExact`, `matchedWrongTotal`, `missed`, `phantom`, `totalRead`, `reconciled`, `dateCorrect`, `confidence`, `flagged`, `silentError`. Агрегаты: phantom rate, item recall, line-total exactness, total-read / reconciliation / date accuracy, calibration по уровням confidence и **silent-error rate — метрика №1**.
  - Даты: календарная дата считается через `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Belgrade' })`, **не** через `toISOString()` (тест фиксирует, что вечерний UTC-штамп 22:30Z даёт следующий день в Белграде).
  - `scripts/receipt-eval.js` — CLI (Node 18+, только `node:fs`/`node:path`/глобальный `fetch`): `list` (последние 20 QR-чеков владельца — id для имён папок) и `run` (фото → base64 → задеплоенный `analyze-receipt-image` → метрики → `eval-report.json` + сводка в консоль, печатает `vision calls made: N`). Таймаут вызова 60 с; пара без чека/без `raw_json.items` → `skipped`, ошибка вызова → `failed`, прогон не падает. Шапка файла документирует формат папки, env и запуск.
  - `lib/__tests__/receiptEvalCore.test.ts` — 9 тестов на все 8 кейсов из задания, данные только синтетические (вымышленные товары и суммы).
  - `tsconfig.json`: в `exclude` добавлен `scripts` (plain JS не ломает `npm run typecheck`).
- **Сверено с реальным кодом** (а не по памяти): `receipts.raw_json` = `ParsedReceipt` без поля `raw`, то есть содержит `items[].name/lineTotalCents`, `totalCents`, `occurredAt`; `source='fiscal_qr'`; колонка `merchant_label` существует; `analyze-receipt-image` принимает `{ images: base64[], categories:[{id,name}], merchantTypes:[{slug,name}] }` и не больше 5 фото — CLI обрезает лишние и говорит об этом.
- **Проверено:** `npm run typecheck` — чисто; `npm test` — **27 сьютов / 272 теста** зелёные; `node scripts/receipt-eval.js` без аргументов и без env падает с внятной ошибкой и exit 1; в новых файлах нет секретов и ни одного реального чека.
- **НЕ проверено (нужен аккаунт Глеба):** `list` и `run` против прода — логин, REST-выборки и платные vision-вызовы локально не запускались.
- Зависимостей не добавлено. Ничего из «вне скоупа» не сделано: приложение, Edge Functions, vision-промпт, схема БД не тронуты; записей в базу харнесс не делает.

## Состояние origin/main

Ветка `main`. Этот виток — один коммит (`scripts/receiptEvalCore.js`, `scripts/receipt-eval.js`, `lib/__tests__/receiptEvalCore.test.ts`, `tsconfig.json`, `HANDOFF.md`, `CHANGELOG.md`) поверх `4a6935a` (FX-12). `.env` в gitignore и не стейджился. Перед следующим витком — `git pull`.

## Следующий шаг

1. **Копить пары** — цель ~20. Ручной труд минимален: отсканировать чек по QR в приложении, сфотографировать бумажку, `node --env-file=.env scripts/receipt-eval.js list`, скопировать id в имя папки в `RECEIPT_EVAL_DIR`, положить фото. Раньше ~20 пар числа шумные, по ним решений не принимаем.
2. **RQ-2 — судьба честного null**: что делает приложение, когда модель не уверена (низкий confidence / несведённый итог) — отдельный промпт по дизайну эпика.

Для `list`/`run` нужны env: `RECEIPT_EVAL_DIR`, `EVAL_EMAIL`, `EVAL_PASSWORD` (в `.env` их по умолчанию нет — добавить локально, не коммитить) плюс уже существующие `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## Открытые решения и риски

- **Каждый `run` платный**: один vision-вызов на пару. Прогонять осознанно; счётчик печатается в конце.
- **Порог матчинга по именам 0.5** (доля общих токенов от более длинного имени) — эвристика; если на реальных парах она начнёт склеивать разные товары, править в `receiptEvalCore.js` вместе с тестами.
- Матчинг не декодирует QR с фото и не подбирает пары сам — пара задаётся **именем папки**; ошибка в id видна как `skipped: receipt not found`.
- `sync-rates` и обновлённый `sync-fx` по-прежнему требуют отдельного Supabase deploy и авторизованного smoke-test (FX-трек).
- Пока `ANCHOR_DISPLAY=false`, UI и аналитика читают legacy-тройку; новый display-путь отложен.
- Migration `feedback` и другие pending Edge Functions требуют отдельного deploy перед tester round.
- `PASSWORD_RESET_UI` остаётся `false` до sending domain + custom SMTP и корректных redirect/Site URL.

## Не трогать

- **`RECEIPT_EVAL_DIR` и отчёты живут вне репо.** Репозиторий публичный: ни фото чека, ни `eval-report.json`, ни реальной суммы или названия места в коммите. В репо — только код харнесса и синтетические данные тестов.
- Харнесс strictly read-only: никаких записей в базу (вызов `analyze-receipt-image` ничего не пишет). Прод-прокси SQL-метрики — отдельный ручной файл у Глеба, в скрипт не тащить.
- Legacy `amount_rsd`/`amount_usd` продолжают писаться до отдельно гейтируемого шага FX-трека.
- NULL в якорь supported-траты не писать: если прямого курса нет после синка, сохранение блокируется целиком.
- Не запускать FX-13/backfill без явного подтверждения Глеба; applied migrations не менять.
- Не включать `ANCHOR_DISPLAY` и не менять Home/аналитику до соответствующего шага FX-трека.
- Итоги display-расчёта — только сумма построчно округлённых центов; итог или сумму якоря никогда не конвертировать целиком.
