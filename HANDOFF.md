# HANDOFF — Fintrack
_Обновлено: 2026-11-18 · автор витка: Gleb · исполнитель: Claude Code_

Это краткая дельта. Долгий контекст и обязательные правила — в `README.md` и `AGENTS.md`.

## Где мы

DS-01.1: цвета Outline и Danger в `components/ds/Button.tsx` приведены к опубликованному компоненту Button в Figma. Остальные типы не менялись. Подключение кнопки к экранам продолжается отдельными задачами (сделан `PeriodSelector`).

## Только что сделано

Каждое расхождение подтверждено по первичным узлам Figma, а не по описанию задачи:

- **Outline**: убрана собственная заливка. `591:942` (Default) и `591:969` (Loading) не связывают ни одного fill-токена, поэтому фон теперь `transparent`, а не `surface.default`. Hover/Pressed (`591:951`, `591:960`) как и раньше — `state/hover` и `state/pressed`.
- **Outline Disabled** (`591:978`): фон остаётся `action.secondary.disabledFill`, но рамка теперь `border.default` вместо `action.secondary.disabledBorder` — в Figma в disabled связан именно `border/default`.
- **Outline, цвет текста**: в активных состояниях перепривязан на `text.primary` — так связано в `591:942`, `591:951`, `591:960`. Значение совпадает с прежним `action.secondary.content` в обеих темах, так что это выравнивание привязки, а не видимое изменение.
- **Danger Disabled** (`591:1158`, `591:1203`): фон `action.primary.disabled`, лейбл `action.primary.disabledContent`; destructive-токены в disabled в Figma не участвуют. В светлой теме фон реально меняется (#dadfe2 → #c7cdd1), в тёмной значения совпадают.
- Тесты переписаны под контракт, а не под хелперы: в `lib/__tests__/dsButton.test.ts` добавлена таблица `figmaContract` (ожидания выписаны из узлов Figma, с их id в комментариях) и прогоняется по 6 типам × 4 состояниям × 2 темам; в `dsButtonRender.test.tsx` добавлены render-проверки Outline (оба размера, обе темы, обычное и disabled) и Danger Disabled.
- Негативная проверка: те же тесты прогнаны против прежней реализации (`git stash` только `Button.tsx`) — 7 падений, то есть тесты действительно ловят регрессию.
- `npm run typecheck` чисто, `npm test` — 34 набора / 379 тестов зелёные.

## Состояние origin/main

Ветка `main`: `b879531` (DS-02.1) + текущий коммит DS-01.1. В рабочем дереве остаётся **чужая незакоммиченная работа BE-01** (`AGENTS.md`, `BACKLOG.md`, `BUGS.md`, `README.md`, `lib/db/analytics.ts`, `lib/db/expenses.ts`, `lib/db/pagination.ts`, `lib/__tests__/pagination.test.ts`, `lib/__tests__/dbAnalytics.test.ts`, `lib/__tests__/homePurchaseGrouping.test.ts`, одна строка в `CHANGELOG.md`) — не тронута. `supabase/.temp/cli-latest` не трогался.

## Следующий шаг

Следующие экраны на DS Button. Параллельно открыты BE-01 и BUG-4.

## Открытые решения и риски

- **Тип Surface не существует в наборе Figma `591:*`.** Там опубликованы только Primary, Outline, Ghost, Danger; Neutral — отдельным набором `901:*` (проверен: `901:1156` fill/content, `901:1181` наследует primary disabled, совпадает с реализацией). Цвета Surface в коде опираются на токены `action/secondary/*` и компонентом не подтверждаются.
- **Ghost**: в `591:1032` лейбл связан с `text/primary`, в коде — `action.secondary.content`. Значения совпадают в обеих темах, видимой разницы нет; не трогал, так как задача ограничена Outline и Danger.
- **Outline Loading** в Figma (`591:969`) связывает лейбл с `action/secondary/content`, а Default/Hover/Pressed — с `text/primary`. Это несогласованность самой Figma при одинаковом значении; реализация использует одну привязку (`text.primary`) для всех активных состояний.
- Прозрачный фон Outline означает, что hover/pressed-оверлеи теперь смешиваются с подложкой экрана, а не с белым/тёмным фоном кнопки. На светлой теме это почти незаметно, на тёмной даёт более честный контраст — но глазами не проверялось.
- Visually на устройстве изменение не смотрели: Outline/Danger пока ни на одном экране не используются.

## Не трогать

- Не возвращать Outline собственную заливку и не менять рамку в disabled: это прямая привязка Figma.
- Не «выравнивать» Ghost и Surface попутно — нужна отдельная задача и подтверждение в Figma (для Surface — сначала сам компонент).
- Не включать `supabase/.temp/*`, `.env` и чужую незакоммиченную работу BE-01 в коммиты.
