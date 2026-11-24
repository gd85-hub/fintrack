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
            plumber_text = normalize(
                "\n".join(page.extract_text() or "" for page in plumber_reader.pages)
            )
            plumber_pages = len(plumber_reader.pages)

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
            }
        )

    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
