# HANDOFF — Fintrack
_Обновлено: 2026-11-18 · автор витка: Gleb · исполнитель: Claude Code_

Это краткая дельта. Долгий контекст и обязательные правила — в `README.md` и `AGENTS.md`.

## Где мы

DS-01 закрыт (Button полностью по контракту Figma). Следом проведена ревизия шкалы скруглений `scale.radius.*`: расхождения с опубликованной шкалой Figma устранены там, где каждое применение проверено по компонентам.

## Только что сделано

- Сверка по Figma (file `To2ACjDSo6M6rKaG6MErrR`): `radius/sm = 12`, `radius/md = 16`, `radius/lg = 20`, `radius/sheet = 28`, `radius/pill = 999`, `radius/button/medium = 14`, `radius/button/large = 16`. В коде `sm` было 10, `md` — 14; остальные совпадали.
- `scale.radius.sm` → 12, `scale.radius.md` → 16. Явные радиусы кнопки (14/16) не затронуты.
- Проверены **все** потребители `radius.md`: `components/ds/Toast.tsx` и `components/ds/StatusBanner.tsx` в Figma действительно привязаны к `radius/md = 16` — теперь совпадают. Два применения в `components/TabBar.tsx` (кнопка добавления и элемент маршрута в веб-сайдбаре) в Figma привязаны к `radius/sm = 12` — токен был выбран неверно, перевёл их на `radius.sm`.
- Потребители `radius.sm` (сегментные переключатели в аналитике и `PeriodSelector`, поля и дропдаун `AnalyticsCurrencyPicker`) получили +2 px и стали ближе к макету; для сегментных переключателей (`radius/sm`) значение теперь точное.
- `npm run typecheck` и `npm test` (34 набора, 373 теста) зелёные.

## Состояние origin/main

Ветка `main`: `f7b9f62` (Button целиком) + текущий коммит ревизии радиусов. В рабочем дереве остаётся **чужая незакоммиченная работа BE-01** (`AGENTS.md`, `BACKLOG.md`, `BUGS.md`, `README.md`, `lib/db/analytics.ts`, `lib/db/expenses.ts`, `lib/db/pagination.ts`, `lib/__tests__/pagination.test.ts`, `lib/__tests__/dbAnalytics.test.ts`, `lib/__tests__/homePurchaseGrouping.test.ts`, одна строка в `CHANGELOG.md`) — не тронута. `supabase/.temp/cli-latest` не трогался.

## Следующий шаг

Закрыть BE-01 и BUG-4. Подключение Button к экранам — отдельной задачей, экран за экраном.

## Открытые решения и риски

Ревизия вскрыла расхождения, которые **сознательно не правились** (нужны отдельные задачи — это уже не про скругления, а про привязку компонентов к токенам):

- **Поля ввода.** В Figma Input Field — `radius/md = 16` и `size/control-lg = 56`. В коде поля скруглены `radius.sm` (`PeriodSelector.dateField`, `AnalyticsCurrencyPicker.selector/options`), а `scale.size.fieldHeight` = 40.
- **`PeriodSelector.applyButton`** — это кнопка, скруглённая `radius.sm`; должна стать DS-компонентом Button (`radius/button/medium = 14`).
- **Мобильные элементы таб-бара** используют легаси `theme.radii.button = 10`, в Figma Tab Bar Item — `radius/sm = 12`.
- **Высоты чипов:** в Figma `size/chip-height = 32` и `size/chip-lg-height = 40`, в коде `scale.size.chipHeight` = 28 и `chipLgHeight` = 36.
- **`scale.radius.xs` = 6** — значения `radius/xs` в Figma не подтвердил: ни один проверенный компонент его не связывает. Единственное применение — внутренний сегмент `analytics.typeTab`.
- Легаси-карты `theme.radii.*` и `theme.sizes.*` живут параллельно `scale.*` и используются десятками экранов; их миграция — широкий рефакторинг токенов.
- Визуально на устройстве изменение скруглений не проверялось: правка затрагивает тосты, баннеры, сайдбар веба, сегментные переключатели и поля периода/валюты.

## Не трогать

- Не менять `radius.buttonMedium/buttonLarge` и их focus-варианты: это явный контракт Button.
- Не «выравнивать» легаси `theme.radii.*` / `theme.sizes.*` вместе со `scale.*` без отдельной задачи с ревизией потребителей.
- Не включать `supabase/.temp/*`, `.env` и чужую незакоммиченную работу BE-01 в коммиты.
