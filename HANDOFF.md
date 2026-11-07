# HANDOFF — Fintrack
_Обновлено: 2026-11-07 · автор витка: ChatGPT · исполнитель: Codex_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

Self-service password reset сохранён в коде, но его точка входа скрыта на beta за compile-time флагом до подключения надёжной почтовой доставки.

## Только что сделано

- В `lib/features.ts` добавлен документированный `PASSWORD_RESET_UI = false`; sign-in не рендерит ссылку «Забыли пароль?», пока флаг выключен.
- `sendPasswordReset`, forgot/reset routes и все reset i18n-строки не менялись и остаются доступными по прямому URL; включение после domain + Resend + Site URL/redirect/`EXPO_PUBLIC_SITE_URL` требует только перевести флаг в `true`.
- Beta-сбросы выполняет владелец вручную через admin recovery link; self-service удаление аккаунта не затронуто и остаётся видимым.
- **Проверено:** `npm run typecheck` чистый; полный Jest с workspace cache — 23 сьюта / 212 тестов зелёные; Web export и Android Metro export с `--no-bytecode` успешны. Временное переключение флага вручную не выполнялось.
- У Глеба остаются untracked `BUGS.md` и `DEPLOY.md`; они не изменены и не коммитятся.

## Состояние origin/main

Ветка `main`. RELEASE-3 идёт поверх `702ab9d`; после commit/push `origin/main` должен указывать на feature-flag commit.

## Следующий шаг

**Задеплоить pending `sync-fx`, `analyze-receipt-image` и `delete-account`, затем ship beta по ops runbook.** Password reset остаётся ручным до отдельной настройки domain/SMTP.

## Открытые решения и риски

- `PASSWORD_RESET_UI` возвращать в `true` только после sending domain + custom SMTP (Resend), Supabase Site URL/redirect allowlist и `EXPO_PUBLIC_SITE_URL`; до этого beta recovery выполняется владельцем вручную.
- `delete-account` ещё не задеплоена: перед проверкой убедиться, что `SUPABASE_SERVICE_ROLE_KEY` доступен Edge Functions; затем на throwaway account проверить confirm/cancel, повторный login и cascade по expenses/merchants/receipts.
- `verify_jwt = false` для `delete-account` — осознанное исключение: иначе gateway вернёт 401 вместо обязательного JSON/HTTP 200; безопасность держится на `auth.getUser(jwt)`, а body uid игнорируется.
- Production deploy трёх pending функций требует `supabase login`; после deploy также проверить `fx_rates` и четыре vision-сценария.
- Ручной smoke-test повторного создания/edit/delete траты на Web и Android из предыдущего fix всё ещё не выполнен.
- Расхождение grouped-ввода денег с `AGENTS.md` и float-граница half-up остаются открытыми решениями.
- Budgets/limits пока не спроектированы: не выбирать модель, период или схему хранения без отдельного prompt/решения.

## Не трогать

- Датированные release-блоки `CHANGELOG.md` после публикации, кроме отдельной задачи на исправление факта.
- Dormant password-reset code/routes/i18n: до готовности SMTP меняется только `PASSWORD_RESET_UI`, функциональность не удаляется.
- Service-role key вне Edge Functions и body-supplied uid в `delete-account`; функция удаляет только caller из проверенного JWT.
- `detectSessionInUrl: false`: recovery остаётся локально обработанным web-flow, без native deep-link конфигурации.
- Клиентскую денежную математику, RLS, схему и применённые миграции до отдельного CURRENCY-2/schema prompt.
- Пользовательские untracked `BUGS.md` и `DEPLOY.md`.
