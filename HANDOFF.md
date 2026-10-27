# HANDOFF — Fintrack
_Обновлено: 2026-10-27 · автор витка: ChatGPT · исполнитель: Codex_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

Data-layer аналитики теперь поддерживает произвольные включительные диапазоны дат для категорий, мест и списка трат. Текущий экран по-прежнему работает помесячно: прежние month-функции сохранены и делегируют в общие private `*Between` cores. Это backend-фундамент ANALYTICS-V2 #1 без пользовательских изменений; следующий шаг — selector периода в UI.

## Только что сделано

- Этот коммит — **ANALYTICS-V2 #1: range-based analytics backend**.
  - Добавлены `categoryBreakdownByRange`, `merchantBreakdownByRange` и `listExpensesForRange` с включительными `fromISO`/`toISO`.
  - Месячные функции теперь только получают границы через `monthBounds` и делегируют в private `categoryBreakdownBetween`, `merchantBreakdownBetween` и `listExpensesBetween`.
  - Select-строки, cents-конвертация, Map-агрегация, unknown-merchant key, формы результата и сортировка списка не менялись; `buildFixedVariableBreakdown` не затронут.
  - Тесты проверяют равенство month/range на одинаковых границах, передачу inclusive bounds, сохранение сортировки и совпадение grand totals с суммой групп.
  - `CHANGELOG.md`: добавлена запись ANALYTICS-V2 #1 в `[Unreleased] → Added`.
- **Проверено:** `npm run typecheck` — чисто; `npm test` — 20 сьютов / 167 тестов зелёные; Web export и Android Metro export с `--no-bytecode` успешны; analytics-модуль остаётся read-only и не пересчитывает FX.
- **НЕ проверено:** реальные Supabase range-запросы на пользовательских данных и UI-переключение периода — selector ещё не реализован. У Глеба остаётся untracked `BUGS.md`, он не изменён и не коммитится.

## Состояние origin/main

Ветка `main`. Этот виток — один коммит ANALYTICS-V2 #1 поверх `019183b`: `lib/db/analytics.ts`, его существующий тест, `HANDOFF.md` и одна append-only запись `CHANGELOG.md`. Экран аналитики, barrel, схема, зависимости, `.env` и пользовательский `BUGS.md` не затронуты. После push `origin/main` должен указывать на этот коммит.

## Следующий шаг

**ANALYTICS-V2 #2:** добавить selector периода (bottom sheet: этот/прошлый месяц, 3 месяца, год, свой диапазон) и переключить экран между month/range API. Backend для этого уже готов; UI должен формировать локальные ISO-даты через `lib/dates.ts` без UTC shortcuts.

## Открытые решения и риски

- Range API намеренно не валидирует и не переставляет границы: контракт следующего UI — передавать валидные `YYYY-MM-DD` и `fromISO <= toISO`.
- Текущий analytics screen продолжает вызывать month-функции; пользовательского изменения не будет до ANALYTICS-V2 #2.
- Все range-запросы читают уже сохранённые `amount_rsd/usd/eur`; FX никогда не пересчитывается на чтении.
- Windows Application Control по-прежнему блокирует локальный `hermesc.exe`; JS Android bundle собирается, полноценный Hermes export/EAS build нужно повторить в разрешённой среде.
- Перед общим релизом остаются ручные проверки PDF export и light/dark на авторизованном Web и физическом Android из предыдущего витка.
- История проекта: `CHANGELOG.md` append-only; `HANDOFF.md` переписывается каждый виток — оба тем же коммитом.

## Не трогать

- `buildFixedVariableBreakdown`, select-строки и формы analytics-результатов без отдельной задачи.
- Текущий экран аналитики и UI периода до ANALYTICS-V2 #2.
- FX/денежную математику, RLS, схему и применённые миграции.
- Прошлые записи `CHANGELOG.md`; релизный блок штамповать только после фактического deploy.
- Пользовательский untracked `BUGS.md`.
