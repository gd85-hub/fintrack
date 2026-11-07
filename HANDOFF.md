# HANDOFF — Fintrack
_Обновлено: 2026-11-07 · автор витка: ChatGPT · исполнитель: Codex_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

Навигация Web теперь выбирается по ширине viewport: телефонный браузер получает мобильную нижнюю панель вместо недоступного десктопного sidebar на пол-экрана.

## Только что сделано

- В `components/TabBar.tsx` добавлены единые `DESKTOP_MIN_WIDTH = 768` и `useIsDesktopWeb()`: sidebar рендерится только на wide Web, а native и narrow Web используют существующий bottom tab bar с центральным `+`.
- `app/(app)/_layout.tsx` применяет sidebar offset через тот же hook, поэтому shell и `paddingLeft` переключаются синхронно при resize/rotate.
- `Platform.OS !== 'web'` у live-QR action не менялся: на web любой ширины Add sheet показывает фото и ручной ввод, но не native scan.
- `AGENTS.md` закрепляет responsive-инвариант. **Проверено:** `npm run typecheck`; 23 Jest-съюта / 212 тестов; Web export (1203 modules) и Android Metro export с `--no-bytecode` (1634 modules). Ручной viewport smoke-test <768/≥768 и Add sheet на iPhone не выполнялся.
- Локальные изменения Глеба в `eas.json`, `package.json`, `package-lock.json`, `supabase/.temp/`, а также untracked `BUGS.md`/`DEPLOY.md` сохранены и не входят в RELEASE-7.

## Состояние origin/main

Ветка `main`. RELEASE-7 идёт поверх RELEASE-6 `64fc09a`; после commit/push `origin/main` должен указывать на responsive-navigation commit.

## Следующий шаг

**Продолжить tester round:** после Web deploy проверить на iPhone bottom tabs/full-width content, `+` без QR action и live switch через 768px; затем разбирать следующий beta feedback.

## Открытые решения и риски

- Migration `feedback` ещё не применена: до неё submit будет ошибкой; после apply проверить insert, app_version/platform/user_id, offline retry и RLS-изоляцию между двумя пользователями.
- `expo-application` — native module: реальный version/build label требует свежего EAS build; Web/dev показывает semver из Expo config.
- Paste-flow собран на обе платформы, но требует ручного smoke-test: валидная SUF-ссылка → review, чужой URL → `notSufLink`, photo path без регрессии, native QR/manual без изменений.
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
