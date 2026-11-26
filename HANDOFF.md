# HANDOFF — Fintrack
_Обновлено: 2026-11-26 · автор витка: Claude · задача: TEMP-01_

Это краткая дельта. Долгий контекст и обязательные правила — в `README.md` и `AGENTS.md`.

## Где мы

Репозиторий перестал отслеживать локальное состояние Supabase CLI. Продуктовый код не менялся. Предыдущий виток (REPORTS-02.3, векторный PDF на Web) остаётся актуальным и всё ещё ждёт ручной проверки после отдельного Web deploy — см. `CHANGELOG.md` и историю ниже.

## Только что сделано

- В `.gitignore` добавлено правило `supabase/.temp/`.
- Из индекса Git убраны ранее отслеживавшиеся файлы `supabase/.temp/cli-latest` и `supabase/.temp/linked-project.json` через `git rm -r --cached supabase/.temp`; локальные копии на диске сохранены.
- Проверено: `git check-ignore` подтверждает игнор обоих файлов, `git status --short` больше не показывает `supabase/.temp/cli-latest` как рабочее изменение.

## Состояние origin/main

Ветка `main`. Один атомарный commit `chore(repo): ignore Supabase temp state`, запушен в `origin/main`. Приложение, миграции, Edge Functions, конфиг Supabase и зависимости не затронуты.

## Следующий шаг

Вернуться к висящему ручному этапу REPORTS-02.3: проверка Web PDF после отдельного Web deploy (Chrome Desktop — реальное скачивание и повторные форматы; физический iPhone Safari и installed PWA — Share/Save, отмена и fallback).

## Открытые решения и риски

- Удаления из индекса не касаются истории: прошлые коммиты всё ещё содержат эти файлы, но для текущего дерева они больше не отслеживаются.
- Остальные открытые риски — прежние, по REPORTS-02.3 (см. предыдущие витки): фактическое browser/OS сохранение PDF остаётся manual verification.

## Не трогать

- Не добавлять `supabase/.temp/*`, `.env` или `supabase/.temp/linked-project.json` обратно в индекс.
- Не удалять локальные файлы `supabase/.temp/` с машины — это рабочее состояние CLI пользователя.
- Не переносить pdfmake/VFS в общий или native entry; Web PDF-движок должен оставаться lazy-loaded.
