#!/usr/bin/env python3
"""Parse PotionModel.ExtraHoverTips from decompiled STS2 sources into JSON.

Source of truth: /tmp/sts2-src MegaCrit.Sts2.Core.Models.Potions/*.cs
Does NOT scrape gold markup from descriptions — only explicit ExtraHoverTips.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

DEFAULT_SOURCE = Path("/tmp/sts2-src/MegaCrit.Sts2.Core.Models.Potions")
DEFAULT_POWERS = Path("/tmp/sts2-src/MegaCrit.Sts2.Core.Models.Powers")
DEFAULT_OUTPUT = Path("data/sts2/potion-extra-hover-tips.json")

# Reuse shared ExtraHoverTips token parser from the relic script.
_relic_path = Path(__file__).resolve().parent / "parse-relic-extra-hover-tips.py"
_spec = importlib.util.spec_from_file_location("parse_relic_extra_hover_tips", _relic_path)
assert _spec and _spec.loader
_relic = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_relic)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--powers", type=Path, default=DEFAULT_POWERS)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def parse_tip_specs_with_card_upgrade(body: str, powers_dir: Path | None) -> list[dict]:
    """Same as relic parser, plus FromCard<T>(upgrade: true) → upgrade flag."""
    specs = _relic.parse_tip_specs(body, powers_dir=powers_dir)
    # Annotate card tips that request an upgraded preview.
    import re

    upgraded_cards = set()
    for m in re.finditer(r"FromCard(?:WithCardHoverTips)?<(\w+)>\(([^)]*)\)", body):
        args = m.group(2)
        if re.search(r"upgrade\s*:\s*true", args):
            upgraded_cards.add(_relic.pascal_to_id(m.group(1)))

    if not upgraded_cards:
        return specs

    out: list[dict] = []
    for spec in specs:
        if spec.get("kind") in ("card", "card_with_tips") and spec.get("id") in upgraded_cards:
            out.append({**spec, "upgrade": True})
        else:
            out.append(spec)
    return out


def main() -> None:
    args = parse_args()
    result: dict[str, list[dict]] = {}
    skipped_dynamic = []

    for path in sorted(args.source.glob("*.cs")):
        text = path.read_text(errors="ignore")
        body = _relic.extract_extra_body(text)
        if not body:
            continue
        if "_extraHoverTips" in body or body.startswith("list"):
            skipped_dynamic.append(path.stem)
            continue
        potion_id = _relic.pascal_to_id(path.stem)
        specs = parse_tip_specs_with_card_upgrade(body, powers_dir=args.powers)
        if specs:
            result[potion_id] = specs

    payload = {
        "source": "MegaCrit.Sts2.Core.Models.Potions ExtraHoverTips",
        "tipsByPotionId": dict(sorted(result.items())),
        "skippedDynamicPotionClasses": skipped_dynamic,
    }

    if args.dry_run:
        print(json.dumps(payload, ensure_ascii=False, indent=2)[:2000])
        print(f"... {len(result)} potions, {len(skipped_dynamic)} dynamic skipped")
        return

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {args.output} ({len(result)} potions)")


if __name__ == "__main__":
    main()
