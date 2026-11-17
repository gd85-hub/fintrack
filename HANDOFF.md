# HANDOFF — Fintrack
_Обновлено: 2026-11-17 · автор витка: ChatGPT · исполнитель: Codex_

Это краткая дельта. Долгий контекст и роли документов закреплены в `README.md` и `AGENTS.md`.

## Где мы

DOCS-1 синхронизировал репозиторную документацию с текущим `main`: глобальное EUR-anchor ядро, персональные категории, RU/EN, темы, responsive Web/PWA, расширенная аналитика и экспорт теперь описаны как реализованные в коде, но отдельно от подтверждённого production-состояния.

## Только что сделано

- Полностью актуализированы `README.md` и `AGENTS.md`; удалены старые правила про RSD-only/NBS-only, `SectionList`, общие read-only категории, только русский UI и обязательный gateway JWT для `delete-account`.
- `BUGS.md` теперь хранит историю BUG-1/2 и четыре подтверждённых открытых дефекта: фиксированные валюты экспорта, NULL EUR → 0, текстовое совпадение catalog i18n и отсутствие grouped amount input.
- `BACKLOG.md` разделён на реализованное, pending production rollout и будущие продуктовые направления. Экспорт, fixed/variable analytics, валютное ядро, PWA, i18n/themes и account support перенесены в реализованное без потери истории.
- Роли README / AGENTS / HANDOFF / CHANGELOG / BUGS / BACKLOG закреплены без дублирования источников истины.
- Проверено: Markdown-only diff, локальные ссылки и целевые ссылки на код/коммиты. Typecheck/tests/build не запускались по условию documentation-only задачи.

## Состояние origin/main

Ветка `main`; DOCS-1 завершена одним локальным коммитом поверх `55853eb`. Push в задаче не запрошен, поэтому `origin/main` остался на `55853eb`. Постороннее локальное изменение `supabase/.temp/cli-latest` не трогалось и не входит в коммит; `.env` не менялся.

## Следующий шаг

Сначала применить и проверить `20261115000000_per_account_categories.sql` на production Supabase: выполнить SQL-проверки из миграции и вручную проверить новый/существующий аккаунты. Затем брать маленькие correctness-задачи из `BUGS.md`, начиная с BUG-4 (не подменять отсутствующий EUR нулём в экспорте).

## Открытые решения и риски

- Production-применение миграции персональных категорий не подтверждено; новый клиент ожидает личные копии.
- `ANCHOR_DISPLAY=true` и on-demand Frankfurter flow покрыты тестами, но полный реальный device/network прогон до tester rollout не зафиксирован.
- Export currency contract требует продуктового решения: original + primary/secondary или стабильный универсальный набор.
- Password reset остаётся намеренно скрытым до domain + SMTP + redirect setup; deployment `delete-account`/feedback также требует проверки окружения.

## Не трогать

- Не применять production-миграции и не выполнять deploy без отдельной задачи Глеба.
- Не удалять NULL-шаблоны категорий и не ослаблять RLS/ownership.
- Не включать `PASSWORD_RESET_UI` до выполнения документированных SMTP/domain условий.
- Не переписывать исторические записи `CHANGELOG.md`; новые записи только append-only.
