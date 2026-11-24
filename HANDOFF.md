# HANDOFF — Fintrack
_Обновлено: 2026-11-24 · автор витка: ChatGPT · исполнитель: Codex_

Это краткая дельта. Долгий контекст и обязательные правила — в `README.md` и `AGENTS.md`.

## Где мы

REPORTS-02.2a подготовил Web-only основу настоящего векторного PDF поверх общей `PdfReportModel`; текущая кнопка PDF, HTML-renderer и Android-путь пока не изменены.

## Только что сделано

- Зафиксирован `pdfmake@0.3.15`; добавлен Web-only адаптер с Promise API, динамической загрузкой движка и Roboto VFS, проверкой MIME/пустого результата и типизированной ошибкой.
- Бинарный POC (`%PDF-`, `application/pdf`, 20 209 bytes) с RU/EN, кириллицей, точной суммой, переносами и таблицей прочитан независимо через `pypdf` и `pdfplumber`; текст извлекается, все 12 строк на месте, визуальный рендер без обрезки.
- Metro-проверка с временным маршрутом дала отдельные Web-чанки pdfmake (846 768 bytes) и VFS (854 652 bytes). Без потребителя production Web bundle совпал с baseline байт-в-байт; Android export не содержит маркеров движка.
- HTML PDF, CSV/XLSX, `PdfReportModel`, delivery и Reports UI не менялись. Целевые export-тесты прошли 38/38; typecheck зелёный.

## Состояние origin/main

Ветка `main`; REPORTS-02.1 опубликован как `58d6af9`, REPORTS-02.2a включён в текущий атомарный коммит. Локальный `supabase/.temp/cli-latest` не относится к задаче и не входит в коммит.

## Следующий шаг

REPORTS-02.2b: построить полноценный document definition из `PdfReportModel`, сохранив integer-cent/nullable-EUR контракты; delivery и переключение кнопки оставить отдельным последующим этапом.

## Открытые решения и риски

- Адаптер ещё не подключён к Reports UI: прямого скачивания PDF пока нет, production продолжает HTML print/save-as-PDF.
- При подключении два ленивых чанка добавят около 1,70 MB несжатого JavaScript при первом PDF-экспорте; текущий entry bundle не вырос.
- Встроенный Roboto обеспечивает проверенную кириллицу, но окончательная типографика и полный многостраничный макет относятся к REPORTS-02.2b.
- `pdfmake@0.3.15` требует Node >=20.19 для tooling; проверка выполнена на Node 24.18.0. `npm audit --omit=dev` по-прежнему видит 21 ранее существовавшее предупреждение, сам pdfmake среди уязвимых пакетов не указан.
- Обычный полный Jest дошёл до 838/839 и упёрся в известный 5-секундный cold-start timeout `expenseEditorScreen`; повтор всего набора с `--testTimeout=30000` прошёл 839/839. Export/PDF suites зелёные, production-файлы этого экрана не менялись.

## Не трогать

- Не импортировать Web PDF adapter из Android/general entry; подключать только через `.web`-границу.
- Не дублировать денежные расчёты в PDF document builder: читать готовую `PdfReportModel`.
- Не включать `supabase/.temp/*`, `.env`, сгенерированные PDF/PNG или временные Expo output-директории в коммит.
