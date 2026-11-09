# HANDOFF — Fintrack
_Обновлено: 2026-11-09 · автор витка: ChatGPT · исполнитель: Codex_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

Заложен общий слой краткой обратной связи: любой экран теперь может вызвать токенизированный toast через `useToast()`, но продуктовые действия к нему пока намеренно не подключены.

## Только что сделано

- Добавлен DS-компонент `components/ds/Toast.tsx`: inverse surface, tone-иконки success/error/info, сообщение до двух строк и необязательное действие.
- Добавлены `ToastProvider` и `useToast()` в `contexts/ToastContext.tsx`: один toast за раз, замена сбрасывает таймер, значения по умолчанию — 3 с для success, 6 с для error и 4 с для info.
- Host закреплён над нижним tab bar с учётом safe area (`fixed` на Web, `absolute` на native), анимацией fade/translate, горизонтальным swipe-dismiss и assertive live region; высота нижнего bar вынесена из `TabBar` в общий экспорт.
- Provider смонтирован в корневом layout внутри существующих app providers. Ни один экран и ни одна строка i18n пока не используют toast — это оставлено следующим задачам.
- **Проверено:** `npm run typecheck`; 23 Jest-съюта / 212 тестов; Web и Android Metro export; локальный Chrome smoke-test success/error/action, авто-закрытия и swipe-dismiss. Реальный Android UI вручную не проверялся.

## Состояние origin/main

Ветка `main`; после commit/push FEEDBACK-1 `origin/main` содержит Toast foundation поверх RELEASE-8 `e46560e`.

## Следующий шаг

**FEEDBACK-2:** добавить inline `FieldError` и `StatusBanner`, затем **FEEDBACK-3:** каталог сообщений и подключение подходящей поверхности к каждому реальному success/error site.

## Открытые решения и риски

- Toast пока не вызывается продуктовым кодом; пользователь увидит его только после FEEDBACK-3.
- Положение и жест проверены на Web; на реальном Android нужно подтвердить safe-area/tab-bar clearance и TalkBack announcement.
- Migration `feedback` и pending Edge Functions ещё требуют отдельного deploy/операционного smoke-test перед следующим tester round.
- `PASSWORD_RESET_UI` остаётся `false` до sending domain + custom SMTP и корректных redirect/Site URL настроек.
- Fiscal SUF fetch остаётся строго native-only; Web/iPhone используют photo-analysis path.

## Не трогать

- Не подключать Toast к отдельным экранам и не добавлять copy/i18n до FEEDBACK-3.
- Не заменять inverse surface тональными контейнерами: tone Toast передаётся иконкой; tonal status surface относится к `StatusBanner`.
- Не возвращать SUF-link field в Web и не включать `PASSWORD_RESET_UI` без готовой инфраструктуры.
- Не менять денежную математику, RLS, applied migrations и service-role boundary без отдельной задачи.
