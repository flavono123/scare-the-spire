#!/usr/bin/env python3
"""Validate service/game i18n fixtures and raw localization tables."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data/sts2"
LOCALIZATION_DIR = DATA_DIR / "localization"
LANGUAGES_PATH = DATA_DIR / "languages.json"
BORROWED_PHRASES_PATH = ROOT / "data/i18n/borrowed-game-phrases.json"


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def validate_localization(errors: list[str]) -> None:
    manifest_path = LOCALIZATION_DIR / "manifest.json"
    if not manifest_path.exists():
        errors.append(f"Missing localization manifest: {manifest_path}")
        return

    manifest = read_json(manifest_path)
    language_codes = [entry["code"] for entry in read_json(LANGUAGES_PATH)]
    manifest_languages = manifest.get("languages")
    manifest_tables = manifest.get("tables")

    if manifest_languages != language_codes:
        errors.append(
            "Localization manifest languages do not match data/sts2/languages.json: "
            f"{manifest_languages!r} != {language_codes!r}"
        )

    if not isinstance(manifest_tables, list) or not manifest_tables:
        errors.append("Localization manifest has no tables.")
        return

    expected_count = len(language_codes) * len(manifest_tables)
    if manifest.get("fileCount") != expected_count:
        errors.append(
            f"Localization manifest fileCount is {manifest.get('fileCount')}, "
            f"expected {expected_count}."
        )

    actual_count = len(
        [
            path
            for path in LOCALIZATION_DIR.glob("*/*.json")
            if path.name != "manifest.json"
        ]
    )
    if actual_count != expected_count:
        errors.append(f"Localization file count is {actual_count}, expected {expected_count}.")

    for lang in language_codes:
        for table in manifest_tables:
            path = LOCALIZATION_DIR / lang / f"{table}.json"
            if not path.exists():
                errors.append(f"Missing localization table: {path.relative_to(ROOT)}")
                continue
            try:
                read_json(path)
            except json.JSONDecodeError as exc:
                errors.append(f"Invalid JSON in {path.relative_to(ROOT)}: {exc}")


def validate_borrowed_phrases(errors: list[str]) -> None:
    if not BORROWED_PHRASES_PATH.exists():
        errors.append(f"Missing borrowed phrase fixtures: {BORROWED_PHRASES_PATH}")
        return

    fixtures = read_json(BORROWED_PHRASES_PATH)
    if not isinstance(fixtures, list):
        errors.append("Borrowed phrase fixtures must be a list.")
        return

    seen_ids: set[str] = set()
    for i, fixture in enumerate(fixtures):
        prefix = f"borrowed-game-phrases[{i}]"
        phrase_id = fixture.get("id")
        if not isinstance(phrase_id, str) or not phrase_id:
            errors.append(f"{prefix}: id must be a non-empty string.")
        elif phrase_id in seen_ids:
            errors.append(f"{prefix}: duplicate id {phrase_id!r}.")
        else:
            seen_ids.add(phrase_id)

        source_lang = fixture.get("sourceLang")
        source_table = fixture.get("sourceTable")
        source_key = fixture.get("sourceKey")
        source_text = fixture.get("sourceText")
        service_text = fixture.get("serviceText")

        if not all(isinstance(v, str) and v for v in [source_lang, source_table, source_key, source_text, service_text]):
            errors.append(f"{prefix}: sourceLang/sourceTable/sourceKey/sourceText/serviceText are required.")
            continue

        source_path = LOCALIZATION_DIR / source_lang / f"{source_table}.json"
        if not source_path.exists():
            errors.append(f"{prefix}: missing source table {source_path.relative_to(ROOT)}.")
            continue

        source_data = read_json(source_path)
        actual_source = source_data.get(source_key)
        if not isinstance(actual_source, str):
            errors.append(f"{prefix}: source key {source_key!r} is missing or not a string.")
        elif source_text not in actual_source:
            errors.append(
                f"{prefix}: sourceText no longer appears in "
                f"{source_path.relative_to(ROOT)}:{source_key}."
            )

        service_files = fixture.get("serviceFiles")
        if not isinstance(service_files, list) or not service_files:
            errors.append(f"{prefix}: serviceFiles must be a non-empty list.")
        else:
            for raw_path in service_files:
                service_path = ROOT / raw_path
                if not service_path.exists():
                    errors.append(f"{prefix}: service file does not exist: {raw_path}")
                    continue
                body = service_path.read_text(encoding="utf-8")
                if service_text not in body:
                    errors.append(f"{prefix}: serviceText not found in {raw_path}.")

        replacements = fixture.get("replacements", [])
        if not isinstance(replacements, list):
            errors.append(f"{prefix}: replacements must be a list.")
            continue
        for j, replacement in enumerate(replacements):
            rp = f"{prefix}.replacements[{j}]"
            from_text = replacement.get("from")
            to_text = replacement.get("to")
            if not isinstance(from_text, str) or not isinstance(to_text, str):
                errors.append(f"{rp}: from/to must be strings.")
                continue
            if from_text and from_text not in source_text:
                errors.append(f"{rp}: from text {from_text!r} is not present in sourceText.")
            if to_text and to_text not in service_text:
                errors.append(f"{rp}: to text {to_text!r} is not present in serviceText.")


def main() -> int:
    errors: list[str] = []
    validate_localization(errors)
    validate_borrowed_phrases(errors)

    if errors:
        print("i18n validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    manifest = read_json(LOCALIZATION_DIR / "manifest.json")
    fixtures = read_json(BORROWED_PHRASES_PATH)
    print(
        "i18n validation passed: "
        f"{manifest['fileCount']} game localization files, "
        f"{len(fixtures)} borrowed phrase fixture(s)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
