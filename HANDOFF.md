# HANDOFF — Fintrack
_Обновлено: 2026-10-26 · автор витка: ChatGPT · исполнитель: Codex_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

Трек **тёмной темы** дошёл до THEME-6: фундамент палитр, DS-компоненты, общий навигационный chrome, пикеры/инпуты, основные вкладки и экраны управления категориями/местами читают цвета через `useColors()` и реагируют на активную схему. Миграция пока частичная: analytics, receipt и auth-экраны ещё содержат статические `theme.color`/legacy `theme.colors`, поэтому селектор темы в Settings намеренно скрыт.

## Только что сделано

- Этот коммит — **THEME-6: management screens on dynamic colors**.
  - `app/(app)/categories.tsx` и `app/(app)/merchants.tsx` переведены на `useColors()` и `makeStyles` без изменения layout, поведения, validation, merge/delete-логики или non-color токенов.
  - Legacy-цвета сопоставлены с semantic-ролями: primary-кнопки используют fill/content, текстовые действия — link, destructive-текст — status error, поля — field border, выбранные строки и чипы — action container, checkmark — action icon, карточные hairline-границы — subtle border.
  - `ConfirmDialog` не менялся; Settings Theme row остаётся скрытым/disabled до финального этапа.
  - `CHANGELOG.md`: добавлена запись THEME-6 в `[Unreleased] → Changed`.
- **Проверено:** `npm run typecheck` — чисто; `npm test` — 20 сьютов / 165 тестов зелёные; в обоих экранах нет `theme.color.*`/`theme.colors.*` и `any`; Web export и Android Metro export с `--no-bytecode` успешны; `git diff --check` чист.
- **НЕ проверено:** ручной визуальный прогон light/dark на физическом Android-устройстве. У Глеба остаётся untracked `BUGS.md`, он не изменён и не коммитится.

## Состояние origin/main

Ветка `main`. Этот виток — один коммит THEME-6 поверх `21e2d91`; в него входят management-экраны categories/merchants, `HANDOFF.md` и одна append-only запись `CHANGELOG.md`. `.env` не затронут. Перед следующим витком — `git pull`.

## Следующий шаг

**THEME-7:** мигрировать analytics, receipt scan и auth-экраны на `useColors()`, используя ту же согласованную mapping-таблицу legacy → semantic. Settings-селектор темы раскрыть только в финальном migration-витке, когда не останется светлых островов.

## Открытые решения и риски

- Пять dark chart-ролей из foundation-промпта помечены как derived (`data.selection`, `data.label`, `data.muted`, `data.tooltipContent` и связанный chart-токен); при доступе к Figma их можно сверить отдельной values-only правкой.
- `theme.color` и legacy `theme.colors` намеренно остаются светлыми до миграции всех потребителей. При системной тёмной схеме уже мигрированные DS/chrome/picker/primary-tab/management поверхности тёмные, а оставшиеся экраны ещё светлые — это ожидаемое промежуточное состояние.
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
