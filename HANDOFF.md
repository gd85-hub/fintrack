# HANDOFF — Fintrack
_Обновлено: 2026-11-07 · автор витка: ChatGPT · исполнитель: Codex_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

Перед beta-раздачей добавлено self-service удаление аккаунта и всех связанных пользовательских данных через защищённую Edge Function.

## Только что сделано

- Settings → «Удалить аккаунт» открывает обязательный confirm-modal с permanent-delete предупреждением, cancel, disabled/spinner состоянием и inline-ошибкой; RU/EN parity сохранена.
- `AuthContext.deleteAccount()` вызывает `delete-account` и очищает локальную сессию только после `{ ok: true }`; при invoke/server error пользователь остаётся в приложении.
- Edge Function не читает body и удаляет только `data.user.id`, полученный через service-role `auth.getUser(jwt)`; FK cascade удалит связанные строки. Для документированного JSON `unauthorized` функция сама валидирует JWT, поэтому только для неё `verify_jwt = false` на gateway.
- **Проверено:** `deno check --no-lock` и `npm run typecheck` чистые; полный Jest с workspace cache — 23 сьюта / 212 тестов зелёные; Web export и Android Metro export с `--no-bytecode` успешны. Реальное удаление/cascade не проверялись до deploy.
- У Глеба остаются untracked `BUGS.md` и `DEPLOY.md`; они не изменены и не коммитятся.

## Состояние origin/main

Ветка `main`. RELEASE-2 идёт поверх `277847d`; после commit/push `origin/main` должен указывать на новый account-deletion commit.

## Следующий шаг

**Ship beta: настроить SMTP/password-reset URLs, проверить RLS и собрать Android/Web по ops runbook.** Вместе задеплоить `sync-fx`, `analyze-receipt-image` и `delete-account`, затем пройти их manual checks.

## Открытые решения и риски

- `delete-account` ещё не задеплоена: перед проверкой убедиться, что `SUPABASE_SERVICE_ROLE_KEY` доступен Edge Functions; затем на throwaway account проверить confirm/cancel, повторный login и cascade по expenses/merchants/receipts.
- `verify_jwt = false` для `delete-account` — осознанное исключение: иначе gateway вернёт 401 вместо обязательного JSON/HTTP 200; безопасность держится на `auth.getUser(jwt)`, а body uid игнорируется.
- Для password reset всё ещё нужны Supabase Site URL, Redirect URL `<web URL>/reset-password` и `EXPO_PUBLIC_SITE_URL`; после настройки пройти Web и Android→browser recovery.
- Production deploy трёх pending функций требует `supabase login`; после deploy также проверить `fx_rates` и четыре vision-сценария.
- Ручной smoke-test повторного создания/edit/delete траты на Web и Android из предыдущего fix всё ещё не выполнен.
- Расхождение grouped-ввода денег с `AGENTS.md` и float-граница half-up остаются открытыми решениями.
- Budgets/limits пока не спроектированы: не выбирать модель, период или схему хранения без отдельного prompt/решения.

## Не трогать

- Датированные release-блоки `CHANGELOG.md` после публикации, кроме отдельной задачи на исправление факта.
- Service-role key вне Edge Functions и body-supplied uid в `delete-account`; функция удаляет только caller из проверенного JWT.
- `detectSessionInUrl: false`: recovery остаётся локально обработанным web-flow, без native deep-link конфигурации.
- Клиентскую денежную математику, RLS, схему и применённые миграции до отдельного CURRENCY-2/schema prompt.
- Пользовательские untracked `BUGS.md` и `DEPLOY.md`.
