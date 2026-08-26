#!/usr/bin/env python3
"""Extract STS2 card MultiplayerConstraint overrides from decompiled DLL source.

Game source:
  - MegaCrit.Sts2.Core.Models.Cards/*.cs
  - MegaCrit.Sts2.Core.Entities.Cards.CardMultiplayerConstraint
    (None | MultiplayerOnly | SingleplayerOnly)
  - CardModel.MultiplayerConstraint defaults to None

The in-game card library tickbox VIEW_MULTIPLAYER_CARDS hides MultiplayerOnly
cards when unticked. This catalog is that same flag.

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
    multiplayer_only = collect_ids(src_dir, CONSTRAINT_RE["MultiplayerOnly"])
    singleplayer_only = collect_ids(src_dir, CONSTRAINT_RE["SingleplayerOnly"])

    missing = [card_id for card_id in [*multiplayer_only, *singleplayer_only] if card_id not in known_ids]
    if missing:
        print(f"slugified ids missing from cards.json: {missing}", flush=True)
        return 1

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
