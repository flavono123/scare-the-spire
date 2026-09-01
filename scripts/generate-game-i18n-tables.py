#!/usr/bin/env python3
"""Merge game `.title` loc into `src/lib/sts2-game-i18n/{locale}.json`.

History Course hover (and other `useGameI18n` surfaces) look up titles from
these compact tables. They drifted behind `data/sts2/localization` after
new relics/cards landed, so run history showed ids like RELIC.KALEIDOSCOPE.

  python3 scripts/generate-game-i18n-tables.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOC_DIR = ROOT / "data/sts2/localization"
OUT_DIR = ROOT / "src/lib/sts2-game-i18n"
KO_LEGACY = ROOT / "src/lib/sts2-i18n-ko.json"

GAME_LOCALES = [
    "kor",
    "eng",
    "zhs",
    "jpn",
    "deu",
    "fra",
    "ita",
    "spa",
    "esp",
    "ptb",
    "rus",
    "pol",
    "tha",
    "tur",
]

# Compact table name → localization file. Keys are loc `.title` with the suffix
# stripped, matching the existing `sts2-game-i18n` shape.
TITLE_TABLES = {
    "encounters": "encounters.json",
    "events": "events.json",
    "ancients": "ancients.json",
    "relics": "relics.json",
    "cards": "cards.json",
    "potions": "potions.json",
    "acts": "acts.json",
    "enchantments": "enchantments.json",
    "characters": "characters.json",
}


def loc_titles(locale: str, filename: str) -> dict[str, str]:
    path = LOC_DIR / locale / filename
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    for key, value in data.items():
        if not isinstance(value, str) or not key.endswith(".title"):
            continue
        out[key[: -len(".title")]] = value
    return out


def merge_titles(existing: dict[str, str], incoming: dict[str, str]) -> dict[str, str]:
    merged = dict(existing)
    merged.update(incoming)
    return {key: merged[key] for key in sorted(merged)}


def alias_renamed_keys(table: str, titles: dict[str, str]) -> dict[str, str]:
    # Older `.run` files store the unversioned dummy encounter id.
    if table == "encounters" and "BATTLEWORN_DUMMY_EVENT_ENCOUNTER" not in titles:
        for version in ("V1", "V2", "V3"):
            key = f"BATTLEWORN_DUMMY_EVENT_{version}_ENCOUNTER"
            if key in titles:
                titles["BATTLEWORN_DUMMY_EVENT_ENCOUNTER"] = titles[key]
                break
    return titles


def write_compact(path: Path, payload: dict) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    added: dict[str, list[str]] = {}
    for locale in GAME_LOCALES:
        out_path = OUT_DIR / f"{locale}.json"
        current = json.loads(out_path.read_text(encoding="utf-8")) if out_path.exists() else {}
        next_tables = dict(current)
        locale_added: list[str] = []
        for table, filename in TITLE_TABLES.items():
            incoming = loc_titles(locale, filename)
            before = set((current.get(table) or {}).keys())
            next_tables[table] = alias_renamed_keys(
                table,
                merge_titles(current.get(table) or {}, incoming),
            )
            locale_added.extend(
                f"{table}:{key}" for key in sorted(set(incoming) - before)
            )
        if "ui" in current:
            next_tables["ui"] = current["ui"]
        write_compact(out_path, next_tables)
        if locale_added:
            added[locale] = locale_added

    ko_current = json.loads(KO_LEGACY.read_text(encoding="utf-8"))
    ko_next = {}
    for table, existing in ko_current.items():
        filename = TITLE_TABLES.get(table)
        ko_next[table] = (
            alias_renamed_keys(table, merge_titles(existing, loc_titles("kor", filename)))
            if filename
            else existing
        )
    KO_LEGACY.write_text(
        json.dumps(ko_next, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print("added")
    for locale, keys in added.items():
        print(f"  {locale} {len(keys)}: {', '.join(keys[:12])}" + ("…" if len(keys) > 12 else ""))


if __name__ == "__main__":
    main()
