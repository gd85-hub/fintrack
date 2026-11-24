# HANDOFF — Fintrack
_Обновлено: 2026-11-24 · автор витка: ChatGPT · исполнитель: Codex_

Это краткая дельта. Долгий контекст и обязательные правила — в `README.md` и `AGENTS.md`.

## Где мы

REPORTS-02.2b завершает production-quality векторный PDF-renderer поверх `PdfReportModel`; он проверен, но ещё не подключён к кнопке Reports и delivery.

## Только что сделано

- Добавлен чистый `buildPdfDocument(model)`: A4/Roboto, header, summary, nullable-EUR warning, четыре метрики, категории с долями/цветами, дневная детализация и footer с нумерацией.
- Добавлена Web-only связка `generateWebPdfReportBlob(model)`, соединяющая document builder с существующим pdfmake engine; Android/general entry её не импортируют.
- Для больших отчётов первая страница остаётся executive summary, Details начинается со следующей; колонная шапка повторяется, день держится только с первой строкой, а остальная группа свободно переносится без удержания целого дня.
- Production validation harness сгенерировал 10 настоящих PDF: empty, single, receipt lines, mixed currencies, nullable EUR, Unicode, long labels, real Other + aggregated Other, 1003 rows и 180 rows in one day.
- `pypdf` и `pdfplumber` нашли все 1003/1003 и 180/180 row tokens, точные итоги/дни/категории и warning. Большой отчёт — 37 страниц; один длинный день — 8. Визуально проверены первая, средняя, последняя и continuation-страницы, а также long labels, nullable EUR и Other page 2.

## Состояние origin/main

Ветка `main`; REPORTS-02.2a опубликован как `d19aa08`, REPORTS-02.2b включён в текущий атомарный коммит. Локальный `supabase/.temp/cli-latest` не относится к задаче и не входит в коммит.

## Следующий шаг

REPORTS-02.3: подключить готовый Web PDF Blob к реальному экспорту с `fintrack-YYYY-MM.pdf`, корректным browser download и Safari/iOS PWA fallback; Android HTML/`expo-print` оставить прежним до отдельного решения.

## Открытые решения и риски

- Пользователь пока получает старый HTML print/save-as-PDF: новый renderer намеренно не подключён к Reports UI или delivery.
- `pdfmake@0.3.15` некорректно продолжает таблицу, начатую после высокого summary, поверх верхнего поля. Для наборов больше 20 строк Details начинает новую страницу; это проверенный layout contract, не попытка удержать весь день.
- Векторный PDF сохраняет текущий RSD/EUR/USD контракт и nullable EUR; BUG-3 про фиксированные валютные колонки этим этапом не решается.
- Целевые тесты прошли 43/43, полный Jest — 47 suites и 844/844 теста, typecheck/Web export/Android export зелёные; Android bundle не содержит Web PDF engine.

## Не трогать

- Не дублировать финансовые расчёты в renderer: document builder принимает только готовую `PdfReportModel`.
- Не импортировать `exportPdfReport.web.ts` из Android/general entry; подключение выполняется отдельным REPORTS-02.3.
- Не менять HTML PDF, `exportDelivery.ts`, Reports UI, CSV/XLSX или валютный контракт в рамках подключения Web Blob.
- Не включать `supabase/.temp/*`, `.env`, сгенерированные PDF/PNG или временные Expo output-директории в коммит.
