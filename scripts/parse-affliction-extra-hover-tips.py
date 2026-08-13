#!/usr/bin/env python3
"""Parse AfflictionModel.ExtraHoverTips from decompiled STS2 sources into JSON.

Source of truth: /tmp/sts2-src MegaCrit.Sts2.Core.Models.Afflictions/*.cs
Does NOT scrape gold markup from descriptions — only explicit ExtraHoverTips.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

DEFAULT_SOURCE = Path("/tmp/sts2-src/MegaCrit.Sts2.Core.Models.Afflictions")
DEFAULT_POWERS = Path("/tmp/sts2-src/MegaCrit.Sts2.Core.Models.Powers")
DEFAULT_OUTPUT = Path("data/sts2/affliction-extra-hover-tips.json")

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
        affliction_id = _relic.pascal_to_id(path.stem)
        # Nested affliction expansion is unnecessary for affliction ExtraHoverTips.
        specs = _relic.parse_tip_specs(
            body,
            powers_dir=args.powers,
            afflictions_dir=None,
        )
        if specs:
            result[affliction_id] = specs

    payload = {
        "source": "MegaCrit.Sts2.Core.Models.Afflictions ExtraHoverTips",
        "tipsByAfflictionId": dict(sorted(result.items())),
        "skippedDynamicAfflictionClasses": skipped_dynamic,
    }

    if args.dry_run:
        print(json.dumps(payload, ensure_ascii=False, indent=2)[:2500])
        print(f"... {len(result)} afflictions, {len(skipped_dynamic)} dynamic skipped")
        return

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {args.output} ({len(result)} afflictions)")


if __name__ == "__main__":
    main()
