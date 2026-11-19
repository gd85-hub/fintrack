# HANDOFF — Fintrack
_Обновлено: 2026-11-19 · автор витка: Gleb · исполнитель: Claude Code_

Это краткая дельта. Долгий контекст и обязательные правила — в `README.md` и `AGENTS.md`.

## Где мы

DS-01.1b: цветовые привязки `components/ds/Button.tsx` доведены до конца — Surface, Outline и Ghost в активных состояниях берут подпись из `text.primary`, как в Figma. Все шесть типов сверены с компонентом. Подключение кнопки к экранам продолжается отдельными задачами (сделан `PeriodSelector`).

## Только что сделано

- `buttonSurface`: Surface и Ghost в Default/Hover/Pressed переведены с `action.secondary.content` на `text.primary` (Outline переехал в прошлой задаче). Фоновые токены и все Disabled-состояния не тронуты.
- Подтверждено по узлам: Surface `901:1218` / `901:1224` / `901:1230` и Ghost `591:1032` / `591:1041` / `591:1050` связывают подпись с `color/text/primary`; Surface Disabled `901:1243` — `action/secondary/disabled-fill` + `disabled-content`, без изменений.
- Значения `text.primary` и `action.secondary.content` совпадают в обеих темах (`#121b21` / `#f2f2f2`), так что видимых изменений нет: это выравнивание привязки, которое защищает от расхождения при будущей правке палитры.
- Тесты: в `figmaContract` обновлены ожидания Surface и Ghost, добавлен тест «Surface, Outline и Ghost подписываются `text/primary` в активных состояниях и `action/secondary/disabled-content` в disabled». `npm run typecheck` чисто, `npm test` — 34 набора / 380 тестов зелёные.

## Исправление прошлой записи

Запись от 2026-11-18 (коммит `edbfc88`) утверждала, что в наборе Button нет типа Surface, а Neutral — «отдельный набор `901:*`». **Это неверно.** Component Set Button `591:1212` содержит все 60 вариантов (6 типов × 2 размера × 5 состояний), включая Surface и Neutral. Ошибка возникла из-за негодного метода: я перечислял варианты грепом по префиксу id `591:` в выгрузке метаданных, а префикс node id в Figma **не определяет принадлежность к Component Set** — дочерние узлы одного сета могут иметь любые id. Вывод «Surface отсутствует» и «Neutral опубликован отдельно» надо считать отозванным; комментарии в тестах исправлены там же.

Практическое следствие для следующих задач: **принадлежность варианта проверять через parent/Plugin API, а не по префиксу id**.

## Состояние origin/main

Ветка `main`: `edbfc88` (DS-01.1) + текущий коммит DS-01.1b. В рабочем дереве остаётся **чужая незакоммиченная работа BE-01** (`AGENTS.md`, `BACKLOG.md`, `BUGS.md`, `README.md`, `lib/db/analytics.ts`, `lib/db/expenses.ts`, `lib/db/pagination.ts`, `lib/__tests__/pagination.test.ts`, `lib/__tests__/dbAnalytics.test.ts`, `lib/__tests__/homePurchaseGrouping.test.ts`, одна строка в `CHANGELOG.md`) — не тронута. `supabase/.temp/cli-latest` не трогался.

## Следующий шаг

Следующие экраны на DS Button. Параллельно открыты BE-01 и BUG-4.

## Открытые решения и риски

- Все шесть типов теперь сверены с компонентом по цветам: Primary `591:852`, Neutral `901:1156`/`901:1181`, Surface `901:1218`…`901:1243`, Outline `591:942`…`591:978`, Ghost `591:1032`…`591:1068`, Danger `591:1122`…`591:1158`. Large повторяет цвета Medium (проверено на `591:1023`, `591:1203`).
- **Несогласованность в самой Figma:** Outline Loading (`591:969`) связывает подпись с `action/secondary/content`, тогда как Default/Hover/Pressed — с `text/primary`. Значение одно; реализация использует `text.primary` для всех активных состояний.
- Видимых изменений в этой задаче нет, поэтому визуальная проверка не требовалась. Прошлая правка Outline/Danger (`edbfc88`) глазами по-прежнему не смотрелась: эти типы пока ни на одном экране не используются.
- Открытые расхождения по токенам вне Button (поля ввода на `radius.sm` вместо `radius/md`, высоты чипов, легаси `theme.radii.*` / `theme.sizes.*`, неподтверждённый `radius/xs`) остаются в силе.

## Не трогать

- Не возвращать подписям кнопок `action.secondary.content`: активные Surface/Outline/Ghost связаны с `text/primary`.
- Не менять Disabled-привязки и фоновые токены Surface/Ghost — они совпадают с Figma.
- Не определять состав Component Set по префиксу node id.
- Не включать `supabase/.temp/*`, `.env` и чужую незакоммиченную работу BE-01 в коммиты.
