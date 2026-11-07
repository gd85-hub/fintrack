# HANDOFF — Fintrack
_Обновлено: 2026-11-07 · автор витка: ChatGPT · исполнитель: Codex_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

Web-клиент подготовлен как устанавливаемая iOS PWA для beta-тестеров: добавлены иконки, manifest и мобильный HTML shell для standalone/safe-area поведения.

## Только что сделано

- Добавлены `app/+html.tsx` и `public/manifest.webmanifest`: standalone/portrait, `viewport-fit=cover`, light/dark theme-color, Apple/PWA icon links и mobile-web baseline без tap highlight, overscroll и input zoom.
- В `public/` добавлены проверенные PNG: Apple touch 180×180, PWA 192×192/512×512 и favicon 48×48.
- Масштабирование страницы не запрещено: нет `user-scalable=no`/`maximum-scale=1`; hex в shell/manifest — согласованное исключение для статического слоя и совпадает с DS `bg/base` light/dark.
- **Проверено:** размеры всех PNG; `npm run typecheck`; 23 Jest-съюта / 212 тестов; Web и Android exports. Реальный install/standalone/safe-area/no-zoom требует проверки на iPhone.
- У Глеба остаются untracked `BUGS.md` и `DEPLOY.md`; они не изменены и не коммитятся.

## Состояние origin/main

Ветка `main`. RELEASE-6 идёт поверх RELEASE-5 `4768abd`; после commit/push `origin/main` должен указывать на iOS PWA commit.

## Следующий шаг

**Tester brief + ship:** применить feedback migration, задеплоить функции, отключить email confirmation, проверить RLS, собрать/опубликовать Web и раздать URL; отдельно подтвердить Add to Home Screen на реальном iPhone.

## Открытые решения и риски

- Migration `feedback` ещё не применена: до неё submit будет ошибкой; после apply проверить insert, app_version/platform/user_id, offline retry и RLS-изоляцию между двумя пользователями.
- `expo-application` — native module: реальный version/build label требует свежего EAS build; Web/dev показывает semver из Expo config.
- Paste-flow собран на обе платформы, но требует ручного smoke-test: валидная SUF-ссылка → review, чужой URL → `notSufLink`, photo path без регрессии, native QR/manual без изменений.
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
