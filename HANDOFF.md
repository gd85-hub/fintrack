# HANDOFF — Fintrack
_Обновлено: 2026-11-07 · автор витка: ChatGPT · исполнитель: Codex_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

Фискальный разбор снова доступен iPhone/web-тестерам без native build: в общий фото/web flow можно вставить SUF-ссылку, которую камера телефона получила из QR-кода чека.

## Только что сделано

- `ImageReceiptFlow` теперь показывает поле SUF-ссылки, подсказку и разделитель «или» над неизменённым photo input; путь доступен на Web и в native image-mode.
- Paste-flow повторно использует `isSupportedReceiptUrl`, `fetchAndParseReceipt`, `receiptParseErrorMessage`, общий draft и `router.replace('/(app)/receipt/review')`; native QR camera, отдельный manualMode и image analysis не менялись.
- Добавлены точные RU/EN строки для подсказки и разделителя; визуальные значения берутся из существующей темы и стилей экрана.
- **Проверено:** `npm run typecheck` чистый; полный Jest с workspace cache — 23 сьюта / 212 тестов зелёные; Web export (1203 modules) и Android Metro export с `--no-bytecode` (1634 modules) успешны. Реальный SUF fetch/review на Safari и native image-mode вручную не проверялся.
- У Глеба остаются untracked `BUGS.md` и `DEPLOY.md`; они не изменены и не коммитятся.

## Состояние origin/main

Ветка `main`. RELEASE-5 идёт поверх RELEASE-4 `c79249d`; после commit/push `origin/main` должен указывать на receipt-link paste commit.

## Следующий шаг

**PWA/iOS Safari polish + короткий tester brief:** камера iPhone → QR → скопировать SUF-ссылку → вставить на web scan. Параллельно перед beta применить feedback migration и закрыть pending deploy из ops runbook.

## Открытые решения и риски

- Migration `feedback` ещё не применена: до неё submit будет ошибкой; после apply проверить insert, app_version/platform/user_id, offline retry и RLS-изоляцию между двумя пользователями.
- `expo-application` — native module: реальный version/build label требует свежего EAS build; Web/dev показывает semver из Expo config.
- Paste-flow собран на обе платформы, но требует ручного smoke-test: валидная SUF-ссылка → review, чужой URL → `notSufLink`, photo path без регрессии, native QR/manual без изменений.
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
