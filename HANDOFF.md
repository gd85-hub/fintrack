# HANDOFF — Fintrack
_Обновлено: 2026-10-23 · автор витка: ChatGPT · исполнитель: Codex_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

Трек **тёмной темы** начат с THEME-1: в код перенесены светлая и тёмная семантические палитры из Figma DS, добавлены персистентный `ThemeProvider` и хуки темы. Внешний вид приложения пока намеренно не изменился: экраны и компоненты ещё используют статический светлый `theme.color`/legacy-токены, селектор темы в Settings не раскрыт.

## Только что сделано

- Этот коммит — **THEME-1: dark-theme foundation**.
  - `lib/theme.ts`: существующий `theme.color` сохранён как светлая палитра и экспортирован через `color`/`lightColor`; добавлен `darkColor` с точной структурой и значениями из Figma, `Colors` и `ColorScheme`. Рекурсивная compile-time проверка структуры не использует `any`.
  - Новый `contexts/ThemeContext.tsx`: выбор `system | light | dark` хранится в AsyncStorage (`theme`), системная схема отслеживается через `useColorScheme`; наружу отданы `ThemeProvider`, `useColors()` и `useTheme()`.
  - `app/_layout.tsx`: дерево приложения обёрнуто в `ThemeProvider`; ни один экран и Settings не мигрировали.
  - `CHANGELOG.md`: добавлена запись THEME-1 в `[Unreleased] → Added`.
- **Проверено:** `npm run typecheck` — чисто; `npm test` — 20 сьютов / 165 тестов зелёные; Web export успешен; Android Metro export успешен с `--no-bytecode`; `darkColor` проходит структурную проверку против светлой палитры; `useColors` пока не потребляется UI.
- **НЕ проверено / внешний блокер:** обычный Android export с Hermes не завершился — Windows Application Control блокирует запуск локального `node_modules/hermes-compiler/.../hermesc.exe` (`spawn UNKNOWN`). На устройстве визуальный прогон не выполнялся. У Глеба остаётся untracked `BUGS.md`, он не изменён и не коммитится.

## Состояние origin/main

Ветка `main`. Этот виток — один коммит THEME-1 поверх `3ec4930`; в него входят три кодовых файла, `HANDOFF.md` и одна append-only запись `CHANGELOG.md`. `.env` не затронут. Перед следующим витком — `git pull`.

## Следующий шаг

**THEME-2:** мигрировать DS-компоненты и общие компоненты с `theme.color.*`/legacy `theme.colors.*` на `useColors()`, переводя legacy-роли в семантические токены по мере миграции. Settings-селектор темы пока не раскрывать: он появляется только в финальном migration-витке, когда не останется светлых островов.

## Открытые решения и риски

- Пять dark chart-ролей из промпта помечены как derived (`data.selection`, `data.label`, `data.muted`, `data.tooltipContent` и связанный chart-токен); при доступе к Figma их можно сверить отдельной values-only правкой.
- `theme.color` и legacy `theme.colors` намеренно остаются светлыми до миграции потребителей. Частичная подмена глобального объекта создаст полутёмный интерфейс — не делать.
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
