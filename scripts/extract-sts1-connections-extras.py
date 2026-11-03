#!/usr/bin/env python3
"""Extract the STS1 things Connections puzzles name that the STS1 Compendium does not carry.

The Compendium covers STS1 cards, relics, potions, powers, and monsters. Old Connections
puzzles also name events, blights, the Circlet relic, and a deprecated card. This pulls
just those from the local desktop-1.0.jar: names and first descriptions in every STS1
locale, and their art.

Outputs:
  - data/sts1/connections-extras.json
  - public/images/sts1/connections/{id}.webp

Usage: PYTHONPATH=. python3 scripts/extract-sts1-connections-extras.py [--jar path]
"""

from __future__ import annotations

import argparse
import json
import re
from io import BytesIO
from pathlib import Path

from PIL import Image

from scripts.lib.sts1_jar import open_sts1_jar

STS1_LOCALES = ["kor", "eng", "zhs", "jpn", "deu", "fra", "ita", "spa", "ptb", "rus", "pol", "tha", "tur"]
OUTPUT = Path("data/sts1/connections-extras.json")
IMAGE_ROOT = Path("public/images/sts1/connections")

# (type, site id, localization file, localization key, art in the jar)
EXTRAS = [
    ("event", "forgotten-altar", "events", "Forgotten Altar", "images/events/forgottenAltar.jpg"),
    ("event", "the-mausoleum", "events", "The Mausoleum", "images/events/mausoleum.jpg"),
    ("event", "tomb-of-lord-red-mask", "events", "Tomb of Lord Red Mask", "images/events/redMaskTomb.jpg"),
    ("event", "golden-shrine", "events", "Golden Shrine", "images/events/goldShrine.jpg"),
    ("event", "bonfire-spirits", "events", "Bonfire Elementals", "images/events/bonfire.jpg"),
    ("event", "falling", "events", "Falling", "images/events/falling.jpg"),
    ("event", "the-cleric", "events", "The Cleric", "images/events/cleric.jpg"),
    ("event", "the-divine-fountain", "events", "Fountain of Cleansing", "images/events/fountain.jpg"),
    ("blight", "muzzle", "blights", "FullBelly", "images/blights/muzzle.png"),
    ("blight", "post-durian", "blights", "BlightedDurian", "images/blights/durian.png"),
    ("relic", "circlet", "relics", "Circlet", "images/relics/circlet.png"),
    # Removed from the game before release; only its localization remains.
    ("card", "flux-capacitor", "cards", "Flux Capacitor", None),
]
# Numbers the game fills between description fragments (BlightedDurian.updateDescription: 50%).
FRAGMENT_VALUES = {"BlightedDurian": ["50"]}


def plain(text: str) -> str:
    """Drop STS1 text markup: color codes (#y), wave/shake marks (~ @), and NL line breaks."""
    text = re.sub(r"\s*NL\s*", "\n", text)
    text = re.sub(r"#[a-z]", "", text)
    text = text.replace("~", "").replace("@", "")
    return re.sub(r"[ \t]+", " ", text).strip()


def first_description(entry: dict, key: str) -> str:
    values = FRAGMENT_VALUES.get(key)
    for field in ("DESCRIPTIONS", "DESCRIPTION"):
        value = entry.get(field)
        if isinstance(value, list) and value and values:
            return plain("".join(part + (values[index] if index < len(values) else "") for index, part in enumerate(value)))
        if isinstance(value, list) and value:
            return plain(value[0])
        if isinstance(value, str):
            return plain(value)
    return ""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--jar")
    args = parser.parse_args()

    jar = open_sts1_jar(args.jar)
    tables: dict[tuple[str, str], dict] = {}
    for locale in STS1_LOCALES:
        for table in {extra[2] for extra in EXTRAS}:
            tables[(locale, table)] = json.loads(jar.read(f"localization/{locale}/{table}.json").decode("utf-8"))

    entries = []
    IMAGE_ROOT.mkdir(parents=True, exist_ok=True)
    for kind, site_id, table, key, art in EXTRAS:
        names = {}
        descriptions = {}
        for locale in STS1_LOCALES:
            entry = tables[(locale, table)].get(key)
            if entry is None:
                continue
            names[locale] = entry.get("NAME", "").strip()
            descriptions[locale] = first_description(entry, key)
        if "eng" not in names:
            raise SystemExit(f"No English entry for {table}/{key}")
        image = None
        if art:
            source = Image.open(BytesIO(jar.read(art))).convert("RGBA")
            dest = IMAGE_ROOT / f"{site_id}.webp"
            source.save(dest, "WEBP", quality=82, method=6)
            image = f"/images/sts1/connections/{site_id}.webp"
            print(f"{dest} {source.size}")
        entries.append({
            "type": kind,
            "id": site_id,
            "image": image,
            "names": names,
            "descriptions": descriptions,
        })

    OUTPUT.write_text(json.dumps({"entries": entries}, ensure_ascii=False, indent=2) + "\n")
    print(f"{OUTPUT}: {len(entries)} entries")


if __name__ == "__main__":
    main()
