#!/usr/bin/env python3
"""Extract STS2 card MultiplayerConstraint overrides from decompiled DLL source.

Game source:
  - MegaCrit.Sts2.Core.Models.Cards/*.cs
  - MegaCrit.Sts2.Core.Entities.Cards.CardMultiplayerConstraint
    (None | MultiplayerOnly | SingleplayerOnly)
  - CardModel.MultiplayerConstraint defaults to None

The in-game card library tickbox VIEW_MULTIPLAYER_CARDS hides MultiplayerOnly
cards when unticked. This catalog is that same flag.

When the local decompile is older than data/sts2/{eng,kor}/cards.json (the
installed Steam build may lag Codex), cards that exist in JSON but have no
matching *.cs file are filled from Steam patch notes that explicitly added
them as multiplayer cards. C# wins for any card that is present in the
decompile.

Outputs:
  - data/sts2/card-multiplayer-constraints.json

Prerequisites:
  Decompiled DLL source at /tmp/sts2-src (default) or --source PATH
  Produce with: ilspycmd -p -o /tmp/sts2-src "<path to sts2.dll>"

Usage:
    python3 scripts/extract-card-multiplayer-constraints.py [--dry-run] [--source PATH]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "data/sts2/card-multiplayer-constraints.json"
CARDS_JSON = ROOT / "data/sts2/eng/cards.json"
DEFAULT_SOURCE = Path("/tmp/sts2-src/MegaCrit.Sts2.Core.Models.Cards")

CONSTRAINT_RE = {
    "MultiplayerOnly": "MultiplayerConstraint => CardMultiplayerConstraint.MultiplayerOnly",
    "SingleplayerOnly": "MultiplayerConstraint => CardMultiplayerConstraint.SingleplayerOnly",
}

# Steam patch-note IDs used only when the matching CardModel *.cs is missing
# from this decompile (local Steam currently trails Codex 0.111.0).
# v0.108.0: "Added new multiplayer {character/colorless} cards"
# v0.109.0: "Added new Regent card, Tutor" ("Another player chooses…");
#           v0.110.0 lists Tutor under Multiplayer UI fixes.
PATCH_NOTE_MULTIPLAYER_ONLY_IDS = (
    "MIDNIGHT",
    "BLAZE",
    "OUTRAGE",
    "BLADE_SYMPHONY",
    "CONCOCT",
    "FADE",
    "PLOT",
    "CONSTELLATION",
    "UNDERWORLD",
    "SOULBOUND",
    "CACOPHONY",
    "HIBERNATE",
    "ONE_FOR_ALL",
    "IMITATION_LEARNING",
    "THE_BALL",
    "TUTOR",
)


def slugify(name: str) -> str:
    """PascalCase -> SCREAMING_SNAKE_CASE, mirroring StringHelper.Slugify."""
    out: list[str] = []
    for i, c in enumerate(name):
        if i > 0 and c.isupper():
            out.append("_")
        out.append(c.upper())
    return "".join(out)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default=str(DEFAULT_SOURCE), help="Decompiled Cards model source dir")
    parser.add_argument("--dry-run", action="store_true", help="Print planned writes without writing files")
    return parser.parse_args()


def collect_ids(src_dir: Path, needle: str) -> list[str]:
    ids: list[str] = []
    for path in sorted(src_dir.glob("*.cs")):
        text = path.read_text(encoding="utf-8")
        if needle in text:
            ids.append(slugify(path.stem))
    return ids


def main() -> int:
    args = parse_args()
    src_dir = Path(args.source)
    if not src_dir.is_dir():
        print(f"missing decompiled cards dir: {src_dir}", flush=True)
        print("Run: ilspycmd -p -o /tmp/sts2-src <sts2.dll path>", flush=True)
        return 1

    known_ids = {card["id"] for card in json.loads(CARDS_JSON.read_text(encoding="utf-8"))}
    decompiled_ids = {slugify(path.stem) for path in src_dir.glob("*.cs")}
    multiplayer_only = collect_ids(src_dir, CONSTRAINT_RE["MultiplayerOnly"])
    singleplayer_only = collect_ids(src_dir, CONSTRAINT_RE["SingleplayerOnly"])

    missing_from_json = [
        card_id for card_id in [*multiplayer_only, *singleplayer_only] if card_id not in known_ids
    ]
    if missing_from_json:
        print(f"slugified ids missing from cards.json: {missing_from_json}", flush=True)
        return 1

    unknown_patch_note_ids = [card_id for card_id in PATCH_NOTE_MULTIPLAYER_ONLY_IDS if card_id not in known_ids]
    if unknown_patch_note_ids:
        print(f"patch-note multiplayer ids missing from cards.json: {unknown_patch_note_ids}", flush=True)
        return 1

    supplement = [
        card_id
        for card_id in PATCH_NOTE_MULTIPLAYER_ONLY_IDS
        if card_id not in decompiled_ids
    ]
    if supplement:
        print(
            f"decompile missing {len(supplement)} Codex cards; filling MultiplayerOnly from patch notes: {supplement}",
            flush=True,
        )
        multiplayer_only = sorted(set(multiplayer_only) | set(supplement))
    else:
        multiplayer_only = sorted(multiplayer_only)
    singleplayer_only = sorted(singleplayer_only)

    payload = {
        "multiplayerOnlyIds": multiplayer_only,
        "singleplayerOnlyIds": singleplayer_only,
    }
    if args.dry_run:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        print(f"would write {OUT_PATH} ({len(multiplayer_only)} multiplayer-only, {len(singleplayer_only)} singleplayer-only)")
        return 0

    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT_PATH} ({len(multiplayer_only)} multiplayer-only, {len(singleplayer_only)} singleplayer-only)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
