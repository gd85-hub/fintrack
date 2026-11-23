# HANDOFF — Fintrack
_Обновлено: 2026-11-23 · автор витка: ChatGPT · исполнитель: Codex_

Это краткая дельта. Долгий контекст и обязательные правила — в `README.md` и `AGENTS.md`.

## Где мы

DS-SYNC-01 синхронизирует существующий `components/ds/Button.tsx` с актуальным Figma Component Set `591:1212` (60 вариантов). Публичный API и все продуктовые места использования сохранены.

## Только что сделано

- Проверены 6 типов × 2 размера × 5 состояний, свойства icon/trailing icon, loading и focused, включая внутренние Auto Layout-слои и variable bindings.
- Outline теперь использует `action.secondary.border` и `action.secondary.disabledBorder`, как в Figma; глобальные theme-токены не менялись.
- Иконки 20/24 px размещены в layout-слотах 16/20 px: leading смещён на −4, trailing остаётся на 0. Render callback получает локальный Button stroke 1.5; Feather-имена и deprecated `icon`/`iconPosition` сохранены.
- Остальная геометрия уже совпадала с Figma и не переписывалась: высота 48/56, radius 14/16, padding 20/24, gap 8, typography, spinner, focus ring, hug/full-width и блокировка повторного loading press.
- Button-секция `/ds-playground` расширена полной матрицей четырёх icon-конфигураций для всех типов/размеров и короткими/длинными подписями.
- Целевые тесты проверяют все 60 цветовых комбинаций и реальную анатомию icon slots; TypeScript и Web export проходят.

## Состояние origin/main

Ветка `main`, исходная точка — `a6b6d9a`; DS-SYNC-01 зафиксирован атомарным коммитом и готовится к push в `origin/main`. Локальный `supabase/.temp/cli-latest` не относится к задаче и не входит в коммит; `.env` не менялся.

## Следующий шаг

После публикации — ручное визуальное ревью `/ds-playground` на настоящем Web viewport 1024/375 в Light/Dark и Android на устройстве, затем следующий DS-компонент.

## Открытые решения и риски

- In-app браузер не имеет доступа к Windows localhost:8082, а повторная навигация к оставшейся вкладке localhost:8081 была заблокирована browser policy. Поэтому реальные mouse/Tab/Space и DOM-измерения 1024/375 не заявляются выполненными; interaction contracts проверены синтетически, Web bundle собран.
- Стандартный полный Jest-прогон встретил известный холодный 5-секундный timeout первого теста `expenseEditorScreen.test.tsx`; этот неизменённый suite проходит с `--testTimeout=30000`. Button suites проходят 87/87 с обычным timeout.
- Android на устройстве не запускался. Feather остаётся icon-font и не умеет применять stroke 1.5; точная метрика передаётся SVG render callback.

## Не трогать

- Не менять глобальный `theme.scale.stroke.icon` ради Button и не переносить локальный stroke 1.5 в IconButton/InputField/Checkbox.
- Не удалять deprecated `icon`/`iconPosition` до отдельной миграции callers.
- Не включать `supabase/.temp/*`, `.env` или другие локальные файлы в коммит.
