# HANDOFF — Fintrack
_Обновлено: 2026-11-12 · автор витка: ChatGPT · исполнитель: Codex_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

FX-12 подключил EUR-якорь к production-путям записи: новые supported-траты замораживают `amount_eur` напрямую от EUR-base курса `FxSource`, а legacy `amount_rsd`/`amount_usd` продолжают писаться через НБС. Display-пути не менялись, `ANCHOR_DISPLAY=false`.

## Только что сделано

- Добавлен `anchorRateForExpense`: EUR-паритет без запроса, resolve → lazy `sync-rates` → повторный resolve, затем понятная `AnchorRateUnavailableError`; отсутствие курса блокирует сохранение до первого insert.
- Ручная трата и сохранение/обновление чека резолвят якорный курс один раз на операцию и переиспользуют его для всех строк. EUR сохраняется точным равенством, RSD/USD — делением на прямой EUR-base курс с half-up.
- Экзотические валюты с ручным RSD-эквивалентом впервые получают `amount_eur` из распределённой RSD-доли; без ручного эквивалента `amount_eur` честно остаётся `null`, а `amount_usd`/`fx_rate_date` не фабрикуются.
- `sync-fx` переведён на insert-only через `ignoreDuplicates: true`, поэтому оба писателя `fx_rates` соблюдают write-once.
- **Проверено:** `npm run typecheck`; 26 Jest-съютов / 263 теста; Web export (1209 modules); Android Metro export (1640 modules). Удалённые Edge Functions и Supabase DB в этом витке не вызывались.

## Состояние origin/main

Ветка `main`; FX-12 подготовлен одним commit/push поверх FX-11 `755e396`.

## Следующий шаг

**FX-13:** SQL-верификация и backfill исторических строк. Выполнять только после явного подтверждения Глеба: это отдельный осознанный шаг на production-данных, не автоматическое продолжение FX-12.

## Открытые решения и риски

- `sync-rates` и обновлённый `sync-fx` требуют отдельного Supabase deploy и авторизованного smoke-test; локально проверены код, типы и чистая логика, но не удалённая таблица.
- Пока `ANCHOR_DISPLAY=false`, UI и аналитика продолжают читать legacy-тройку; включение нового display-пути отложено до FX-14.
- Migration `feedback` и другие pending Edge Functions по-прежнему требуют отдельного deploy перед tester round.
- `PASSWORD_RESET_UI` остаётся `false` до sending domain + custom SMTP и корректных redirect/Site URL настроек.

## Не трогать

- Legacy `amount_rsd`/`amount_usd` продолжают писаться до отдельно гейтируемого FX-17.
- NULL в якорь supported-траты не писать: если прямого курса нет после синка, сохранение блокируется целиком.
- Не запускать FX-13/backfill без явного подтверждения Глеба; applied migrations не менять.
- Не включать `ANCHOR_DISPLAY` и не менять Home/аналитику до FX-14.
- Итоги display-расчёта — только сумма построчно округлённых центов; итог или сумму якоря никогда не конвертировать целиком.
