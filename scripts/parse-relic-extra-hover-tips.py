#!/usr/bin/env python3
"""Parse RelicModel.ExtraHoverTips from decompiled STS2 sources into JSON.

Source of truth: /tmp/sts2-src MegaCrit.Sts2.Core.Models.Relics/*.cs
Does NOT scrape gold markup from descriptions — only explicit ExtraHoverTips.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

DEFAULT_SOURCE = Path("/tmp/sts2-src/MegaCrit.Sts2.Core.Models.Relics")
DEFAULT_POWERS = Path("/tmp/sts2-src/MegaCrit.Sts2.Core.Models.Powers")
DEFAULT_AFFLICTIONS = Path("/tmp/sts2-src/MegaCrit.Sts2.Core.Models.Afflictions")
DEFAULT_OUTPUT = Path("data/sts2/relic-extra-hover-tips.json")

STATIC_ENUM_TO_ID = {
    "Channeling": "CHANNELING",
    "Evoke": "EVOKE",
    "Transform": "TRANSFORM",
    "Block": "BLOCK",
    "Fatal": "FATAL",
    "Energy": "ENERGY",
    "Stun": "STUN",
    "CardReward": "CARD_REWARD",
    "Forge": "FORGE",
    "SummonDynamic": "SUMMON_DYNAMIC",
    "SummonStatic": "SUMMON_STATIC",
    "ReplayDynamic": "REPLAY_DYNAMIC",
    "ReplayStatic": "REPLAY_STATIC",
    "Cook": "COOK",
}


def pascal_to_id(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).upper()


def power_id(cls: str) -> str:
    base = cls[:-5] if cls.endswith("Power") else cls
    return pascal_to_id(base)


def extract_extra_body(text: str) -> str | None:
    m = re.search(
        r"ExtraHoverTips\s*=>\s*(.+?)(?:\n\s*\n|\n\s*(?:protected|public|private|override|\[)|\Z)",
        text,
        re.S,
    )
    if not m:
        return None
    return re.sub(r"\s+", " ", m.group(1)).strip().rstrip(";")


def parse_power_extra_tips(powers_dir: Path, cls: str) -> list[dict]:
    path = powers_dir / f"{cls}.cs"
    if not path.exists():
        # Try XxxPower.cs
        alt = powers_dir / f"{cls if cls.endswith('Power') else cls + 'Power'}.cs"
        path = alt if alt.exists() else path
    if not path.exists():
        return []
    body = extract_extra_body(path.read_text(errors="ignore"))
    if not body:
        return []
    return parse_tip_specs(body, powers_dir=None, afflictions_dir=None)


def parse_affliction_extra_tips(
    afflictions_dir: Path,
    cls: str,
    *,
    powers_dir: Path | None,
) -> list[dict]:
    path = afflictions_dir / f"{cls}.cs"
    if not path.exists():
        return []
    body = extract_extra_body(path.read_text(errors="ignore"))
    if not body:
        return []
    # Expand nested power tip extras; do not re-enter afflictions.
    return parse_tip_specs(body, powers_dir=powers_dir, afflictions_dir=None)


def parse_tip_specs(
    body: str,
    powers_dir: Path | None,
    afflictions_dir: Path | None = None,
) -> list[dict]:
    specs: list[dict] = []
    # Scan factory calls left-to-right to preserve ExtraHoverTips order.
    token_re = re.compile(
        r"FromForge\(\)"
        r"|ForEnergy\("
        r"|Static\(StaticHoverTip\.(\w+)(?:,\s*([^)]+))?\)"
        r"|FromKeyword\(CardKeyword\.(\w+)\)"
        r"|FromPowerWithPowerHoverTips<(\w+)>"
        r"|FromPower<(\w+)>"
        r"|FromCardWithCardHoverTips<(\w+)>"
        r"|FromCard<(\w+)>"
        r"|FromPotion<(\w+)>"
        r"|FromEnchantment<(\w+)>"
        r"|FromOrb<(\w+)>"
        r"|FromAffliction<(\w+)>"
    )

    for m in token_re.finditer(body):
        raw = m.group(0)
        if raw.startswith("FromForge"):
            specs.append({"kind": "forge"})
        elif raw.startswith("ForEnergy"):
            specs.append({"kind": "static", "id": "ENERGY"})
        elif raw.startswith("Static("):
            enum_name = m.group(1)
            tip_id = STATIC_ENUM_TO_ID.get(enum_name, pascal_to_id(enum_name))
            spec: dict = {"kind": "static", "id": tip_id}
            arg = (m.group(2) or "").strip()
            if "Summon" in arg:
                spec["var"] = "Summon"
            elif "Times" in arg or "Replay" in tip_id:
                spec["var"] = "Times"
            specs.append(spec)
        elif raw.startswith("FromKeyword"):
            specs.append({"kind": "keyword", "id": m.group(3).upper()})
        elif raw.startswith("FromPowerWithPowerHoverTips"):
            cls = m.group(4)
            specs.append({"kind": "power", "id": power_id(cls)})
            if powers_dir is not None:
                specs.extend(parse_power_extra_tips(powers_dir, cls))
        elif raw.startswith("FromPower"):
            specs.append({"kind": "power", "id": power_id(m.group(5))})
        elif raw.startswith("FromCardWithCardHoverTips"):
            specs.append({"kind": "card_with_tips", "id": pascal_to_id(m.group(6))})
        elif raw.startswith("FromCard"):
            specs.append({"kind": "card", "id": pascal_to_id(m.group(7))})
        elif raw.startswith("FromPotion"):
            specs.append({"kind": "potion", "id": pascal_to_id(m.group(8))})
        elif raw.startswith("FromEnchantment"):
            specs.append({"kind": "enchantment", "id": pascal_to_id(m.group(9))})
        elif raw.startswith("FromOrb"):
            specs.append({"kind": "orb", "id": pascal_to_id(m.group(10))})
        elif raw.startswith("FromAffliction"):
            # Mirror AfflictionModel.HoverTips = [self] + ExtraHoverTips.
            cls = m.group(11)
            specs.append({"kind": "affliction", "id": pascal_to_id(cls)})
            if afflictions_dir is not None:
                specs.extend(
                    parse_affliction_extra_tips(
                        afflictions_dir,
                        cls,
                        powers_dir=powers_dir,
                    )
                )

    seen: set[str] = set()
    out: list[dict] = []
    for spec in specs:
        key = f"{spec.get('kind')}:{spec.get('id')}:{spec.get('var', '')}"
        if key in seen:
            continue
        seen.add(key)
        out.append(spec)
    return out


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--powers", type=Path, default=DEFAULT_POWERS)
    parser.add_argument("--afflictions", type=Path, default=DEFAULT_AFFLICTIONS)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    result: dict[str, list[dict]] = {}
    skipped_dynamic = []

    for path in sorted(args.source.glob("*.cs")):
        text = path.read_text(errors="ignore")
        body = extract_extra_body(text)
        if not body:
            continue
        if "_extraHoverTips" in body or body.startswith("list"):
            # Runtime-built tips (ArchaicTooth etc.) — empty at Compendium rest state.
            skipped_dynamic.append(path.stem)
            continue
        relic_id = pascal_to_id(path.stem)
        specs = parse_tip_specs(
            body,
            powers_dir=args.powers,
            afflictions_dir=args.afflictions,
        )
        if specs:
            result[relic_id] = specs

    payload = {
        "source": "MegaCrit.Sts2.Core.Models.Relics ExtraHoverTips",
        "tipsByRelicId": dict(sorted(result.items())),
        "skippedDynamicRelicClasses": skipped_dynamic,
    }

    if args.dry_run:
        print(json.dumps(payload, ensure_ascii=False, indent=2)[:2000])
        print(f"... {len(result)} relics, {len(skipped_dynamic)} dynamic skipped")
        return

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {args.output} ({len(result)} relics)")


if __name__ == "__main__":
    main()
