"""STS1 power rows: id, icon region, type, stacking, and source references."""

from __future__ import annotations

import re
from typing import Any

from scripts.lib.java_classfile import JavaClass, iter_opcodes, parse_class_file, s1_from, u2_from
from scripts.lib.sts1_description_template import (
    pick_template,
    render_template,
    replay_description_templates,
)

POWER_PACKAGE = "com/megacrit/cardcrawl/powers/"
POWER_TYPE_ENUM = "com.megacrit.cardcrawl.powers.AbstractPower$PowerType"


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def _power_class_paths(names: list[str]) -> list[str]:
    return sorted(
        name
        for name in names
        if name.startswith(POWER_PACKAGE)
        and name.endswith(".class")
        and "$" not in name
        and "/deprecated/" not in name
        and not name.endswith("/AbstractPower.class")
    )


def _const_field(cls: JavaClass, name: str) -> Any:
    return next((field.const_value for field in cls.fields if field.name == name), None)


def _loc_key(cls: JavaClass) -> str | None:
    clinit = cls.method("<clinit>")
    if not clinit or not clinit.code:
        return None
    last: Any = None
    for _start, op, arg in iter_opcodes(clinit.code):
        if op == 18:
            last = cls.ldc_value(arg[0])
        elif op in {19, 20}:
            last = cls.ldc_value(u2_from(arg))
        elif op == 182:
            _owner, name, _desc = cls.methodref(u2_from(arg))
            if name == "getPowerStrings" and isinstance(last, str):
                return last
    return None


def _first_string_arg(cls: JavaClass, method_name: str) -> str | None:
    for method in cls.methods:
        if not method.code:
            continue
        last: Any = None
        for _start, op, arg in iter_opcodes(method.code):
            if op == 18:
                last = cls.ldc_value(arg[0])
            elif op in {19, 20}:
                last = cls.ldc_value(u2_from(arg))
            elif op == 182:
                _owner, name, _desc = cls.methodref(u2_from(arg))
                if name == method_name and isinstance(last, str):
                    return last
    return None


def _power_types(cls: JavaClass, method_name: str) -> list[str]:
    method = cls.method(method_name)
    if not method or not method.code:
        return []
    found: list[str] = []
    for _start, op, arg in iter_opcodes(method.code):
        if op == 178:
            owner, name, _desc = cls.fieldref(u2_from(arg))
            if owner == POWER_TYPE_ENUM:
                found.append(name)
    return found


def _sets_field_constant(cls: JavaClass, field: str, value: int | bool) -> bool:
    """True when <init> assigns `this.<field> = <value>` with an int/boolean constant."""
    for method in cls.methods:
        if method.name != "<init>" or not method.code:
            continue
        last: int | None = None
        for _start, op, arg in iter_opcodes(method.code):
            if 2 <= op <= 8:
                last = op - 3
            elif op == 16:
                last = s1_from(arg)
            elif op == 181:
                _owner, name, _desc = cls.fieldref(u2_from(arg))
                if name == field and last == int(value):
                    return True
                last = None
            elif op not in {42, 89}:
                last = None
    return False


def parse_power(jar, class_path: str) -> dict[str, Any] | None:
    cls = parse_class_file(jar.read(class_path))
    power_id = _const_field(cls, "POWER_ID")
    if not isinstance(power_id, str):
        return None
    templates = replay_description_templates(cls, "updateDescription", sink="field", descriptor="()V")
    if not templates:
        templates = replay_description_templates(cls, "<init>", sink="field")
    template = pick_template(templates)
    types = _power_types(cls, "<init>") or _power_types(cls, "updateDescription")
    region = _first_string_arg(cls, "loadRegion")
    return {
        "id": power_id,
        "slug": _slugify(power_id),
        "className": class_path.removesuffix(".class").replace("/", "."),
        "locKey": _loc_key(cls) or power_id,
        "type": (types[0] if types else "BUFF").lower(),
        "stackType": "single" if _sets_field_constant(cls, "amount", -1) else "counter",
        "canGoNegative": _sets_field_constant(cls, "canGoNegative", True),
        "isTurnBased": _sets_field_constant(cls, "isTurnBased", True),
        "image": region,
        "_template": template or [],
    }


def _instantiated_power_classes(jar, class_name: str, names: set[str]) -> set[str]:
    base = class_name.replace(".", "/")
    paths = [f"{base}.class"] + sorted(
        name for name in names if name.startswith(f"{base}$") and name.endswith(".class")
    )
    found: set[str] = set()
    for path in paths:
        if path not in names:
            continue
        cls = parse_class_file(jar.read(path))
        for method in cls.methods:
            if not method.code:
                continue
            for _start, op, arg in iter_opcodes(method.code):
                if op != 187:
                    continue
                created = cls.class_name(u2_from(arg))
                if created.startswith("com.megacrit.cardcrawl.powers.") and "$" not in created:
                    found.add(created)
    return found


def attach_power_sources(
    jar,
    powers: list[dict[str, Any]],
    sources: dict[str, list[dict[str, Any]]],
) -> None:
    """Add `sources.{cards,relics,potions}` = ids whose class instantiates the power."""
    names = set(jar.namelist())
    by_class = {power["className"]: power for power in powers}
    for power in powers:
        power["sources"] = {kind: [] for kind in sources}
    for kind, rows in sources.items():
        for row in rows:
            for created in sorted(_instantiated_power_classes(jar, row["className"], names)):
                power = by_class.get(created)
                if power and row["id"] not in power["sources"][kind]:
                    power["sources"][kind].append(row["id"])


def _class_news(jar, path: str) -> set[str]:
    cls = parse_class_file(jar.read(path))
    created: set[str] = set()
    for method in cls.methods:
        if not method.code:
            continue
        for _start, op, arg in iter_opcodes(method.code):
            if op == 187:
                created.add(cls.class_name(u2_from(arg)))
    return created


def live_power_classes(jar) -> set[str]:
    """Power classes that some non-deprecated class still instantiates (`new`).

    Orphaned classes remain in the jar after reworks (e.g. Book of Stabbing's
    Attack/Skill Burn, beta Watcher Vault/Omniscience); nothing applies them.
    Instantiations from dead powers do not count, so iterate to a fixpoint.
    """
    edges: dict[str, set[str]] = {}
    for name in jar.namelist():
        if not name.startswith("com/megacrit/") or not name.endswith(".class") or "/deprecated/" in name:
            continue
        owner = name.removesuffix(".class").split("$")[0].replace("/", ".")
        powers = {
            created for created in _class_news(jar, name)
            if created.startswith("com.megacrit.cardcrawl.powers.") and "$" not in created
            and created.split("$")[0] != owner
        }
        if powers:
            edges.setdefault(owner, set()).update(powers)
    live: set[str] = set()
    changed = True
    while changed:
        changed = False
        for owner, created in edges.items():
            if owner.startswith("com.megacrit.cardcrawl.powers.") and owner not in live:
                continue
            new = created - live
            if new:
                live |= new
                changed = True
    return live


def load_powers(jar, loc_eng: dict[str, Any]) -> list[dict[str, Any]]:
    live = live_power_classes(jar)
    powers: list[dict[str, Any]] = []
    seen: set[str] = set()
    for class_path in _power_class_paths(jar.namelist()):
        if class_path.removesuffix(".class").replace("/", ".") not in live:
            continue
        power = parse_power(jar, class_path)
        if not power or power["locKey"] not in loc_eng or power["id"] in seen:
            continue
        seen.add(power["id"])
        powers.append(power)
    return powers


def localize_power(power: dict[str, Any], entry: dict[str, Any], period: str) -> dict[str, Any]:
    descriptions = [str(part) for part in (entry.get("DESCRIPTIONS") or [])]
    name = entry.get("NAME") or power["id"]
    return {
        "name": name,
        "description": render_template(power["_template"], descriptions, name=name, period=period).strip(),
        "descriptions": descriptions,
    }


def public_power_row(power: dict[str, Any]) -> dict[str, Any]:
    row = {key: value for key, value in power.items() if not key.startswith("_") and key != "locKey"}
    row["legacySlugs"] = [power["slug"]]
    return row
