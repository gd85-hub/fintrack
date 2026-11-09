# HANDOFF — Fintrack
_Обновлено: 2026-11-07 · автор витка: ChatGPT · исполнитель: Codex_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

Web-сканирование снова соответствует реальным ограничениям: SUF-ссылку из браузера загрузить нельзя из-за CORS, поэтому Web/iPhone PWA принимает чек только через работающий photo-analysis path.

## Только что сделано

- Из общего `ImageReceiptFlow` удалены SUF-link state/handler/UI/divider и их стили; Web и native image-mode снова показывают только `ReceiptImageInput`, processing/error и ручное добавление.
- Из RU/EN удалены только `scan.pasteLinkHint` и `scan.orSeparator`; native `qrLinkLabel`/`loadReceipt`/`loading`/`notSufLink`, URL helpers и `handleReceiptUrl` сохранены без изменений.
- Native QR scanner, dedicated manual-link screen, image analysis и `lib/receipts.ts` не затронуты.
- **Проверено:** `npm run typecheck`; 23 Jest-съюта / 212 тестов; Web export (1203 modules) и Android Metro export с `--no-bytecode` (1634 modules). End-to-end photo upload на Safari и native QR/manual вручную не проверялись.
- Локальные изменения Глеба в `eas.json`, `package.json`, `package-lock.json`, `supabase/.temp/`, а также untracked `BUGS.md`/`DEPLOY.md` сохранены и не входят в RELEASE-8.

## Состояние origin/main

Ветка `main`. RELEASE-8 идёт поверх RELEASE-7 `bdcc958`; после commit/push `origin/main` должен указывать на CORS dead-end removal commit.

## Следующий шаг

**Redeploy Web и продолжить tester round:** на iPhone проверить photo upload → review, отсутствие link field и responsive bottom tabs; native QR/manual/photo оставить smoke-check для Android.

## Открытые решения и риски

- Migration `feedback` ещё не применена: до неё submit будет ошибкой; после apply проверить insert, app_version/platform/user_id, offline retry и RLS-изоляцию между двумя пользователями.
- `expo-application` — native module: реальный version/build label требует свежего EAS build; Web/dev показывает semver из Expo config.
- Fiscal SUF fetch остаётся строго native-only: browser блокирует tax page по CORS, а Supabase server — сам tax site; не возвращать link field в Web без нового подтверждённого транспорта.
- Responsive nav собран и типизирован, но реальный narrow-Web smoke-test ещё нужен: bottom bar должен быть закреплён Tabs navigator без дополнительного `position: fixed`; fixed не добавлялся без подтверждённой необходимости.
- При локальном `web.output: single` export manifest/icons копируются, но сгенерированный `index.html` оставался стандартным и не отражал `app/+html.tsx`; перед публичным URL проверить итоговый head. Если EAS ведёт себя так же, single-output потребует отдельного `public/index.html` prompt вместо изменения экранов.
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
