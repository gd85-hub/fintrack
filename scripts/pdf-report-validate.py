"""Independently validates PDFs made by pdf-report-validation.js.

Requires pypdf and pdfplumber in the audit environment. It does not generate
PDFs and is not part of the application runtime.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


PAGE_MARGIN_X = 36.0
PAGE_WIDTH = 595.28
RIGHT_MARGIN_X = PAGE_WIDTH - PAGE_MARGIN_X
GEOMETRY_TOLERANCE = 0.5


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\u2009", " ")).strip()


def require_text(haystack: str, needle: str, context: str) -> None:
    normalized_needle = normalize(needle)
    if normalized_needle not in haystack:
        raise AssertionError(f"{context}: missing text {normalized_needle!r}")


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/pdf-report-validate.py <directory>")

    output_directory = Path(sys.argv[1]).resolve()
    manifest = json.loads((output_directory / "manifest.json").read_text("utf-8"))
    results: list[dict[str, object]] = []

    for entry in manifest:
        pdf_path = output_directory / entry["file"]
        raw = pdf_path.read_bytes()
        if raw[:5] != b"%PDF-":
            raise AssertionError(f"{entry['name']}: invalid PDF signature")
        if len(raw) != entry["byteLength"] or len(raw) == 0:
            raise AssertionError(f"{entry['name']}: unexpected byte length")

        pypdf_reader = PdfReader(str(pdf_path))
        if pypdf_reader.is_encrypted:
            raise AssertionError(f"{entry['name']}: PDF is unexpectedly encrypted")
        pypdf_text = normalize(
            "\n".join(page.extract_text() or "" for page in pypdf_reader.pages)
        )

        with pdfplumber.open(str(pdf_path)) as plumber_reader:
            plumber_page_text = [page.extract_text() or "" for page in plumber_reader.pages]
            plumber_text = normalize("\n".join(plumber_page_text))
            plumber_pages = len(plumber_reader.pages)

            detail_start = next(
                (
                    index
                    for index, text in enumerate(plumber_page_text)
                    if entry["detailsLabel"] in text
                ),
                None,
            )
            if entry["rowCount"] > 0 and detail_start is None:
                raise AssertionError(f"{entry['name']}: details section not found")

            geometry_pages = []
            if detail_start is not None and entry["rowCount"] > 0:
                for page_index in range(detail_start, plumber_pages):
                    page = plumber_reader.pages[page_index]
                    words = [
                        word
                        for word in page.extract_words()
                        if word["top"] < page.height - 35
                    ]
                    if not words:
                        raise AssertionError(
                            f"{entry['name']} page {page_index + 1}: no detail text"
                        )
                    min_x0 = min(word["x0"] for word in words)
                    max_x1 = max(word["x1"] for word in words)
                    if min_x0 < PAGE_MARGIN_X - GEOMETRY_TOLERANCE:
                        raise AssertionError(
                            f"{entry['name']} page {page_index + 1}: "
                            f"text crosses left margin ({min_x0:.2f})"
                        )
                    if max_x1 > RIGHT_MARGIN_X + GEOMETRY_TOLERANCE:
                        raise AssertionError(
                            f"{entry['name']} page {page_index + 1}: "
                            f"text crosses right margin ({max_x1:.2f})"
                        )

                    table_objects = [
                        obj
                        for obj in page.lines + page.rects
                        if obj["top"] < page.height - 35
                    ]
                    object_max_x1 = max(
                        (obj["x1"] for obj in table_objects),
                        default=RIGHT_MARGIN_X,
                    )
                    if object_max_x1 > RIGHT_MARGIN_X + GEOMETRY_TOLERANCE:
                        raise AssertionError(
                            f"{entry['name']} page {page_index + 1}: "
                            f"table geometry crosses right margin ({object_max_x1:.2f})"
                        )

                    first_header = entry["detailHeaders"][0]
                    second_header = entry["detailHeaders"][1]
                    first_tops = {
                        round(word["top"], 1)
                        for word in words
                        if word["text"] == first_header
                    }
                    second_tops = {
                        round(word["top"], 1)
                        for word in words
                        if word["text"] == second_header
                    }
                    shared_header_tops = sorted(first_tops & second_tops)
                    if len(shared_header_tops) != 1:
                        raise AssertionError(
                            f"{entry['name']} page {page_index + 1}: "
                            f"detail header rows at {shared_header_tops}, expected exactly one"
                        )

                    geometry_pages.append(
                        {
                            "page": page_index + 1,
                            "minX": round(min_x0, 2),
                            "maxX": round(max_x1, 2),
                            "tableMaxX": round(object_max_x1, 2),
                            "headerRows": len(shared_header_tops),
                        }
                    )

        if plumber_pages != len(pypdf_reader.pages):
            raise AssertionError(f"{entry['name']}: parser page counts disagree")

        for expected in entry["requiredText"]:
            require_text(pypdf_text, expected, f"{entry['name']} (pypdf)")
            require_text(plumber_text, expected, f"{entry['name']} (pdfplumber)")
        for token in entry["rowTokens"]:
            require_text(pypdf_text, token, f"{entry['name']} row (pypdf)")
            require_text(plumber_text, token, f"{entry['name']} row (pdfplumber)")

        results.append(
            {
                "name": entry["name"],
                "pages": len(pypdf_reader.pages),
                "bytes": len(raw),
                "rows": entry["rowCount"],
                "rowTokens": len(entry["rowTokens"]),
                "purchases": entry["purchaseCount"],
                "geometry": {
                    "pages": len(geometry_pages),
                    "minX": min(
                        (page["minX"] for page in geometry_pages),
                        default=None,
                    ),
                    "maxX": max(
                        (page["maxX"] for page in geometry_pages),
                        default=None,
                    ),
                    "tableMaxX": max(
                        (page["tableMaxX"] for page in geometry_pages),
                        default=None,
                    ),
                    "headerRows": sorted(
                        {page["headerRows"] for page in geometry_pages}
                    ),
                },
            }
        )

    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
