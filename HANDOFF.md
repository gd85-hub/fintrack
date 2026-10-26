# HANDOFF — Fintrack
_Обновлено: 2026-10-26 · автор витка: ChatGPT · исполнитель: Codex_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

Трек **тёмной темы** дошёл до THEME-8: все экраны и компоненты в `app/` и `components/` читают цвета через `useColors()`; app-wide grep по статическим `theme.colors.*` и `theme.color.*` пуст. Цветовая миграция завершена, но селектор темы в Settings пока намеренно скрыт — его раскрытие и финальный light/dark проход составляют THEME-9.

## Только что сделано

- Этот коммит — **THEME-8: receipt review and expense editor on dynamic colors**.
  - `app/(app)/receipt/review.tsx` и `components/ExpenseEditorScreen.tsx` переведены на `useColors()` и `makeStyles` без изменения save/validation/FX/delete-логики, навигации, layout или non-color токенов.
  - Review: summary/item surfaces используют raised/subtle-семантику, low-confidence и no-conversion — warning-роли, totals mismatch и validation — error-роли, place tabs — action-container/icon-action, exclude/restore — link.
  - Editor: поля используют `field.*`, preview — secondary, загрузка курсов — tertiary, retry — link, save — primary action; мягкая кнопка удаления сохранена через error container/content.
  - Settings Theme row остаётся скрытым/disabled до THEME-9.
  - `CHANGELOG.md`: добавлена запись THEME-8 в `[Unreleased] → Changed`.
- **Проверено:** `npm run typecheck` — чисто; `npm test` — 20 сьютов / 165 тестов зелёные; в целевых файлах нет `theme.color.*`/`theme.colors.*` и `any`; app-wide grep по обеим статическим colour-формам в `app/` и `components/` даёт 0/0; Web export и Android Metro export с `--no-bytecode` успешны; `git diff --check` чист.
- **НЕ проверено:** ручной визуальный прогон create/edit review и expense editor в light/dark на физическом Android-устройстве. У Глеба остаётся untracked `BUGS.md`, он не изменён и не коммитится.

## Состояние origin/main

Ветка `main`. Этот виток — один коммит THEME-8 поверх `4e9a0e5`; в него входят два последних экрана цветовой миграции, `HANDOFF.md` и одна append-only запись `CHANGELOG.md`. `.env` не затронут. Перед следующим витком — `git pull`.

## Следующий шаг

**THEME-9:** раскрыть и подключить Settings → Theme selector (System / Light / Dark), провести финальный app-wide light/dark аудит, затем подготовить единый Android build/deploy с i18n, экспортом и тёмной темой.

## Открытые решения и риски

- Пять dark chart-ролей из foundation-промпта помечены как derived (`data.selection`, `data.label`, `data.muted`, `data.tooltipContent` и связанный chart-токен); при доступе к Figma их можно сверить отдельной values-only правкой.
- Цветовая миграция по статическим ссылкам завершена, но до показа переключателя нужен ручной dark-mode аудит сложных состояний: review create/edit, предупреждения, excluded items, FX error/retry и delete confirmation.
- `Colors = typeof lightColor` сохраняет literal-типы светлой палитры; `darkColor` отдельно проверяется через `satisfies ColorShape<Colors>`. В фабриках стилей остаётся локальный безопасный cast результата `useColors()` к `Colors`, пока публичный тип палитры не будет расширен без изменения runtime-значений.
- Windows Application Control блокирует локальный `hermesc.exe`; полноценный Hermes export/EAS Android и ручной device-run нужно повторить в разрешённой среде. JS Android bundle собирается.
- История проекта: `CHANGELOG.md` append-only; `HANDOFF.md` переписывается каждый виток — оба тем же коммитом.
- Экспорт использует нативные `expo-print`/`expo-sharing`/`expo-file-system`; свежий Android-билд всё ещё обязателен перед релизом.

## Не трогать

- Settings → Theme до THEME-9; не показывать переключатель без финального app-wide visual audit.
- Существующие значения `lightColor`/`darkColor` и legacy `theme.colors`/`fontSizes`/`radii`/`spacing`/`sizes` без отдельной values-only задачи.
- Защитные `throw new Error(...)`, FX/денежную математику, парсинг чеков, RLS и применённые миграции.
- `lib/export.ts` и формат экспорта без отдельной задачи и обновления тестов.
- Прошлые записи `CHANGELOG.md`; только append в текущий `[Unreleased]`.
- Структуру Home (`FlatList` карточек дней, нестики-заголовки, RSD hero) и серверный фетч чека (HTML качает устройство).
