"""STS1 monster rows: id, dungeon, enemy type, hit points, and art source."""

from __future__ import annotations

import re
from typing import Any

from scripts.lib.java_classfile import JavaClass, iter_opcodes, parse_class_file, s1_from, s2_from, u2_from

MONSTER_PACKAGE = "com/megacrit/cardcrawl/monsters/"
ABSTRACT_MONSTER = "com.megacrit.cardcrawl.monsters.AbstractMonster"
ENEMY_TYPE_ENUM = "com.megacrit.cardcrawl.monsters.AbstractMonster$EnemyType"
ASCENSION_FIELD = "ascensionLevel"
# Package order is the game's dungeon order.
DUNGEONS = ("exordium", "city", "beyond", "ending")
# The fallback the game spawns when an encounter fails to load; no run meets it.
EXCLUDED_IDS = {"Apology Slime"}


def _slugify(value: str) -> str:
    spaced = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "-", value)
    return re.sub(r"[^a-z0-9]+", "-", spaced.lower()).strip("-")


def _monster_class_paths(names: list[str]) -> list[str]:
    return sorted(
        name
        for name in names
        if name.startswith(MONSTER_PACKAGE)
        and name.endswith(".class")
        and "$" not in name
        and name[len(MONSTER_PACKAGE):].split("/")[0] in DUNGEONS
    )


def _const_field(cls: JavaClass, name: str) -> Any:
    return next((field.const_value for field in cls.fields if field.name == name), None)


def _read_hit_points(cls: JavaClass) -> list[dict[str, int]]:
    """Replays the constructors for `setHp` and `super(..., maxHealth, ...)`.

    The game branches on `ascensionLevel >= N`, the raised values first:
    a `setHp` after a threshold belongs to it, the next one is the base value.
    """
    tiers: dict[int, tuple[int, int]] = {}
    declared: tuple[int, int] | None = None
    for method in cls.methods:
        if method.name != "<init>" or not method.code:
            continue
        values: list[Any] = []
        threshold: int | None = None
        awaiting_threshold = False

        def push(value: int) -> None:
            nonlocal threshold, awaiting_threshold
            if awaiting_threshold:
                threshold = value
                awaiting_threshold = False
            else:
                values.append(value)

        for _start, op, arg in iter_opcodes(method.code):
            if 2 <= op <= 8:
                push(op - 3)
            elif op == 16:
                push(s1_from(arg))
            elif op == 17:
                push(s2_from(arg))
            elif op in {18, 19, 20}:
                value = cls.ldc_value(arg[0] if op == 18 else u2_from(arg))
                if isinstance(value, int) and not isinstance(value, bool):
                    push(value)
            elif op == 178:
                _owner, name, _desc = cls.fieldref(u2_from(arg))
                if name == ASCENSION_FIELD:
                    awaiting_threshold = True
            elif op in {182, 183}:
                owner, name, desc = cls.methodref(u2_from(arg))
                if name == "random" and desc.startswith("(II)") and len(values) >= 2:
                    high, low = values.pop(), values.pop()
                    values.append((low, high))
                elif name == "setHp" and desc == "(II)V" and len(values) >= 2:
                    high, low = values[-1], values[-2]
                    tiers.setdefault(threshold or 0, (low, high))
                    threshold = None
                    values.clear()
                elif name == "setHp" and desc == "(I)V" and values:
                    tiers.setdefault(threshold or 0, (values[-1], values[-1]))
                    threshold = None
                    values.clear()
                elif name == "<init>" and owner == ABSTRACT_MONSTER:
                    if values:
                        last = values[-1]
                        declared = declared or (last if isinstance(last, tuple) else (last, last))
                    values.clear()
                elif name == "<init>":
                    values.clear()
    if declared:
        tiers.setdefault(0, declared)
    rows: list[dict[str, int]] = []
    for ascension, (low, high) in sorted(tiers.items()):
        if not rows or (rows[-1]["min"], rows[-1]["max"]) != (low, high):
            rows.append({"ascension": ascension, "min": low, "max": high})
    return rows


def _enemy_type(cls: JavaClass) -> str:
    for method in cls.methods:
        if method.name != "<init>" or not method.code:
            continue
        for _start, op, arg in iter_opcodes(method.code):
            if op == 178:
                owner, name, _desc = cls.fieldref(u2_from(arg))
                if owner == ENEMY_TYPE_ENUM:
                    return name.lower()
    return "normal"


def _art_source(cls: JavaClass) -> dict[str, str] | None:
    """The skeleton and first animation, or the still image `super(...)` takes."""
    atlas = skeleton = animation = image = None
    # SnakeDagger loads its skeleton outside the constructor.
    for method in sorted(cls.methods, key=lambda row: row.name != "<init>"):
        if not method.code or (method.name != "<init>" and atlas):
            continue
        strings: list[str] = []
        for _start, op, arg in iter_opcodes(method.code):
            if op in {18, 19, 20}:
                value = cls.ldc_value(arg[0] if op == 18 else u2_from(arg))
                if isinstance(value, str):
                    strings.append(value)
            elif op in {182, 183}:
                owner, name, _desc = cls.methodref(u2_from(arg))
                if name == "loadAnimation" and len(strings) >= 2 and atlas is None:
                    atlas, skeleton = strings[-2], strings[-1]
                elif name == "setAnimation" and strings and animation is None:
                    animation = strings[-1]
                elif name == "<init>" and owner == ABSTRACT_MONSTER and strings:
                    if strings[-1].startswith("images/"):
                        image = strings[-1]
                    strings = []
    if atlas and skeleton:
        return {"atlas": atlas, "skeleton": skeleton, "animation": animation or ""}
    return {"image": image} if image else None


def parse_monster(jar: Any, class_path: str) -> dict[str, Any] | None:
    cls = parse_class_file(jar.read(class_path))
    monster_id = _const_field(cls, "ID")
    if cls.super_name != ABSTRACT_MONSTER or not isinstance(monster_id, str) or monster_id in EXCLUDED_IDS:
        return None
    return {
        "id": monster_id,
        "slug": _slugify(monster_id),
        "legacySlugs": [],
        "className": cls.name.rsplit(".", 1)[-1],
        "dungeon": class_path[len(MONSTER_PACKAGE):].split("/")[0],
        "type": _enemy_type(cls),
        "hitPoints": _read_hit_points(cls),
        "art": _art_source(cls),
    }


def load_monsters(jar: Any) -> list[dict[str, Any]]:
    rows = [parse_monster(jar, path) for path in _monster_class_paths(jar.namelist())]
    return sorted(
        (row for row in rows if row),
        key=lambda row: (DUNGEONS.index(row["dungeon"]), row["slug"]),
    )


def monster_art_sources(rows: list[dict[str, Any]]) -> dict[str, dict[str, str]]:
    return {row["slug"]: row["art"] for row in rows}


def public_monster_row(row: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in row.items() if key not in {"art", "className"}}


def localize_monster(entry: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    moves = entry.get("MOVES") or fallback.get("MOVES") or []
    return {
        "name": entry.get("NAME") or fallback.get("NAME") or "",
        "moves": [move for move in dict.fromkeys(moves) if move],
    }
