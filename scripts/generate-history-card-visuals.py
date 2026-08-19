#!/usr/bin/env python3
"""Compact History Course tiny-card catalog from extracted STS2 card JSON."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "sts2" / "kor" / "cards.json"
DEST = ROOT / "src" / "lib" / "history-card-visuals.json"

# Mirror src/lib/codex-data.ts CARD_VISUAL_COLOR_OVERRIDES.
VISUAL_COLOR_OVERRIDES = {
    "CALTROPS": "silent",
    "CLASH": "ironclad",
    "DISTRACTION": "silent",
    "DUAL_WIELD": "ironclad",
    "ENTRENCH": "ironclad",
    "HELLO_WORLD": "defect",
    "OUTMANEUVER": "silent",
    "REBOUND": "defect",
    "RIP_AND_TEAR": "defect",
    "STACK": "defect",
}


def main() -> None:
    cards = json.loads(SOURCE.read_text())
    out = []
    for card in cards:
        rec = {
            "id": card["id"],
            "color": card.get("color") or "colorless",
            "rarity": card.get("rarity") or "일반",
            "type": card.get("type") or "스킬",
        }
        visual = VISUAL_COLOR_OVERRIDES.get(card["id"])
        if visual:
            rec["visualColor"] = visual
        out.append(rec)
    DEST.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"wrote {len(out)} visuals -> {DEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
