# HANDOFF — Fintrack
_Обновлено: 2026-11-06 · автор витка: ChatGPT · исполнитель: Codex_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

Исправляется lifecycle ручного редактора трат: персистентный tab-screen больше не переносит заполненные поля и `saving=true` в следующее открытие формы.

## Только что сделано

- Wrapper `ExpenseEditorScreen` увеличивает `focusKey` при каждом focus и ремоунтит внутренний `ExpenseForm`: новая трата снова открывается пустой, edit заново заполняется загруженной тратой, `saving` сбрасывается через state initializer.
- Data-loading effect не зависит от `focusKey`, поэтому повторный focus не добавляет сетевых загрузок; validation, conversion, save/update/delete не менялись.
- **Проверено:** `npm run typecheck` — чисто; полный `npm test -- --runInBand` — 23 сьюта / 212 тестов зелёные; Web export и Android Metro export с `--no-bytecode` успешны. Ручной повторный create/edit/delete smoke-test на запущенных Web/Android не выполнялся.
- У Глеба остаются untracked `BUGS.md` и `DEPLOY.md`; они не изменены и не коммитятся.

## Состояние origin/main

Ветка `main`. Fix-коммит идёт поверх `b2b9628` и содержит только `components/ExpenseEditorScreen.tsx`, `HANDOFF.md` и append-only запись в `CHANGELOG.md`. После push `origin/main` должен указывать на этот коммит.

## Следующий шаг

**Спроектировать multi-photo receipt capture с overlap-aware AI.** Это следующий крупный пользовательский сценарий; lifecycle-fix редактора изолирован и не требует дальнейшего расширения.

## Открытые решения и риски

- Ручной smoke-test повторного создания и edit/delete на Web и Android остаётся обязательным, если среды недоступны в автоматическом прогоне.
- Production deploy CURRENCY-1 и проверка idempotent-upsert в `fx_rates` всё ещё требуют `supabase login`; автодеплоя в репозитории нет.
- Расхождение grouped-ввода денег с `AGENTS.md` и float-граница half-up остаются открытыми решениями.
- Budgets/limits пока не спроектированы: не выбирать модель, период или схему хранения без отдельного prompt/решения.

## Не трогать

- Датированные release-блоки `CHANGELOG.md` после публикации, кроме отдельной задачи на исправление факта.
- Навигационную регистрацию `expense/new`, validation/conversion/save/delete и загрузочный effect редактора без отдельной задачи.
- Клиентскую денежную математику, RLS, схему и применённые миграции до отдельного CURRENCY-2/schema prompt.
- Пользовательские untracked `BUGS.md` и `DEPLOY.md`.
