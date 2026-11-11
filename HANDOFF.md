# HANDOFF — Fintrack
_Обновлено: 2026-11-11 · автор витка: ChatGPT · исполнитель: Codex_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

Текущий фокус — страна-агностичное валютное ядро с EUR-якорем. FX-10 добавляет серверный write-once синк устоявшихся курсов Frankfurter рядом с прежним НБС-контуром; клиент пока продолжает работать по старой модели до FX-11.

## Только что сделано

- Добавлен чистый контракт `FxSource` и парсер Frankfurter v2: валидирует фактические даты, EUR-base, ISO-коды и положительные числовые курсы, сохраняет раннюю публикационную дату и первый дубликат `(date, code)`.
- Добавлена Edge Function `sync-rates`: источник выбирается через `FX_SOURCE`, текущая/будущая дата клампится ко вчерашней Europe/Belgrade, клампленные даты дедуплицируются, а строки пишутся как `EUR -> quote` с датой котировки.
- Запись в `fx_rates` insert-only через `upsert(... ignoreDuplicates: true)`: существующие Frankfurter и legacy НБС-строки не перезаписываются. `sync-fx` и клиентский `lib/fx.ts` не менялись.
- Реальный Frankfurter v2 за 2025-03-14 подтвердил массив `{date, base, quote, rate}`; 12 строк сохранены inline-fixture. Тесты покрывают malformed payload, EUR-anchor, будущие/ранние даты, дубликаты, календарную валидацию и settled-date clamp через месяц/год.
- **Проверено:** `npm run typecheck`; 24 Jest-съюта / 230 тестов; Web export (1207 modules); Android Metro export (1638 modules). Локальный Deno runtime отсутствует; Edge Function не деплоилась и runtime smoke-test не выполнялся.

## Состояние origin/main

Ветка `main`; FX-10 готовится одним commit/push поверх FEEDBACK-3b `6713809`.

## Следующий шаг

**FX-11:** клиентское разрешение якорных курсов из EUR-графа, сохраняя замороженные конверсии на дату траты; затем отдельно deploy/smoke `sync-rates` и исторический backfill в FX-13.

## Открытые решения и риски

- `sync-rates` требует отдельного Supabase deploy и авторизованного POST smoke-test; в этом витке проверена чистая логика, но не Edge runtime/Supabase write.
- До FX-11 клиент остаётся на `sync-fx`/НБС и не потребляет новые EUR-якорные строки.
- Migration `feedback` и другие pending Edge Functions по-прежнему требуют отдельного deploy перед tester round.
- `PASSWORD_RESET_UI` остаётся `false` до sending domain + custom SMTP и корректных redirect/Site URL настроек.

## Не трогать

- `fx_rates` — write-once: существующие строки не перезаписывать; сегодняшние и будущие даты не синхронизировать, сначала клампить ко вчерашней дате Europe/Belgrade.
- Не заменять и не менять `sync-fx` до отдельного этапа; НБС-контур продолжает работать рядом.
- Не запускать исторический backfill до FX-13 и не переводить клиент на EUR-якорь до FX-11.
- Не менять денежную математику, RLS, applied migrations и service-role boundary без отдельной задачи.
