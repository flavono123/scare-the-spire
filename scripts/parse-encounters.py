#!/usr/bin/env python3
"""Parse encounters from the local STS2 PCK + decompiled DLL source.

Writes data/sts2/{eng,kor}/encounters.json, preserving the existing schema.

Data sources:
- RoomType / IsWeak / Tags / monster composition → decompiled encounter .cs files.
- Act assignment → Acts/*.cs GenerateAllEncounters() + BossDiscoveryOrder lists.
- Encounter name / loss text → PCK localization tables.
- Monster names → PCK localization monsters table.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib.pck import PCKReader, default_pck_path, group_loc_by_id  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data/sts2"
DEFAULT_SOURCE = Path("/tmp/sts2-src")
SKIP_PREFIXES = ("DEPRECATED_", "GENERIC",)

ACT_LABELS = {
    "Overgrowth": "Act 1 - Overgrowth",
    "Hive": "Act 2 - Hive",
    "Glory": "Act 3 - Glory",
    "Underdocks": "Underdocks",
}

_ROOMTYPE_RE = re.compile(r"public\s+override\s+RoomType\s+RoomType\s*=>\s*RoomType\.(?P<rt>\w+)\s*;")
_ISWEAK_RE = re.compile(r"public\s+override\s+bool\s+IsWeak\s*=>\s*true\s*;")
_MONSTER_REF_RE = re.compile(r"ModelDb\.Monster<(?P<cls>\w+)>\(\)")
_ENCOUNTER_REF_RE = re.compile(r"ModelDb\.Encounter<(?P<cls>\w+)>\(\)")
_TAG_RE = re.compile(r"EncounterTag\.(?P<tag>\w+)")


def pascal_case(snake: str) -> str:
    return "".join(w.capitalize() for w in snake.split("_"))


def snake_case_upper(pascal: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", pascal).upper()


def find_encounter_class(source_root: Path, ent_id: str) -> Path | None:
    cls = pascal_case(ent_id)
    p = source_root / "MegaCrit.Sts2.Core.Models.Encounters" / f"{cls}.cs"
    return p if p.is_file() else None


def build_act_index(source_root: Path) -> dict[str, str]:
    """Return {ENCOUNTER_ID (SCREAMING_SNAKE) → pretty act label}."""
    index: dict[str, str] = {}
    acts_dir = source_root / "MegaCrit.Sts2.Core.Models.Acts"
    if not acts_dir.is_dir():
        return index
    for cs in acts_dir.glob("*.cs"):
        label = ACT_LABELS.get(cs.stem)
        if not label:
            continue
        text = cs.read_text()
        for m in _ENCOUNTER_REF_RE.finditer(text):
            enc_id = snake_case_upper(m.group("cls"))
            index.setdefault(enc_id, label)
    return index


def parse_encounter_meta(text: str) -> dict:
    rt = _ROOMTYPE_RE.search(text)
    out = {
        "room_type": rt.group("rt") if rt else "Monster",
        "is_weak": bool(_ISWEAK_RE.search(text)),
        "monster_classes": [],
        "tags": [],
    }
    # Scan the whole file for monster references so that indirected helpers
    # (e.g., `private static MonsterModel[] Bugs => [...]; ... Bugs.Concat(...)`)
    # still contribute to the composition list.
    seen: list[str] = []
    for m in _MONSTER_REF_RE.finditer(text):
        cls = m.group("cls")
        if cls not in seen:
            seen.append(cls)
    out["monster_classes"] = seen
    # Tags can appear on one line or in a multi-line array; grep all EncounterTag.X in Tags property block.
    tags_idx = text.find("Tags =>")
    if tags_idx >= 0:
        snippet = text[tags_idx : tags_idx + 500]
        tags = []
        for m in _TAG_RE.finditer(snippet):
            tag = m.group("tag")
            if tag not in tags:
                tags.append(tag)
        out["tags"] = tags
    return out


def build_entries(
    loc_kor_by_id: dict,
    loc_eng_by_id: dict,
    monster_name_by_id_kor: dict[str, str],
    monster_name_by_id_eng: dict[str, str],
    existing_kor: list,
    existing_eng: list,
    source_root: Path,
) -> tuple[list, list, list, list]:
    ids = sorted(set(loc_kor_by_id) | set(loc_eng_by_id))
    ids = [i for i in ids if not i.startswith(SKIP_PREFIXES) and i != "NEOW" and i != "NEOW_CHOICE"]

    old_kor_by_id = {e["id"]: e for e in existing_kor}
    old_eng_by_id = {e["id"]: e for e in existing_eng}
    act_index = build_act_index(source_root)

    kor_out, eng_out = [], []
    added, removed = [], []

    for ent_id in ids:
        cs = find_encounter_class(source_root, ent_id)
        if cs is not None:
            meta = parse_encounter_meta(cs.read_text())
        else:
            meta = {"room_type": "Monster", "is_weak": False, "monster_classes": [], "tags": []}

        act_label = act_index.get(ent_id)

        for lang, loc_by_id, mon_name_by_id, old_by_id, out in (
            ("kor", loc_kor_by_id, monster_name_by_id_kor, old_kor_by_id, kor_out),
            ("eng", loc_eng_by_id, monster_name_by_id_eng, old_eng_by_id, eng_out),
        ):
            lnode = loc_by_id.get(ent_id, {})
            old = old_by_id.get(ent_id, {})
            monsters = []
            for cls in meta["monster_classes"]:
                mid = snake_case_upper(cls)
                monsters.append({"id": mid, "name": mon_name_by_id.get(mid) or mid})
            out.append({
                "id": ent_id,
                "name": lnode.get("title") or old.get("name"),
                "room_type": meta["room_type"],
                "is_weak": meta["is_weak"],
                "act": act_label if act_label is not None else old.get("act"),
                "tags": meta["tags"] or None,
                "monsters": monsters if monsters else old.get("monsters", []),
                "loss_text": lnode.get("loss") or old.get("loss_text"),
            })

        if ent_id not in old_kor_by_id:
            added.append(ent_id)

    pck_ids = set(ids)
    for old_id in old_kor_by_id:
        if old_id not in pck_ids:
            removed.append(old_id)

    return kor_out, eng_out, added, removed


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def load_monster_names(reader: PCKReader, lang: str) -> dict[str, str]:
    flat = reader.read_json(f"localization/{lang}/monsters.json")
    return {k[: -len(".name")]: v for k, v in flat.items() if k.endswith(".name")}


def main() -> int:
    ap = argparse.ArgumentParser(description="Parse encounters from PCK + DLL source.")
    ap.add_argument("--pck", default=default_pck_path())
    ap.add_argument("--source", default=str(DEFAULT_SOURCE))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    source = Path(args.source)
    if not source.exists():
        print(f"ERROR: decompiled source not found at {source}", file=sys.stderr)
        return 1

    reader = PCKReader(args.pck)
    try:
        loc_kor = group_loc_by_id(reader.read_json("localization/kor/encounters.json"))
        loc_eng = group_loc_by_id(reader.read_json("localization/eng/encounters.json"))
        monster_names_kor = load_monster_names(reader, "kor")
        monster_names_eng = load_monster_names(reader, "eng")
    finally:
        reader.close()

    existing_kor = json.loads((DATA_DIR / "kor/encounters.json").read_text() or "[]")
    existing_eng = json.loads((DATA_DIR / "eng/encounters.json").read_text() or "[]")

    kor_out, eng_out, added, removed = build_entries(
        loc_kor, loc_eng, monster_names_kor, monster_names_eng,
        existing_kor, existing_eng, source,
    )

    print(f"Encounters: {len(kor_out)} entries")
    if added:
        print(f"  + Added ({len(added)}): {', '.join(added)}")
    if removed:
        print(f"  - Removed ({len(removed)}): {', '.join(removed)}")

    if args.dry_run:
        print("(dry-run: no files written)")
        return 0

    write_json(DATA_DIR / "kor/encounters.json", kor_out)
    write_json(DATA_DIR / "eng/encounters.json", eng_out)
    print(f"Wrote {DATA_DIR / 'kor/encounters.json'}")
    print(f"Wrote {DATA_DIR / 'eng/encounters.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
