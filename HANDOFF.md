# HANDOFF — Fintrack
_Обновлено: 2026-11-07 · автор витка: ChatGPT · исполнитель: Codex_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

Для внешней beta в Settings добавлен простой канал сообщений о проблемах с автоматической привязкой платформы и версии сборки.

## Только что сделано

- Settings → «О приложении» теперь показывает версию и ведёт на non-tab экран «Сообщить о проблеме»: multiline сообщение отправляется в `feedback`, success заменяет форму, ошибка сохраняет текст для retry.
- Новая migration `20261107000000_feedback.sql` создаёт таблицу с `user_id default auth.uid()`, cascade и RLS insert/select только своих строк; клиент не передаёт `user_id`, но сохраняет `app_version` и `Platform.OS`.
- `expo-application` добавлен через `expo install`; `appVersionLabel()`/`appVersionString()` предпочитают native version+build и безопасно падают обратно на Expo config version на Web/dev.
- **Проверено:** `npm run typecheck` чистый; полный Jest с workspace cache — 23 сьюта / 212 тестов зелёные; Web export и Android Metro export с `--no-bytecode` успешны. `expo install --check` принимает новый модуль, но перечисляет существующие outdated Expo-пакеты вне scope. Migration/RLS и реальная отправка не проверялись до apply/deploy.
- У Глеба остаются untracked `BUGS.md` и `DEPLOY.md`; они не изменены и не коммитятся.

## Состояние origin/main

Ветка `main`. RELEASE-4 идёт поверх `ebf32d7`; после commit/push `origin/main` должен указывать на feedback/version commit.

## Следующий шаг

**Применить `20261107000000_feedback.sql`, задеплоить pending Edge Functions и ship beta по ops runbook.** После свежего EAS build проверить реальный native build number в Settings.

## Открытые решения и риски

- Migration `feedback` ещё не применена: до неё submit будет ошибкой; после apply проверить insert, app_version/platform/user_id, offline retry и RLS-изоляцию между двумя пользователями.
- `expo-application` — native module: реальный version/build label требует свежего EAS build; Web/dev показывает semver из Expo config.
- `PASSWORD_RESET_UI` возвращать в `true` только после sending domain + custom SMTP (Resend), Supabase Site URL/redirect allowlist и `EXPO_PUBLIC_SITE_URL`; до этого beta recovery выполняется владельцем вручную.
- `delete-account` ещё не задеплоена: перед проверкой убедиться, что `SUPABASE_SERVICE_ROLE_KEY` доступен Edge Functions; затем на throwaway account проверить confirm/cancel, повторный login и cascade по expenses/merchants/receipts.
- `verify_jwt = false` для `delete-account` — осознанное исключение: иначе gateway вернёт 401 вместо обязательного JSON/HTTP 200; безопасность держится на `auth.getUser(jwt)`, а body uid игнорируется.
- Production deploy трёх pending функций требует `supabase login`; после deploy также проверить `fx_rates` и четыре vision-сценария.
- Ручной smoke-test повторного создания/edit/delete траты на Web и Android из предыдущего fix всё ещё не выполнен.
- Расхождение grouped-ввода денег с `AGENTS.md` и float-граница half-up остаются открытыми решениями.
- Budgets/limits пока не спроектированы: не выбирать модель, период или схему хранения без отдельного prompt/решения.

## Не трогать

- Датированные release-блоки `CHANGELOG.md` после публикации, кроме отдельной задачи на исправление факта.
- Применённые migrations: `20261107000000_feedback.sql` только добавляется и применяется как новая, прошлые SQL не редактировать.
- Dormant password-reset code/routes/i18n: до готовности SMTP меняется только `PASSWORD_RESET_UI`, функциональность не удаляется.
- Service-role key вне Edge Functions и body-supplied uid в `delete-account`; функция удаляет только caller из проверенного JWT.
- `detectSessionInUrl: false`: recovery остаётся локально обработанным web-flow, без native deep-link конфигурации.
- Клиентскую денежную математику, RLS, схему и применённые миграции до отдельного CURRENCY-2/schema prompt.
- Пользовательские untracked `BUGS.md` и `DEPLOY.md`.
