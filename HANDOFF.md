# HANDOFF — Fintrack
_Обновлено: 2026-11-26 · автор витка: Claude · задача: CI-01_

Это краткая дельта. Долгий контекст и обязательные правила — в `README.md` и `AGENTS.md`.

## Где мы

В репозитории появился лёгкий GitHub Actions CI: typecheck + Jest на каждый push/PR в `main`. Прикладной код, сборка и деплой не затрагиваются. Предыдущий виток (REPORTS-02.3, векторный PDF на Web) остаётся актуальным и ждёт ручной проверки после отдельного Web deploy.

## Только что сделано

- Добавлен `.github/workflows/ci.yml`: один job `typecheck-and-test` на `ubuntu-latest`, Node `24` через `actions/setup-node@v4` (npm cache), шаги checkout → setup-node → `npm ci` → `npm run typecheck` → `npm run test:ci`. Триггеры: `push` в `main` и `pull_request` в `main`. `permissions: contents: read`, `timeout-minutes: 15`, concurrency `ci-${{ github.workflow }}-${{ github.ref }}` с `cancel-in-progress: true`. Без матриц, build, EAS, миграций, deploy, secrets и coverage-порогов.
- В `package.json` добавлен скрипт `"test:ci": "jest --runInBand --testTimeout=30000"`; `"test": "jest"` оставлен для локальной разработки без изменений.
- Совместимость с Node 24 подтверждена: все `engines` из `package-lock.json` (строжайший — `^24.3.0`) выполняются на локальном Node 24.18.0; зависимости не менялись.

## Состояние origin/main

Ветка `main`. Один атомарный commit `ci: add automated typecheck and tests`, запушен в `origin/main`. Application code, схема, миграции, Edge Functions и зависимости не затронуты.

## Следующий шаг

Убедиться, что первый запуск workflow на GitHub зелёный (см. статус в отчёте витка). Затем вернуться к висящему ручному этапу REPORTS-02.3: проверка Web PDF после отдельного Web deploy.

## Открытые решения и риски

- CI намеренно минимальный: только typecheck и Jest, без build/Android/Web/EAS/миграций. Расширение (lint, coverage, матрицы) — отдельная задача.
- `test:ci` использует `--runInBand` и `--testTimeout=30000` — последовательно и стабильно, но медленнее (~52 c локально против ~8 c у параллельного `npm test`); это осознанный размен ради отсутствия случайного red build из-за cold-start timeout первого render-теста.
- Локально: `npm ci` ok, `typecheck` зелёный, `test:ci` 897/897, YAML распарсен `js-yaml` (уже транзитивная зависимость, ничего не ставилось).
- Остальные открытые риски — прежние, по REPORTS-02.3: фактическое browser/OS сохранение PDF остаётся manual verification.

## Не трогать

- Не добавлять в CI build, Android, Web, EAS, Supabase migrations, deploy, secrets, env, coverage-порог, lint или новые npm-зависимости без отдельной задачи.
- Не менять `"test": "jest"` — это локальный быстрый прогон.
- Не переносить pdfmake/VFS в общий или native entry; Web PDF-движок должен оставаться lazy-loaded.
