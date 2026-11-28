# Fintrack — Backlog

Future product functionality and consciously deferred ideas. Confirmed defects and engineering correctness work live in [`BUGS.md`](./BUGS.md), not here. Implemented work is retained below as decision history rather than silently deleted.

Nothing here is a hard commitment. Priority labels preserve the existing product order; they do not imply a release date.

Cost tags: **[схема]** migration/data model · **[ИИ]** vision/LLM · **[скан]** real-receipt/device verification · **[дёшево]** mostly logic/UI over existing data.

---

## ✅ Реализовано

- **Покупка как единица на главном экране.** Home теперь `FlatList` из дневных карточек; каждая покупка — единая раскрываемая строка, позиции остаются отдельными тратами с общим `receipt_id`. **[дёшево] [скан]**
- **Личный словарь категоризации.** `item_category_rules`, dictionary-first, обучение из review; ключ одинаково нормализуется для кириллицы и латиницы. **[схема] [дёшево]**
- **ИИ-названия и категории позиций.** `categorize-items` вызывается только для незнакомых имён. **[ИИ]**
- **Фото и скриншоты чеков.** `analyze-receipt-image` работает на Android и Web; поддерживает до пяти перекрывающихся кадров одного длинного чека. **[ИИ] [скан]**
- **Нормализация и управление местами.** Переименование, объединение и удаление с перепривязкой ссылок; оригинальная печатная метка хранится отдельно. **[дёшево]**
- **Управление категориями.** Add/edit/merge/delete и безопасное перепривязывание ссылок; `uncategorized` защищена как fallback. **[дёшево]**
- **Персональные копии дефолтных категорий.** Сид новым аккаунтам, бэкофилл существующим и перепривязка трат/подписок/словаря; production-миграция применена и проверена владельцем 2026-11-17. **[схема]**
- **Экспорт.** Месячные CSV, Excel и оформленный PDF с доставкой/шарингом на Web и native. Известные ограничения валют и NULL отражены в `BUGS.md`. **[дёшево]**
- **Fixed/variable analytics.** Отдельный таб аналитики с тем же итоговым инвариантом, плюс категории/места, custom range, сортировка, средний чек, темп и прогноз. **[дёшево]**
- **Глобальное валютное ядро.** Frozen EUR anchor, Frankfurter, on-demand historical rates, основная/дополнительная валюта и display в Home/Analytics; legacy NBS-тройка пока сохраняется для отката. **[схема]**
- **RU/EN и светлая/тёмная темы.** Настройки System/RU/EN и System/Light/Dark, семантические DS-токены. **[дёшево]**
- **Адаптивная навигация и PWA.** Sidebar на широком Web, нижние табы на телефоне/native, installable PWA shell для iPhone. **[дёшево]**
- **Авторизация и поддержка аккаунта.** Состояние «проверьте почту», имя, удаление аккаунта, feedback с версией; password-reset реализован, но UI скрыт флагом до SMTP/domain setup. **[дёшево]**
- **Standalone APK и Web deploy.** EAS preview APK и EAS Hosting уже использовались; новые изменения не считаются выпущенными без отдельного deploy/release stamp. **[скан]**

## P0 · Сканирование и доверие к данным

- **Защита от дубля «QR + фото».** Один чек, внесённый двумя путями, сейчас может создать две покупки. Дедупликация по номеру/времени/итогу. **[дёшево] [скан]**
- **Возвраты и корректировки.** Чеки-рефанды и отрицательные траты пока не поддерживаются моделью ввода. **[схема]**
- **Депозиты и «мусорные» позиции.** Пакет, тара, залог — авто-исключение типовых строк; ручное исключение уже есть. **[дёшево] [скан]**
- **Веса и скидки.** Укрепить разбор весовых позиций и строк-скидок на реальных чеках. **[скан]**

## P1 · Повседневный ввод и поиск

- **Быстрый повтор / шаблоны.** Повторить последнюю трату или сохранить типовой ручной ввод. **[дёшево]**
- **Разделить трату (split).** Одна ручная оплата на несколько категорий. **[дёшево]**
- **Долги и переводы — отдельный тип.** Не смешивать временный долг с расходом; нужна модель возврата. **[схема]**
- **Пинок по «Не распознано».** Мягко показывать количество позиций, ожидающих разбора. **[дёшево]**
- **Поиск по тратам.** Название позиции, место, описание и сумма. **[дёшево]**

## P1 · Аналитика, регулярные траты и бюджеты

- **Тренды между периодами.** Динамика категорий/мест и сравнение периодов поверх существующего range backend. **[дёшево]**
- **Автодетект подписок.** Повторяющееся списание предлагает создать подписку; не угадывать молча. **[дёшево]**
- **Прогноз и напоминания по подпискам.** Ближайшие списания и годовая стоимость. Таблица `subscriptions` есть, полного продукта нет. **[дёшево]**
- **Бюджеты и лимиты по категориям.** Например, лимит на кафе за месяц. **[дёшево]**
- **Правка задним числом и аналитика.** Осознанно решить, остаются ли прошлые отчёты «живыми» или период можно замораживать. **[дёшево]**

## P2 · Деньги и синхронизация

- **Оплата картой в другой валюте.** Решить, что считать оригиналом: сумму чека или банковское списание. **[схема?]**
- **Сверка округления между валютами.** Итог оригинала точный, а сумма округлённых эквивалентов может отличаться на цент; определить продуктовый показ. **[дёшево]**
- **Мультиустройство и конфликты.** Supabase синхронизирует данные, но нужна явная политика конкурентных правок/last-write. **[дёшево]**

## Позже · сознательно отложенные направления

- **Доходы**, а не только расходы. **[схема]**
- **Кошельки/счета**: наличные, карта, валютный кошелёк. **[схема]**
- **Теги** поверх категорий, например поездка/событие. **[схема]**
- **Импорт/экспорт наборов категорий и кросс-юзерный шаринг.** Не входят в текущую персональную модель. **[схема]**

---

## Рекомендованный порядок (ориентир)

**Скоро** — возвраты · дубль QR+фото · пинок по «Не распознано».

**Потом** — быстрый повтор/шаблоны · долги как тип · split · поиск.

**Позже** — подписки-автодетект · прогнозы · бюджеты · тренды · доходы/кошельки/теги.

---

*Реализованное переносить в историю выше, а не удалять молча. Баги и инженерный долг вести в `BUGS.md`; production-готовность не выводить только из наличия кода в `main`.*

---

# Small high-value contributions

Долговременная очередь маленьких улучшений, к которой можно возвращаться между большими фичами. Критерии попадания: очевидная польза, малый/средний scope, минимум архитектурного риска, желательно без новой схемы и зависимостей, укладывается в один атомарный commit, удобно для коротких заходов — и это реальное улучшение, а не дробление ради activity. Детали каждой задачи формируются отдельным task prompt позже.

| ID | Status | Area | Value | Size | What / Why |
|---|---|---|---|---|---|
| TEMP-01 | ✅ Done | DX | ★★★★★ | XS | Убрать `supabase/.temp/` из Git и добавить в `.gitignore` — локальное состояние Supabase CLI засоряло `git status`. `2b8bd4b` |
| MONEY-01 | ✅ Done | Frontend / Data | ★★★★★ | S | Принимать сербский сгруппированный формат сумм (`1.234,56`, `1 234,56`, NBSP) — раньше отклонялся. `b09e395` |
| CI-01 | ✅ Done | DX / CI | ★★★★★ | S | GitHub Actions: typecheck + Jest на push/PR — автоматически ловит регрессии каждого следующего contribution. `b48708d` |
| REPORTS-UI-01 | ✅ Done | Frontend / Design System | ★★★★☆ | XS/S | Перевести CSV/Excel/PDF/Save PDF на общий DS Button — убрана параллельная самодельная реализация кнопок. `b4e7e69` |
| MERCHANT-01 | ✅ Done | Backend / Data integrity | ★★★★☆ | XS | Единый helper `requireMerchantName()` для create+rename; пустые/whitespace имена отклоняются, trimmed Unicode сохраняется, покрыто тестами. Раньше `createMerchant()` мог отправить в БД пустую строку после `.trim()`. `5657892` |
| EXPENSE-AMOUNT-01 | ✅ Done | Backend / Data integrity | ★★★★★ | S | Write-layer гарантирует positive safe-integer cents через общий `isPositiveCents()`: manual expenses (`insertExpense`/`updateExpense`) и новые receipt items (`saveFiscalReceipt`) отклоняют `0`/негатив/дробные/overflow до FX и записи. Refunds по-прежнему вне scope. |
| I18N-01 | ⬜ Todo | i18n / Data integrity | ★★★★★ | S/M | Не переводить пользовательскую category, если её имя совпало с seeded (custom `Продукты` не должна стать `Groceries`). Связано с `BUG-5`. |
| I18N-02 | ⬜ Todo | i18n / Data integrity | ★★★★★ | S/M | То же для пользовательских group names (custom `Еда` остаётся пользовательским текстом). Вторая часть `BUG-5`. |
| UNCAT-01 | ⬜ Todo | Frontend / Data quality | ★★★★★ | S | Показывать количество расходов/позиций в «Не распознано» — плохие данные сейчас легко забыть. Первый шаг backlog «пинок по Не распознано». |
| UNCAT-02 | ⬜ Todo | Frontend / Navigation | ★★★★☆ | S | Сделать индикатор «Не распознано» кликабельным: переход сразу к соответствующим расходам/review flow. Зависит от UNCAT-01. |
| REPEAT-01 | ⬜ Todo | Frontend / Everyday input | ★★★★★ | S/M | Добавить «Repeat expense» для manual expense — первый шаг backlog «Быстрый повтор/шаблоны». Без templates в этой задаче. |
| CURRENCY-INPUT-01 | ✅ Done | Frontend / Input UX | ★★★★☆ | XS/S | Новый manual expense открывается в валюте: последняя сохранённая (account-scoped AsyncStorage) → домашняя валюта → device-default. Запоминается только после успешного создания (не при edit/receipt/cancel/fail); custom-валюты и storage-сбои обработаны. Редактирование сохраняет оригинальную валюту траты. Follow-up (`BUG-12`): разрешение валюты привязано к focus-lifecycle — на остающемся mounted экране (`expense/new` в Tabs) повторное открытие больше не берёт устаревшую валюту; stale-ответы и гонка с записью исключены. Кэш последней валюты перенесён в `lib/lastCurrency.ts` (account-scoped, module-level: переживает remount, закрывает гонку и для нового инстанса экрана), запись сериализована per-account; экран обёрнут в account-keyed boundary, поэтому смена аккаунта не показывает данные предыдущего. |
| DUP-01 | ✅ Done | Backend / Data trust | ★★★★★ | S | Чистый deterministic helper `matchReceiptDuplicate` (`lib/receiptDuplicates.ts`): probable-дубль требует совпадения positive integer-cent total, валюты, локальной даты и merchant-идентичности (id или нормализованное имя); timestamp/tax-id усиливают, конфликт известных tax-id или заметно разных времён блокирует; null никогда не равенство. `strong` при совпадении точного времени (всё равно advisory), иначе probable; дата берётся из локального префикса (без UTC-сдвига). Только detection + tests, без retrieval/save/UI. |
| DUP-02A | ✅ Done | Backend / Data trust | ★★★★★ | S | Read-only repository `findReceiptDuplicates` (`lib/db/receiptDuplicates.ts`): кандидаты — чеки аккаунта за ту же локальную дату через `expenses.occurred_on` (не из timestamptz/raw_json); один чек — один кандидат; saved `total`/`currency`; маппинг в `ReceiptDuplicateInput` + `matchReceiptDuplicate`; явный account-scope + RLS, `fetchAllRows` с детерминированным order; ошибки пробрасываются. Harden matcher: `confirmed`→`strong`, детерминированный разбор timestamp (нужен offset), fallback имя→label. Без save/UI. |
| DUP-02B | ✅ Done | Frontend / Data trust | ★★★★★ | S/M | Review перед сохранением нового чека вызывает `findReceiptDuplicates` (по подтверждённым значениям формы) и при совпадениях показывает advisory `DuplicateWarningDialog` (не destructive ConfirmDialog): «Вернуться к проверке» / «Всё равно сохранить». Ничего не мёржит/не удаляет/не блокирует. Lifecycle: sync-guard от двойного сохранения, stale/token-защита, retry и «сохранить без проверки» при сбое проверки, edit обходит детект. Full feature. |
| DUP-02B.1 | ✅ Done | Frontend / Data trust | ★★★★★ | S | Hardening lifecycle проверки дублей (follow-up к DUP-02B, `BUG-13`): каждая проверка/подтверждение привязаны к аккаунту, draft, навигационной сессии и проверенному снимку сохранения. Токен-замок (`inFlightRef` хранит токен операции; `endOperation` снимает только по совпадающему токену), `checkedSnapshotRef`+`buildSnapshotKey`, инвалидация по полям/аккаунту/draft и `useFocusEffect` (blur, не только unmount), `useAuth` для account-scope. Правка поля во время pending-проверки/после ошибки больше не сохраняет непроверенные значения и не показывает устаревшее предупреждение; «Save anyway»/«без проверки» авторизуют ровно проверенный снимок; failed save retryable. +9 lifecycle-тестов (24/24). Без state-machine фреймворка, без изменения матчинг-политики. |
| DUP-02B.2 | ✅ Done | Frontend / Data trust | ★★★★★ | S | Разделение отменяемой проверки дублей и активной записи (follow-up к DUP-02B.1, `BUG-13`): один `sessionRef` для отменяемой сессии, `checkInFlightRef` (проверка, отменяема) и `writeInFlightRef` (запись, снимается только в своём `finally` — инвалидация её не трогает). `savePayloadKey` покрывает все сохраняемые поля (включая позиции: сумма/включение/категория/описание и ручной RSD-эквивалент). Approval привязан к сессии (`approvalRef` + render-зеркало `approvalSession`) и потребляется один раз → повторное/устаревшее подтверждение (даже при идентичных полях) — no-op. `runWrite` гейтит toast/clearDraft/navigation по текущей сессии → устаревшая запись не трогает чужой черновик/сессию. Экран обёрнут в account-boundary (`key`), смена аккаунта ремаунтит и перезагружает reference data. +7 тестов (31/31). Без state-machine, без изменения матчинг-политики/UI предупреждения. |
| DUP-02B.3 | ✅ Done | Frontend / Data trust | ★★★★★ | S | Уникальная личность проверки + account-safe побочные эффекты (follow-up к DUP-02B.2, `BUG-13`): каждая проверка двигает `sessionRef` → уникальный id, к которому привязаны approval, «Save anyway»/«без проверки» и Back; устаревший callback — no-op даже при идентичных полях. `upsertItemCategoryRules(rules, expectedUserId)` отклоняет запись при смене аккаунта; `runWrite` биндит обучение правил к originating `accountId`. `ReceiptDraftProvider` получил `accountId` и сбрасывает черновик при смене аккаунта (reset-on-prop-change), не ремаунтя сторонние провайдеры. Тесты: review (старый confirm/bypass/Back не действует на новую проверку; обучение только под originating-аккаунтом), unit rule-writer (reject при несовпадении аккаунта / запись при совпадении), ReceiptDraftProvider (сброс при смене/сохранение при том же). Разделение проверки/записи DUP-02B.2 сохранено. |
| REPORTS-EMPTY-01 | ⬜ Todo | Frontend / Reports UX | ★★★☆☆ | XS | Улучшить empty state Reports: почему экспорт недоступен и что появится после добавления расходов. Без redesign страницы. |
| REPORTS-LOADING-01 | ✅ Done | Frontend / Reports UX | ★★★☆☆ | XS | Прогресс экспорта теперь указывает формат: `activeFormat` (`'csv'/'xlsx'/'pdf'`) выводит `Preparing CSV…` / `Preparing Excel…` / `Generating PDF…` (RU аналогично) вместо общего `export.exporting`. Переиспользует существующий индикатор/лейаут; дубликат-защита, disabled-состояния, обработка ошибок, prepared-PDF и Save PDF не изменены. |
| INPUT-LIMITS-01 | 🔎 Verify first | Frontend / Data integrity | ★★★★☆ | S | Проверить max length для description/category name/merchant name/notes; добавить разумные limits, если их нет. Защита UI, exports и PDF от гигантских строк. Audit до ограничений. |
| DB-INDEX-01 | 🔎 Verify first | Backend / Database | ★★★★☆ | S | Проверять hot queries на недостающий индекс; добавлять только при частом использовании и понятном query pattern. `expenses(user_id, occurred_on)` уже есть — не дублировать. |
| BUGDOC-01 | ✅ Done | DX / Documentation | ★★☆☆☆ | XS | Stale `BUG-7 Commit: PENDING` в `BUGS.md` заменён на фактический SHA `8f27e38` (найден в git history как коммит, добавивший `lib/db/pagination.ts`). Выполнено попутно с `PAGINATION-01`, без отдельного commit. |
| MERCHANT-02 | ✅ Done | Backend / Data integrity | ★★★★☆ | S | Понятная обработка дубля места: общий `findMerchantNameCollision()` делает client preflight в `MerchantPicker` (дубль не уходит в Supabase, picker остаётся открыт, явное сообщение `merchant.existsAdd`), а `createMerchant()` маппит DB unique violation (`23505`) в typed `MerchantAlreadyExistsError` как race-fallback. DB constraint сохранён. |
| CATEGORY-01 | ✅ Done | Backend / Data integrity | ★★★★☆ | S | Audit подтвердил существующую repository trim/required-валидацию (`cleanCategoryInput`: name/emoji/group обязательны). Duplicate category names намеренно не запрещены схемой и поддерживаются через Merge, поэтому искусственный uniqueness-constraint не вводился. Docs-only отражение аудита. |
| RECEIPT-01 | ✅ Done | Backend / Data trust | ★★★★★ | S | Audit подтвердил orphan-merchant gap: новый merchant создавался до receipt, но cleanup его не удалял. Добавлено удаление созданного этим save-flow merchant после failed save (только при успешном cleanup зависимых строк; existing merchant не трогается; cleanup-ошибки не маскируют исходную). Failure paths покрыты тестами. См. `BUG-10`. |
| EXPENSE-01 | ✅ Done | Backend / Ownership | ★★★★★ | S | Audit подтвердил, что RLS на `expenses` уже ограничивает строки `user_id = auth.uid()`; явный второй ownership-filter в запросах не добавлялся, т.к. не даёт дополнительной security-гарантии. Docs-only отражение аудита. |
| EXPENSE-02 | ✅ Done | Frontend / UX | ★★★★☆ | XS/S | Audit (docs-only) подтвердил, что `handleSave()` в `ExpenseEditorScreen` уже показывает DS Toast после сохранения — `toast.success(t(initialExpense ? 'toast.changesSaved' : 'toast.expenseSaved'))`. Отдельный success feedback уже есть; код не дублировался. |
| DELETE-01 | ✅ Done | Frontend / Data safety | ★★★★★ | S | Audit (docs-only) подтвердил `ConfirmDialog` на всех необратимых удалениях: покупка на Home (`index.tsx`), ручная трата (`ExpenseEditorScreen`), категория (`categories.tsx`), место (`merchants.tsx`). Accidental single-tap deletion отсутствует; дополнительных confirmation не потребовалось, код не менялся. |
| ERROR-01 | 🔎 Verify first | Frontend / Error UX | ★★★★☆ | S | Найти flows, где db/network error виден только через `console.error`/generic text, хотя пользователь может действовать. Чинить по одному flow. Без глобального error-system rewrite. |
| RETRY-01 | ✅ Done | Frontend / Reliability | ★★★★☆ | XS/S | Reports получил Retry на ошибке загрузки данных по общему паттерну (retryKey + action на `StatusBanner`, рефетч обоих датасетов за выбранный месяц, отдельный `export.loadFailed`). Теперь все пять аудированных экранов (Home, Analytics, Categories, Merchants, Reports) имеют load-error recovery. См. `BUG-11`. |
| ACCESSIBILITY-01 | 🔎 Verify first | Frontend / Accessibility | ★★★★☆ | XS/S | Проверять интерактивные controls на accessibilityRole/accessibilityLabel/disabled semantics; чинить по одному экрану/компоненту. Без огромного audit одним commit. |
| TOUCH-01 | 🔎 Verify first | Frontend / Mobile UX | ★★★★☆ | XS/S | Найти слишком маленькие touch targets (inline icons, chevrons, remove actions, compact controls); чинить точечно через DS-размеры/hitSlop. |
| EMPTY-01 | 🔎 Verify first | Frontend / UX | ★★★☆☆ | XS | Проверять пустые состояния: что здесь будет, почему сейчас пусто, что пользователь может сделать. Улучшать по одному экрану. |
| LOADING-01 | 🔎 Verify first | Frontend / UX | ★★★☆☆ | XS/S | Найти экраны, прыгающие empty→content при загрузке; чинить подтверждённые случаи (правильный loading state, без ложного empty-state flash). |
| DATE-01 | 🔎 Verify first | Frontend / Data correctness | ★★★★★ | S | Проверить boundary дат: конец/начало месяца, DST, UTC timestamp → Europe/Belgrade. Date helpers и tests уже есть — фикс только при реальном gap. |
| PAGINATION-01 | ✅ Done | Backend / Data reliability | ★★★★★ | S | Management usage-reads и merge/delete reference-snapshots (category + merchant) теперь исчерпывают страницы через `fetchAllRows` с детерминированным `order('id')`; ошибка любой страницы прерывает операцию до мутаций, поэтому merge/delete не начинается на неполном snapshot. Малые справочники (списки категорий/мест) оставлены single-read. См. `BUG-9`. |
| SEARCH-01 | ⬜ Todo | Frontend / Everyday use | ★★★★★ | M | Первый шаг backlog «Поиск по тратам»: поиск только в уже загруженном периоде по description/merchant/category. Без server-side FTS и новой схемы. Сначала проверить перф и структуру Home. |
| COPY-01 | 🔎 Verify first | Frontend / UX writing | ★★★☆☆ | XS | Заменять generic сообщения (`Ошибка`, `Не удалось`, `Something went wrong`) на actionable copy по одному flow, если пользователь может что-то сделать. Не менять тексты ради стилистики. |
| DS-MIGRATION-01 | 🔎 Verify first | Frontend / Design System | ★★★★☆ | XS/S | Мигрировать самодельные controls на существующие DS (Button/Input/Checkbox/Radio/Toggle/SearchField/IconButton); один экран/один тип за commit. REPORTS-UI-01 — выполненный пример. |
| CI-02 | ⬜ Todo | DX | ★★★☆☆ | XS | Позже обновить `actions/checkout@v4` и `actions/setup-node@v4` до актуальных major, если остаётся deprecation annotation про internal Node runtime. CI зелёный — priority низкий. |
| EXPORT-VERIFY-01 | ⬜ Todo | Reports / Testing | ★★★★☆ | S | Лёгкая deterministic валидация свежих CSV/XLSX (parseable, reopenable, равные row counts, totals reconcile). Проверить переиспользование существующего harness в CI без browser/export delivery. Без browser automation. |
| PDF-UX-01 | ⬜ Todo | Reports / Frontend | ★★★★★ | M | Redesign PDF как premium financial report. Отдельная большая задача после маленькой очереди; не дробить визуальный redesign на бессмысленные commit-ы. |

### Правила этой очереди

1. `✅ Done` не удалять сразу — оставлять как историю небольших improvements.
2. Если задача выросла до большой feature/schema work — переносить в основной backlog выше.
3. Подтверждённый defect переносить в `BUGS.md`.
4. `🔎 Verify first` нельзя реализовывать без проверки текущего кода.
5. Один contribution должен иметь самостоятельную пользовательскую или инженерную ценность.
6. Не дробить один логический фикс только ради количества commits.
7. После выполнения обновлять Status и при необходимости указывать short commit SHA.
