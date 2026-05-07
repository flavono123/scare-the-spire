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
CODEX_RAW_DIR = DATA_DIR / "kor"

# Thai STS2 localization currently ships with a partial gameplay table set.
# Validate exact targeted regressions there, but do not fail full codex coverage
# until the upstream source has complete entity title coverage.
PARTIAL_CODEX_TITLE_LOCALES = {"tha"}
CODEX_TITLE_TABLES = [
    "cards",
    "relics",
    "potions",
    "powers",
    "enchantments",
    "events",
    "ancients",
    "monsters",
    "encounters",
]
REGRESSION_TITLE_KEYS = {
    "cards": ["BLADE_OF_INK.title"],
}


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
        mode = fixture.get("mode", "serviceText")
        service_text = fixture.get("serviceText")

        if not all(isinstance(v, str) and v for v in [source_lang, source_table, source_key, source_text]):
            errors.append(f"{prefix}: sourceLang/sourceTable/sourceKey/sourceText are required.")
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

        if mode == "serviceText":
            if not isinstance(service_text, str) or not service_text:
                errors.append(f"{prefix}: serviceText is required for serviceText mode.")
                continue

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
        elif mode == "gameLocaleRuntime":
            replacement_table = fixture.get("replacementTable")
            replacement_key = fixture.get("replacementKey")
            replacement_text = fixture.get("replacementText")
            if not all(isinstance(v, str) and v for v in [replacement_table, replacement_key, replacement_text]):
                errors.append(
                    f"{prefix}: replacementTable/replacementKey/replacementText are required "
                    "for gameLocaleRuntime mode."
                )
            else:
                replacement_path = LOCALIZATION_DIR / source_lang / f"{replacement_table}.json"
                if not replacement_path.exists():
                    errors.append(f"{prefix}: missing replacement table {replacement_path.relative_to(ROOT)}.")
                else:
                    replacement_data = read_json(replacement_path)
                    actual_replacement = replacement_data.get(replacement_key)
                    if actual_replacement != replacement_text:
                        errors.append(
                            f"{prefix}: replacementText does not match "
                            f"{replacement_path.relative_to(ROOT)}:{replacement_key}."
                        )

            runtime_files = fixture.get("runtimeFiles")
            if not isinstance(runtime_files, list) or not runtime_files:
                errors.append(f"{prefix}: runtimeFiles must be a non-empty list.")
            else:
                for raw_path in runtime_files:
                    runtime_path = ROOT / raw_path
                    if not runtime_path.exists():
                        errors.append(f"{prefix}: runtime file does not exist: {raw_path}")
        else:
            errors.append(f"{prefix}: unknown mode {mode!r}.")
            continue

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
            target_text = service_text if mode == "serviceText" else fixture.get("replacementText", "")
            if to_text and to_text not in target_text:
                errors.append(f"{rp}: to text {to_text!r} is not present in target text.")


def power_localization_base(power_table: dict[str, str], power_id: str) -> str:
    power_key = f"{power_id}_POWER"
    if f"{power_key}.title" in power_table or f"{power_key}.smartDescription" in power_table:
        return power_key
    return power_id


def validate_codex_entity_titles(errors: list[str]) -> None:
    language_codes = [entry["code"] for entry in read_json(LANGUAGES_PATH)]

    for lang in language_codes:
        for table, keys in REGRESSION_TITLE_KEYS.items():
            source = read_json(LOCALIZATION_DIR / lang / f"{table}.json")
            for key in keys:
                if not isinstance(source.get(key), str) or not source[key]:
                    errors.append(f"{lang}/{table}.json is missing regression key {key!r}.")

    complete_languages = [lang for lang in language_codes if lang not in PARTIAL_CODEX_TITLE_LOCALES]
    raw = {
        table: read_json(CODEX_RAW_DIR / f"{table}.json")
        for table in ["cards", "relics", "potions", "powers", "enchantments", "events", "monsters", "encounters"]
    }

    for lang in complete_languages:
        tables = {
            table: read_json(LOCALIZATION_DIR / lang / f"{table}.json")
            for table in CODEX_TITLE_TABLES
        }
        missing: list[str] = []

        for item in raw["cards"]:
            if item.get("deprecated") or not (item.get("image_url") or item.get("beta_image_url")):
                continue
            key = f"{item['id']}.title"
            if key not in tables["cards"]:
                missing.append(f"cards:{key}")

        for item in raw["relics"]:
            key = f"{item['id']}.title"
            if key not in tables["relics"]:
                missing.append(f"relics:{key}")

        for item in raw["potions"]:
            key = f"{item['id']}.title"
            if key not in tables["potions"]:
                missing.append(f"potions:{key}")

        for item in raw["powers"]:
            if item.get("deprecated") or (item.get("type") == "None" and not item.get("description")):
                continue
            base = power_localization_base(tables["powers"], item["id"])
            key = f"{base}.title"
            if key not in tables["powers"]:
                # The codex loader hides powers that have no game title source.
                continue

        for item in raw["enchantments"]:
            key = f"{item['id']}.title"
            if key not in tables["enchantments"]:
                missing.append(f"enchantments:{key}")

        for item in raw["events"]:
            if item.get("type") == "Ancient":
                key = f"{item['id']}.title"
                if key not in tables["ancients"]:
                    missing.append(f"ancients:{key}")
                continue
            if item.get("image_url") and "/ancients/" in item["image_url"]:
                continue
            if not item.get("description"):
                continue
            key = f"{item['id']}.title"
            if key not in tables["events"]:
                missing.append(f"events:{key}")

        for item in raw["monsters"]:
            key = f"{item['id']}.name"
            if key not in tables["monsters"]:
                missing.append(f"monsters:{key}")

        for item in raw["encounters"]:
            key = f"{item['id']}.title"
            if key not in tables["encounters"]:
                missing.append(f"encounters:{key}")

        if missing:
            sample = ", ".join(missing[:20])
            suffix = f" and {len(missing) - 20} more" if len(missing) > 20 else ""
            errors.append(f"{lang}: missing codex entity localization keys: {sample}{suffix}.")


def main() -> int:
    errors: list[str] = []
    validate_localization(errors)
    validate_borrowed_phrases(errors)
    validate_codex_entity_titles(errors)

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
