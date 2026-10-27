# HANDOFF — Fintrack
_Обновлено: 2026-10-27 · автор витка: ChatGPT · исполнитель: Codex_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

Аналитика больше не ограничена одним месяцем: вместо стрелок есть selector периода с четырьмя пресетами и своим диапазоном. Экран разрешает период в inclusive ISO-границы и загружает категории, места и траты через range API из ANALYTICS-V2 #1.

## Только что сделано

- Этот коммит — **ANALYTICS-V2 #2: period selector**.
  - Добавлена чистая модель `Period`: Этот/Прошлый месяц, Последние 3 месяца, Этот год и Свой период; resolver возвращает inclusive `fromISO`/`toISO`.
  - Новый `PeriodSelector` — токенизированный bottom sheet с пресетами, custom From/To через существующий `DatePicker` и заблокированным Apply до валидных границ.
  - Экран аналитики переведён на `*ByRange`; месячные стрелки удалены. Возврат на Home с месяцем остался только для Этого/Прошлого месяца.
  - В RU/EN добавлен паритетный namespace `period.*`; Reports и range-query слой не менялись.
  - Тесты фиксируют inclusive bounds всех пресетов, pass-through custom-range и формат коротких labels.
- **Проверено:** `npm run typecheck` — чисто; `npm test` — 21 сьют / 173 теста зелёные; Web export и Android Metro export с `--no-bytecode` успешны; в новых файлах нет `any` и hardcoded hex.
- **НЕ проверено:** ручной авторизованный проход selector/DatePicker на Web и физическом Android. У Глеба остаётся untracked `BUGS.md`, он не изменён и не коммитится.

## Состояние origin/main

Ветка `main`. Этот виток — один коммит ANALYTICS-V2 #2 поверх `80fec58`: модель периода и тест, `PeriodSelector`, analytics screen, RU/EN, `HANDOFF.md` и append-only запись `CHANGELOG.md`. `.env`, Reports, DB range-query слой и пользовательский `BUGS.md` не затронуты. После push `origin/main` должен указывать на этот коммит.

## Следующий шаг

**ANALYTICS-V2 #3:** type tabs + top-7/Other + «Показать все», включая sort и average из снятого quick-wins промпта. Range model теперь стабилен, поэтому можно менять представление агрегатов без ещё одного data-layer шага.

## Открытые решения и риски

- Custom draft начинается с пустых границ; календарь пустого поля открывается на сегодня, Apply активен только при двух датах и `fromISO <= toISO`.
- Лейблы Этого/Прошлого месяца показывают календарное имя месяца; 3 месяца и год — короткие лейблы из контракта.
- Analytics остаётся read-only и читает сохранённые `amount_rsd/usd/eur`; FX не пересчитывается.
- Windows Application Control по-прежнему может блокировать `hermesc.exe`; JS Android bundle проверяется через `--no-bytecode`.
- Перед общим релизом остаются ручные проверки PDF export и light/dark на авторизованном Web и физическом Android.

## Не трогать

- Reports и его помесячную модель без отдельной задачи.
- `lib/db/analytics.ts`, FX/денежную математику, RLS, схему и применённые миграции.
- Прошлые записи `CHANGELOG.md`; релизный блок штамповать только после фактического deploy.
- Пользовательский untracked `BUGS.md`.
