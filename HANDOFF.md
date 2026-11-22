# HANDOFF — Fintrack
_Обновлено: 2026-11-22 · автор витка: ChatGPT · исполнитель: Codex_

Это краткая дельта. Долгий контекст и обязательные правила — в `README.md` и `AGENTS.md`.

## Где мы

DS-08.1 реализует самостоятельный `Toggle` по актуальному Figma set `107:91` (48 вариантов). Компонент добавлен только в DS и Playground; существующие настройки приложения не мигрированы.

## Только что сделано

- `components/ds/Toggle.tsx`: controlled API `checked` + `onChange`, размеры small/medium/large, позиции leading/trailing, disabled, label/description и обязательный `accessibilityLabel` без видимой подписи.
- Геометрия повторяет Figma: track 32×20 / 40×24 / 48×28, thumb 14 / 18 / 22 с inset 3, focus bounds +8, pill radius; touch target минимум 44×44.
- Добавлены только отсутствовавшие токены `control.trackOff` и `control.knob` для Light/Dark. Остальные состояния читают существующие semantic tokens; disabled не имитируется общей opacity.
- Вся строка — один `Pressable`/switch. Web получает явные `aria-checked`, `tabIndex`, Space handler с `preventDefault` и focus-visible ring; Native получает `accessibilityRole/state` без web-only key handler.
- Copy остаётся flex-колонкой с переносом; переключатель не сжимается. Неопределённый в Figma зазор control→copy взят из существующей DS-шкалы: `theme.scale.space[3]` (12).
- В `/ds-playground` добавлены все размеры/значения/disabled, leading/trailing, bare, label, description, interactive и длинные примеры в RU/EN.
- `lib/__tests__/dsToggle.test.tsx` покрывает 48 конфигураций, геометрию, tokens через labelled palette, hover/pressed, controlled behavior, disabled, layout, длинный текст, touch target, accessibility, Tab/Space и focus-ring contract.
- Thumb переключается мгновенно: анимация не добавлена, чтобы не вводить отдельную reduced-motion/Android ветку без инфраструктуры и зависимостей.

## Состояние origin/main

Ветка `main`, исходная точка синхронизирована с `origin/main` на `8f27e38`; DS-08.1 готовится одним commit/push. Локальный `supabase/.temp/cli-latest` не относится к задаче и не должен войти в коммит; `.env` не менялся.

## Следующий шаг

После публикации DS-08.1 — ручное визуальное ревью Toggle на реальном Web viewport 1024/375 в Light/Dark и Android, затем следующий DS-компонент или отдельная миграция существующих экранных switch по решению владельца.

## Открытые решения и риски

- Автоматизированное управление локальной браузерной вкладкой заблокировано Windows-средой: контроллер не смог надёжно определить URL. Поэтому настоящий mouse/Tab/Space прогон и 1024/375 Light/Dark не заявляются выполненными; unit/render tests и Web export остаются обязательными.
- Android на устройстве не запускался.
- Figma хранит скрытый Copy на `x=20` во всех размерах/позициях; рабочий flex-layout намеренно не повторяет эту координату.

## Не трогать

- Не мигрировать старые switch и не менять Button, IconButton, Checkbox, Radio, InputField, SearchField или продуктовые экраны в рамках DS-08.1.
- Не заменять semantic colors общей opacity и не уменьшать touch target ниже 44 px.
- Не добавлять анимацию без отдельного решения по reduced motion и проверки Android.
- Не включать `supabase/.temp/*`, `.env` или другие локальные файлы в коммит.
