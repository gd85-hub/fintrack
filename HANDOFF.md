# HANDOFF — Fintrack
_Обновлено: 2026-11-06 · автор витка: ChatGPT · исполнитель: Codex_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

Перед beta-раздачей добавлен self-service сброс пароля: запрос отправляется из приложения, а recovery завершается на публичном web-маршруте без native deep link.

## Только что сделано

- На входе появилась ссылка «Забыли пароль?» и отдельная форма запроса: `AuthContext.sendPasswordReset` отправляет нейтральное письмо через Supabase, не раскрывая наличие аккаунта; только реальный network failure остаётся inline-ошибкой.
- Верхнеуровневый `/reset-password` на Web вручную читает recovery-токены из hash при неизменном `detectSessionInUrl: false`, устанавливает временную сессию, валидирует новый пароль/подтверждение и после успешного `updateUser` закрывает recovery-сессию. Native-маршрут безопасно показывает пояснение вместо web-flow.
- URL возврата берётся из `EXPO_PUBLIC_SITE_URL`, с fallback на `window.location.origin` на Web; строки добавлены симметрично в RU/EN.
- **Проверено:** `npm run typecheck` чистый; полный Jest с workspace cache — 23 сьюта / 212 тестов зелёные; Web export и Android Metro export с `--no-bytecode` успешны. End-to-end письмо и recovery не проверялись: сначала нужны dashboard allowlist и build env.
- У Глеба остаются untracked `BUGS.md` и `DEPLOY.md`; они не изменены и не коммитятся.

## Состояние origin/main

Ветка `main`. RELEASE-1 идёт поверх `ce58843`; после commit/push `origin/main` должен указывать на новый auth-flow commit.

## Следующий шаг

**RELEASE-2: account deletion.** До этого для RELEASE-1 настроить Supabase Site URL/Redirect URLs и `EXPO_PUBLIC_SITE_URL`, затем пройти recovery end-to-end.

## Открытые решения и риски

- Для password reset нужны Supabase Site URL и Redirect URL `<web URL>/reset-password`, а также `EXPO_PUBLIC_SITE_URL` в build env; без них письмо не приведёт на рабочий recovery-route.
- После настройки проверить Web flow, Android→browser flow, неизвестный email и просроченную/неверную ссылку; автоматический прогон не может подтвердить email delivery.
- Production deploy CURRENCY-1 и RECEIPT-MULTI-1 всё ещё требует `supabase login`; после deploy проверить `fx_rates` и четыре vision-сценария.
- Ручной smoke-test повторного создания/edit/delete траты на Web и Android из предыдущего fix всё ещё не выполнен.
- Расхождение grouped-ввода денег с `AGENTS.md` и float-граница half-up остаются открытыми решениями.
- Budgets/limits пока не спроектированы: не выбирать модель, период или схему хранения без отдельного prompt/решения.

## Не трогать

- Датированные release-блоки `CHANGELOG.md` после публикации, кроме отдельной задачи на исправление факта.
- `detectSessionInUrl: false`: recovery остаётся локально обработанным web-flow, без native deep-link конфигурации.
- Клиентскую денежную математику, RLS, схему и применённые миграции до отдельного CURRENCY-2/schema prompt.
- Пользовательские untracked `BUGS.md` и `DEPLOY.md`.
