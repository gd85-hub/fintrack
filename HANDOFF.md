# HANDOFF — Fintrack
_Обновлено: 2026-11-06 · автор витка: ChatGPT · исполнитель: Codex_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

Receipt vision подготовлен к длинным чекам, снятым несколькими кадрами внахлёст: prompt теперь явно задаёт overlap-aware дедупликацию и сверку с печатным итогом.

## Только что сделано

- Prompt `analyze-receipt-image` трактует набор кадров как части одного длинного чека: физическую строку, повторившуюся в overlap, оставляет один раз, но одинаковые товары на разных печатных строках сохраняет раздельно.
- Модель упорядочивает позиции сверху вниз, сверяет сумму строк с grand total, не выдумывает пропущенные позиции и снижает confidence при неполном покрытии; изменение только prompt, без client/schema/validation/request-shape правок.
- **Проверено:** inserted block совпадает с заданием символ-в-символ (1688 символов, без апострофов); `deno check` и `npm run typecheck` чистые; полный `npm test -- --runInBand` — 23 сьюта / 212 тестов зелёные; Web export и Android Metro export с `--no-bytecode` успешны. Поведенческая проверка требует следующего deploy и реальных чеков.
- У Глеба остаются untracked `BUGS.md` и `DEPLOY.md`; они не изменены и не коммитятся.

## Состояние origin/main

Ветка `main`. RECEIPT-MULTI-1 идёт поверх `6ab2872` и содержит только prompt literal в `supabase/functions/analyze-receipt-image/index.ts`, `HANDOFF.md` и append-only запись в `CHANGELOG.md`. После push `origin/main` должен указывать на этот коммит.

## Следующий шаг

**Одним deploy выпустить pending `sync-fx` и `analyze-receipt-image`, затем проверить `fx_rates` и четыре vision-сценария.** До деплоя приложение продолжает использовать прежние production-функции.

## Открытые решения и риски

- Production deploy CURRENCY-1 и RECEIPT-MULTI-1 требует `supabase login`; автодеплоя в репозитории нет.
- После deploy проверить overlap-dedup, сохранение настоящих повторов, single-photo regression и честное снижение confidence при пропущенной секции.
- Ручной smoke-test повторного создания/edit/delete траты на Web и Android из предыдущего fix всё ещё не выполнен.
- Расхождение grouped-ввода денег с `AGENTS.md` и float-граница half-up остаются открытыми решениями.
- Budgets/limits пока не спроектированы: не выбирать модель, период или схему хранения без отдельного prompt/решения.

## Не трогать

- Датированные release-блоки `CHANGELOG.md` после публикации, кроме отдельной задачи на исправление факта.
- `outputSchema`, validators, `totalsMismatch`/confidence derivation, request shape и client receipt-flow без отдельной задачи.
- Клиентскую денежную математику, RLS, схему и применённые миграции до отдельного CURRENCY-2/schema prompt.
- Пользовательские untracked `BUGS.md` и `DEPLOY.md`.
