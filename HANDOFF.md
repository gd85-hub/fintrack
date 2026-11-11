# HANDOFF — Fintrack
_Обновлено: 2026-11-11 · автор витка: ChatGPT · исполнитель: Codex_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

Feedback foundation теперь покрывает transient и inline поверхности: Toast уже доступен глобально, а load/field errors приведены к двум DS-компонентам; текст сообщений и маршрутизация всех реальных success/error sites остаются следующей задачей.

## Только что сделано

- Добавлен `components/ds/StatusBanner.tsx`: четыре status-tone, токенизированные container/border/content/icon, сообщение до трёх строк, optional action и assertive live region.
- Добавлен `components/ds/FieldError.tsx`: единая caption-ошибка под полем, null для пустого сообщения и assertive live region.
- Home, Analytics, Categories и Merchants используют `StatusBanner` для load/error state с тем же `home.retry` и прежними retry handlers; Reports использует banner без action. Операционные/editor/export ошибки вне этих load states не менялись.
- Ручная проверка RSD-equivalent validation в `ExpenseEditorScreen` переведена на `FieldError`; условие, текст и Save gating сохранены.
- Copy и i18n не менялись, `useToast` к экранам не подключался.
- **Проверено:** `npm run typecheck`; 23 Jest-съюта / 212 тестов; Web export (1207 modules); Android Metro export (1638 modules); локальный Chrome smoke-test в dark theme — banner/action и появление/очистка FieldError. Реальные offline states пяти экранов и Android UI вручную не форсировались.

## Состояние origin/main

Ветка `main`; после commit/push FEEDBACK-2 `origin/main` содержит DS error surfaces поверх FEEDBACK-1 `8c2aad8`.

## Следующий шаг

**FEEDBACK-3:** собрать короткий human-friendly message catalog и направить каждый реальный результат действия на правильную поверхность — toast, status banner или field error — включая success feedback.

## Открытые решения и риски

- На реальном Android нужно подтвердить live-region announcements и визуальные интервалы StatusBanner/FieldError.
- Offline retry проверен сохранением исходных callback-ссылок и component smoke-test, но не реальным отключением сети на каждом из пяти экранов.
- Migration `feedback` и pending Edge Functions ещё требуют отдельного deploy/операционного smoke-test перед tester round.
- `PASSWORD_RESET_UI` остаётся `false` до sending domain + custom SMTP и корректных redirect/Site URL настроек.
- Fiscal SUF fetch остаётся строго native-only; Web/iPhone используют photo-analysis path.

## Не трогать

- Не переписывать copy и не подключать Toast/StatusBanner/FieldError к новым sites до FEEDBACK-3.
- Не мигрировать auth, receipt-review warning/mismatch и scan error card в обход отдельной задачи.
- Не возвращать SUF-link field в Web и не включать `PASSWORD_RESET_UI` без готовой инфраструктуры.
- Не менять денежную математику, RLS, applied migrations и service-role boundary без отдельной задачи.
