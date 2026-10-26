# HANDOFF — Fintrack
_Обновлено: 2026-10-26 · автор витка: ChatGPT · исполнитель: Codex_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

Трек **тёмной темы** завершён: после app-wide миграции цветов Settings теперь показывает рабочий селектор System / Light / Dark. Выбор применяется живьём через `ThemeProvider`, сохраняется в AsyncStorage, а System следует схеме ОС. В `[Unreleased]` готовы i18n, экспорт и тёмная тема; следующий этап — общий deploy.

## Только что сделано

- Этот коммит — **THEME-9: dark mode live and user-switchable**.
  - В `app/(app)/settings.tsx` прежняя disabled-строка Theme заменена живым selector row по структуре существующего Language selector.
  - Modal показывает System / Light / Dark, отмечает активное значение, вызывает существующий `setTheme` и закрывается после выбора.
  - `lib/i18n/ru.ts` и `lib/i18n/en.ts` получили паритетные подписи и a11y-тексты селектора темы.
  - ThemeProvider, палитры, Language selector и остальные экраны не менялись.
  - `CHANGELOG.md`: добавлена запись THEME-9 в `[Unreleased] → Added`.
- **Проверено:** `npm run typecheck` — чисто; `npm test` — 20 сьютов / 165 тестов зелёные; app-wide grep по `theme.colors.*` и `theme.color.*` в `app/`/`components/` остаётся 0/0; RU/EN theme-ключи паритетны; Web export и Android Metro export с `--no-bytecode` успешны; локальная Web-сборка загрузилась до sign-in без red screen; `git diff --check` чист.
- **НЕ проверено:** визуальный Settings flow и полный dark-mode проход — в локальном тестовом браузере нет сохранённой auth-сессии; Android device-run не выполнен, подключённого устройства нет. Перед deploy проверить selector, персист после рестарта и основные экраны в Dark на реальном устройстве. У Глеба остаётся untracked `BUGS.md`, он не изменён и не коммитится.

## Состояние origin/main

Ветка `main`. Этот виток — один коммит THEME-9 поверх `9b4b0d3`; в него входят Settings, два i18n-словаря, `HANDOFF.md` и одна append-only запись `CHANGELOG.md`. `.env` не затронут. Перед deploy — `git pull`.

## Следующий шаг

**Deploy:** по `DEPLOY.md` выпустить Web (`expo export` + `eas deploy --prod`) и один Android preview build, который доставит i18n, CSV/Excel/PDF export и dark theme. После фактического deploy проштамповать текущий `[Unreleased]` датой и открыть новый пустой блок; затем сделать token-drift script.

## Открытые решения и риски

- Перед релизом нужен ручной light/dark аудит на авторизованной Web-сессии и физическом Android: nav, Home cards/feed, pickers, analytics charts, receipt create/edit, expense editor и dialogs.
- Пять dark chart-ролей из foundation-промпта помечены как derived (`data.selection`, `data.label`, `data.muted`, `data.tooltipContent` и связанный chart-токен); при доступе к Figma их можно сверить отдельной values-only правкой.
- `Colors = typeof lightColor` сохраняет literal-типы светлой палитры; `darkColor` отдельно проверяется через `satisfies ColorShape<Colors>`. В фабриках стилей остаётся локальный безопасный cast результата `useColors()` к `Colors`, пока публичный тип палитры не будет расширен без изменения runtime-значений.
- Windows Application Control блокирует локальный `hermesc.exe`; полноценный Hermes export/EAS Android и ручной device-run нужно повторить в разрешённой среде. JS Android bundle собирается.
- История проекта: `CHANGELOG.md` append-only; `HANDOFF.md` переписывается каждый виток — оба тем же коммитом.
- Экспорт использует нативные `expo-print`/`expo-sharing`/`expo-file-system`; свежий Android-билд обязателен перед релизом.

## Не трогать

- Значения `lightColor`/`darkColor` без отдельной values-only задачи; Theme selector уже использует существующий provider и storage contract.
- Защитные `throw new Error(...)`, FX/денежную математику, парсинг чеков, RLS и применённые миграции.
- `lib/export.ts` и формат экспорта без отдельной задачи и обновления тестов.
- Прошлые записи `CHANGELOG.md`; релизный блок штамповать только после фактического deploy.
- Структуру Home (`FlatList` карточек дней, нестики-заголовки, RSD hero) и серверный фетч чека (HTML качает устройство).
