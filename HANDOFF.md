# HANDOFF — Fintrack
_Обновлено: 2026-11-28 · автор витка: Claude · задача: DUP-02B.3_

Это краткая дельта. Долгий контекст и обязательные правила — в `README.md` и `AGENTS.md`.

## Где мы

Защита от дублей чеков имеет явный жизненный цикл: отменяемая проверка отделена от записи (DUP-02B.2), каждая проверка имеет уникальную «личность», а побочные эффекты сохранения (обучение правил, черновик) привязаны к аккаунту (DUP-02B.3). Цепочка: DUP-01 (matcher), DUP-02A (retrieval), DUP-02B (UI), DUP-02B.1/.2/.3 (hardening). Авто-merge/delete/блокировок нет. Схема, RLS, FX, OCR/QR-парсинг, политика матчинга и дизайн предупреждения не менялись.

**Важно про прод:** merge в `main` не доказывает деплой. DUP-01…02B.3 влиты в `main`, но из репозитория нельзя заключить, что соответствующая web/Android-сборка выпущена пользователям. Статус «в проде» подтверждается отдельно фактом деплоя. REPORTS-02.3 (векторный PDF на Web) остаётся актуальным и ждёт ручной проверки после отдельного Web deploy.

## Только что сделано

- `app/(app)/receipt/review.tsx`:
  - **Уникальная личность проверки (defect 1):** `checkDuplicatesThenSave` теперь двигает сессию — `const session = (sessionRef.current += 1)`. Approval, «Save anyway»/«Save without checking» и `onBack` привязаны к этому id (`approvalRef` + render-зеркало `approvalSession`). Устаревший callback не авторизует и не закрывает новую проверку даже при идентичных полях.
  - **Account-safe обучение правил (defect 2):** `runWrite` вызывает `learnItemCategoryRules(selections, (rules) => upsertItemCategoryRules(rules, accountId))`, биндя обучение к аккаунту, под которым шло сохранение. `accountId` снова приходит пропом из account-boundary-обёртки.
- `lib/itemCategorization.ts`: `upsertItemCategoryRules(rules, expectedUserId?)` — если текущий аутентифицированный аккаунт не совпал с `expectedUserId`, запись отклоняется (ни одного обращения к БД). Тип `RuleWriter` совместим (доп. параметр опционален).
- `contexts/ReceiptDraftContext.tsx` + `app/(app)/_layout.tsx` (**defect 3**): `ReceiptDraftProvider` получил `accountId` и сбрасывает черновик при смене аккаунта прямо во время рендера (reset-state-on-prop-change) — без окна устаревшего чтения и без ремаунта currency-провайдеров/навигатора. Layout передаёт `accountId={session.user.id}`.
- Тесты:
  - `receiptReviewDuplicate.test.tsx`: itemCategorization-мок теперь вызывает переданный writer и фиксирует `expectedUserId` (`mockUpsertRules`); +4 сценария (старый confirm не сохраняет перепроверенное предупреждение при идентичных полях; устаревший bypass не авторизует повторную неудачную проверку; устаревший Back не закрывает новое предупреждение; смена аккаунта во время записи учит правила только под originating-аккаунтом).
  - `itemCategorization.test.ts`: +2 unit-теста на владение writer (reject при несовпадении аккаунта / запись при совпадении).
  - `receiptDraftContext.test.tsx` (новый): черновик переживает рендер при том же аккаунте и сбрасывается при смене / sign-out→другой sign-in.
- Доки: `BUGS.md` (BUG-13: DUP-02B.3 findings/resolution/coverage), `CHANGELOG.md` (Fixed), `BACKLOG.md` (DUP-02B.3 ✅).

## Состояние origin/main

Ветка `main`. Один атомарный commit `fix(receipts): isolate duplicate approvals and account side effects`, запушен в `origin/main`. Затронуты review-экран, `itemCategorization.ts`, `ReceiptDraftContext.tsx`, `(app)/_layout.tsx` + тесты + docs. Политика матчинга/retrieval/схема/RLS/FX/парсинг/дизайн предупреждения не трогались.

## Следующий шаг

Задача закрыта. Опционально — живая проверка на устройстве (экран за авторизацией; здесь покрыто render/unit-тестами с управляемыми focus/account/deferred-промисами).

## Открытые решения и риски

- Предупреждение остаётся advisory: `strong` и `probable` только предупреждают.
- «Уже начавшуюся» запись в БД отменить нельзя — защищаются её UI-эффекты (гейт по сессии) и обучение правил (гейт по аккаунту в writer); сам receipt-mutation доходит до базы.
- Смена аккаунта без sign-out в приложении штатно не достижима (sign-out → Redirect размонтирует провайдеры); account-scope черновика и remount review — защита на случай in-place смены и покрыты тестами с управляемым `useAuth`.
- `useFocusEffect`/`useAuth` в тестах замоканы управляемыми реализациями; реальное поведение React Navigation/Supabase-сессии здесь не прогоняется.
- Candidate retrieval (DUP-02A) `.in('id', receiptIds)` по чекам за дату — bounded batching отдельной задачей при реальной проблеме размера.
- `typecheck` зелёный; `receiptReviewDuplicate`/`itemCategorization`/`receiptDraftContext` зелёные. Полный `test:ci` — прогнать в коммите.
- REPORTS-02.3: фактическое browser/OS-сохранение PDF остаётся manual verification после Web deploy.

## Не трогать

- Детект только для НОВОГО чека; edit обходит его. Никакого авто-merge/delete/блокировки.
- `buildDuplicateInput` — только подтверждённые значения формы, не raw OCR.
- Не сливать обе оси владения: `writeInFlightRef` снимается только в `finally` записи; инвалидация не трогает её. `savePayloadKey` покрывает все сохраняемые поля.
- Каждая проверка двигает `sessionRef` → не возвращать переиспользование одной личности проверки; approval/«Save anyway»/«без проверки»/Back привязаны к ней, потребляются один раз.
- Обучение правил привязано к originating-аккаунту (`upsertItemCategoryRules(rules, expectedUserId)`); не убирать account-guard и не определять аккаунт заново внутри writer без проверки.
- `ReceiptDraftProvider` должен оставаться account-scoped (`accountId` + reset-on-change); не ремаунтить ради этого сторонние провайдеры/навигатор.
- Account-boundary (`key` по аккаунту) у review-экрана оставить.
- `DuplicateWarningDialog` — non-destructive; не использовать destructive `ConfirmDialog` для advisory.
- Не вводить глобальный state-machine фреймворк; не утверждать, что начавшаяся запись в БД отменяема/откатываема.
- Не переносить pdfmake/VFS в общий или native entry; Web PDF-движок остаётся lazy-loaded.
