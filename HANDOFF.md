# HANDOFF — Fintrack
_Обновлено: 2026-10-26 · автор витка: ChatGPT · исполнитель: Codex_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

Трек **тёмной темы** дошёл до THEME-7: фундамент палитр, DS-компоненты, общий навигационный chrome, пикеры/инпуты, основные вкладки, экраны управления, аналитика, сканирование чека и авторизация читают цвета через `useColors()` и реагируют на активную схему. Миграция почти завершена: статические цвета остаются прежде всего в review чека и редакторе траты, поэтому селектор темы в Settings всё ещё намеренно скрыт.

## Только что сделано

- Этот коммит — **THEME-7: analytics, receipt scan and auth on dynamic colors**.
  - `app/(app)/analytics.tsx`, `app/(app)/receipt/scan.tsx`, `app/(auth)/sign-in.tsx` и `app/(auth)/sign-up.tsx` переведены на `useColors()` и `makeStyles` без изменения layout, навигации, запросов, scan/auth-логики или non-color токенов.
  - Цвета аналитики теперь берутся из активной chart-палитры: хешированные серии — `data.categorical`, неизвестные значения — `data.muted`, fixed — `data.categorical[2]`, variable — `data.selection`.
  - Legacy-цвета сканирования и авторизации сопоставлены с semantic-ролями полей, действий, поверхностей и статусов; web/native ветки сканирования сохранены.
  - Settings Theme row остаётся скрытым/disabled до финального этапа.
  - `CHANGELOG.md`: добавлена запись THEME-7 в `[Unreleased] → Changed`.
- **Проверено:** `npm run typecheck` — чисто; `npm test` — 20 сьютов / 165 тестов зелёные; в четырёх экранах нет `theme.color.*`/`theme.colors.*` и `any`; Web export и Android Metro export с `--no-bytecode` успешны; `git diff --check` чист.
- **НЕ проверено:** ручной визуальный прогон light/dark на физическом Android-устройстве. У Глеба остаётся untracked `BUGS.md`, он не изменён и не коммитится.

## Состояние origin/main

Ветка `main`. Этот виток — один коммит THEME-7 поверх `737d19d`; в него входят четыре экрана, `HANDOFF.md` и одна append-only запись `CHANGELOG.md`. `.env` не затронут. Перед следующим витком — `git pull`.

## Следующий шаг

**THEME-8:** мигрировать два последних крупных экрана — receipt review и expense editor — на `useColors()`, затем проверить отсутствие светлых островов и только после этого раскрыть Settings-селектор темы.

## Открытые решения и риски

- Пять dark chart-ролей из foundation-промпта помечены как derived (`data.selection`, `data.label`, `data.muted`, `data.tooltipContent` и связанный chart-токен); при доступе к Figma их можно сверить отдельной values-only правкой.
- `theme.color` и legacy `theme.colors` намеренно остаются светлыми до миграции всех потребителей. При системной тёмной схеме уже мигрированные поверхности тёмные, а оставшиеся review/editor экраны ещё светлые — это ожидаемое промежуточное состояние.
- `Colors = typeof lightColor` сохраняет literal-типы светлой палитры; `darkColor` отдельно проверяется через `satisfies ColorShape<Colors>`. В фабриках стилей нужен локальный безопасный cast результата `useColors()` к `Colors`, пока публичный тип палитры не будет расширен без изменения runtime-значений.
- Windows Application Control блокирует локальный `hermesc.exe`; полноценный Hermes export/EAS Android и ручной device-run нужно повторить в разрешённой среде. JS Android bundle собирается.
- История проекта: `CHANGELOG.md` append-only; `HANDOFF.md` переписывается каждый виток — оба тем же коммитом.
- Экспорт использует нативные `expo-print`/`expo-sharing`/`expo-file-system`; свежий Android-билд всё ещё обязателен перед релизом.

## Не трогать

- Settings → Theme до финального этапа миграции; не показывать переключатель при частично мигрированном UI.
- Существующие значения светлого `theme.color`, legacy `theme.colors`/`fontSizes`/`radii`/`spacing`/`sizes` до миграции конкретных потребителей.
- Защитные `throw new Error(...)`, FX/денежную математику, парсинг чеков, RLS и применённые миграции.
- `lib/export.ts` и формат экспорта без отдельной задачи и обновления тестов.
- Прошлые записи `CHANGELOG.md`; только append в текущий `[Unreleased]`.
- Структуру Home (`FlatList` карточек дней, нестики-заголовки, RSD hero) и серверный фетч чека (HTML качает устройство).
