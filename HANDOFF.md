# HANDOFF — Fintrack
_Обновлено: 2026-11-26 · автор витка: Claude · задача: CURRENCY-INPUT-01_

Это краткая дельта. Долгий контекст и обязательные правила — в `README.md` и `AGENTS.md`.

## Где мы

Новый manual expense открывается в запомненной валюте вместо жёсткого RSD. Приоритет: последняя сохранённая валюта (account-scoped) → домашняя валюта → device-default. FX, схема, RLS, receipt currency и display-поведение не менялись. Предыдущий виток (REPORTS-02.3, векторный PDF на Web) остаётся актуальным и ждёт ручной проверки после отдельного Web deploy.

## Только что сделано

- Добавлен `lib/lastCurrency.ts`: `readLastManualCurrency(accountId)` / `rememberLastManualCurrency(accountId, currency)` поверх уже установленного AsyncStorage. Ключ account-scoped (`last_manual_currency:<id>`) — изоляция аккаунтов на устройстве. Значение проходит через `normalizeCurrencyCode` (custom-валюты сохраняются, не ограничены supported-home set). Read-сбой → null (fallback); write-сбой → лог, без throw (успешное сохранение не превращается в провал). Хранится только код валюты, никаких сумм/мест/категорий.
- `components/ExpenseEditorScreen.tsx`: внешний компонент читает `useAuth().user.id` и `useHomeCurrency().homeCurrency`; в его loading-фазе (`Promise.all`) резолвит `readLastManualCurrency` только для нового expense и передаёт `initialCurrency` + `accountId` в форму до того, как она станет интерактивной (поздний ответ не перезатирает выбор пользователя). Форма: `currency` инициализируется `initialExpense?.originalCurrency ?? initialCurrency`. В `handleSave` после успешного `insertExpense` (только создание) — `void rememberLastManualCurrency(accountId, currency)`; при edit/fail/cancel/receipt не вызывается. Фокус и форм-инициализация сохранены.
- Тесты: новый `lib/__tests__/lastCurrency.test.ts` (read/write, normalize, invalid→fallback, account-scoped key, read/write-failure non-fatal, custom currency). Расширен `lib/__tests__/expenseEditorScreen.test.tsx` (моки `useAuth`/`useHomeCurrency`/`../lastCurrency`): нет запомненной → home currency; валидная запомненная → restored; custom → restored; успешное создание → remember с сохранённой валютой; провал/без сохранения/edit → remember не вызывается; edit открывается в оригинальной валюте и не читает preference.

## Состояние origin/main

Ветка `main`. Один атомарный commit `feat(expenses): remember last manual expense currency`, запушен в `origin/main`. Миграции, RLS, FX, frozen-anchor, receipt currency selection и display-валюты не затронуты.

## Следующий шаг

Вернуться к висящему ручному этапу REPORTS-02.3: проверка Web PDF после отдельного Web deploy.

## Открытые решения и риски

- Preference резолвится в loading-фазе внешнего экрана (до монтирования формы), поэтому поздний AsyncStorage-ответ не перезаписывает валюту, выбранную пользователем. Это не cross-device sync.
- Docs-only: закрыт `EXPENSE-02` — аудит подтвердил существующий DS Toast в `handleSave` (`toast.success`), код не дублировался.
- `typecheck` зелёный; targeted `lastCurrency` 11/11, `expenseEditorScreen` 19/19; полный `test:ci` — см. виток.
- Остальные открытые риски — прежние, по REPORTS-02.3: фактическое browser/OS сохранение PDF остаётся manual verification.

## Не трогать

- `lastCurrency` хранит только код валюты — никогда не добавлять туда суммы, manual RSD, merchant, описание, категорию или иные транзакционные данные.
- Не ограничивать запоминаемую валюту списком supported-home currencies (custom-контракт).
- Не запоминать валюту при edit/receipt/cancel/fail/простом выборе без сохранения.
- Не переносить pdfmake/VFS в общий или native entry; Web PDF-движок должен оставаться lazy-loaded.
