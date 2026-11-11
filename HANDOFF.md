# HANDOFF — Fintrack
_Обновлено: 2026-11-11 · автор витка: ChatGPT · исполнитель: Codex_

Это дельта и указатель «что дальше». Долгий контекст — в `AGENTS.md` (закон для исполнителя) и `FINTRACK-CONTEXT.md` (контекст для автора, вне репо). Здесь их не дублируем.

## Где мы

Feedback loop для основных действий замкнут: успешные операции подтверждаются success-toast, а сбои сохранения, удаления, объединения, переименования и отправки отзыва показываются error-toast; validation остаётся рядом с полем, load failures — в `StatusBanner`.

## Только что сделано

- Action failures редактора траты и ревью чека переведены с исчезающей inline-строки на `toast.error`; форма и введённые данные при ошибке остаются на месте.
- Ошибки save/type-change/merge/delete категорий и rename/merge/delete мест теперь показываются error-toast; validation (`fillFields`, required name, collision) по-прежнему inline.
- Ошибка отправки отзыва показывается error-toast, текст отзыва сохраняется; action-only `hasError` и его inline-разметка удалены.
- Все сообщения используют существующие i18n-ключи: copy и словари не менялись. Auth и scan in-flow error card не затрагивались.
- **Проверено:** `npm run typecheck`; 23 Jest-съюта / 212 тестов; Web export (1207 modules); Android Metro export (1638 modules); статический аудит всех перечисленных catch-веток, validation setters и load `StatusBanner`. Реальные offline-мутации Supabase и Android UI вручную не выполнялись.

## Состояние origin/main

Ветка `main`; FEEDBACK-3b готовится одним commit/push поверх FEEDBACK-3a `7cfecd0`.

## Следующий шаг

Опционально: привести auth action-errors к той же поверхности и сделать короткий copy-polish технических scan-сообщений; отдельно — пройти offline smoke-test основных действий на тестовых данных.

## Открытые решения и риски

- На тестовых данных Web/Android нужно принудительно проверить offline save/delete/merge/rename/feedback и убедиться, что action-error появляется один раз, а validation не вызывает toast.
- Migration `feedback` и pending Edge Functions ещё требуют отдельного deploy/операционного smoke-test перед tester round.
- `PASSWORD_RESET_UI` остаётся `false` до sending domain + custom SMTP и корректных redirect/Site URL настроек.
- Fiscal SUF fetch остаётся строго native-only; Web/iPhone используют photo-analysis path.

## Не трогать

- Не переносить field validation из inline `FieldError`/текста и load failures из `StatusBanner` в toast.
- Не менять auth и scan in-flow error surfaces без отдельной задачи.
- Не возвращать SUF-link field в Web и не включать `PASSWORD_RESET_UI` без готовой инфраструктуры.
- Не менять денежную математику, RLS, applied migrations и service-role boundary без отдельной задачи.
