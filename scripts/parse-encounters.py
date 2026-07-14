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
import math
import re
import sys
from fractions import Fraction
from itertools import permutations, product
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
_MONSTER_ARRAY_RE = re.compile(
    r"(?:private\s+)?static\s+(?:readonly\s+)?MonsterModel\[\]\s+(?P<name>\w+)\s*"
    r"(?:=|=>)\s*new\s+MonsterModel\[\d+\]\s*\{(?P<body>.*?)\};",
    re.DOTALL,
)
_RANDOM_ENUM_SWITCH_RE = re.compile(
    r"switch\s*\(base\.Rng\.NextItem\(Enum\.GetValues<(?P<enum>\w+)>\(\)\)\)"
)
_SPAN_ASSIGNMENT_RE = re.compile(r"span\[[^\]]+\]\s*=\s*(?P<value>[^;]+);")
_TUPLE_VALUE_RE = re.compile(
    r"\(\s*(?P<value>(?:ModelDb\.Monster<\w+>\(\)|"
    r"base\.Rng\.NextItem\(\w+\)|[a-z]\w*)(?:\.ToMutable\(\))?)\s*,"
)
_TUPLE_PAIR_RE = re.compile(
    r"\(\s*(?P<value>(?:ModelDb\.Monster<\w+>\(\)|"
    r"base\.Rng\.NextItem\(\w+\)|[a-z]\w*)(?:\.ToMutable\(\))?)\s*,\s*"
    r"(?P<slot>null|\"[^\"]*\"|(?:Slots|_\w+)\[[^\]]+\])\s*\)"
)
_DIRECT_VARIABLE_RE = re.compile(
    r"\b(?P<name>[a-z]\w*)\s*=\s*(?:\([^;=]+\))?"
    r"ModelDb\.Monster<(?P<class>\w+)>\(\)\.ToMutable\(\)\s*;"
)


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


def extract_braced_block(text: str, opening_brace: int) -> tuple[str, int] | None:
    """Return a balanced C# brace block and the index after its closing brace."""
    if opening_brace < 0 or opening_brace >= len(text) or text[opening_brace] != "{":
        return None
    depth = 0
    for index in range(opening_brace, len(text)):
        if text[index] == "{":
            depth += 1
        elif text[index] == "}":
            depth -= 1
            if depth == 0:
                return text[opening_brace + 1 : index], index + 1
    return None


def parse_monster_arrays(text: str) -> dict[str, list[str]]:
    arrays: dict[str, list[str]] = {}
    for match in _MONSTER_ARRAY_RE.finditer(text):
        arrays[match.group("name")] = [
            monster.group("cls") for monster in _MONSTER_REF_RE.finditer(match.group("body"))
        ]
    return arrays


def generate_monsters_body(text: str) -> str | None:
    match = re.search(r"GenerateMonsters\s*\(\)\s*\{", text)
    if match is None:
        return None
    block = extract_braced_block(text, match.end() - 1)
    return block[0] if block is not None else None


def tuple_values(text: str) -> list[str]:
    return [match.group("value") for match in _TUPLE_VALUE_RE.finditer(text)]


def span_tuple_values(text: str) -> list[str]:
    values: list[str] = []
    for assignment in _SPAN_ASSIGNMENT_RE.finditer(text):
        nested_values = tuple_values(assignment.group("value"))
        if nested_values:
            values.append(nested_values[0])
    return values


def tuple_pairs(text: str) -> list[tuple[str, str]]:
    return [
        (match.group("value"), match.group("slot"))
        for match in _TUPLE_PAIR_RE.finditer(text)
    ]


def span_tuple_pairs(text: str) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for assignment in _SPAN_ASSIGNMENT_RE.finditer(text):
        nested_pairs = tuple_pairs(assignment.group("value"))
        if nested_pairs:
            pairs.append(nested_pairs[0])
    return pairs


def parse_string_arrays(text: str) -> dict[str, list[str]]:
    arrays: dict[str, list[str]] = {}
    for match in re.finditer(
        r"string\[\]\s+(?P<name>\w+)\s*=\s*new\s+string\[\d+\]\s*"
        r"\{(?P<body>.*?)\};",
        text,
        re.DOTALL,
    ):
        arrays[match.group("name")] = re.findall(r'"([^"]*)"', match.group("body"))
    slots_match = re.search(
        r"IReadOnlyList<string>\s+Slots\s*=>.*?new\s+string\[\d+\]\s*"
        r"\{(?P<body>.*?)\}\s*\)?;",
        text,
        re.DOTALL,
    )
    if slots_match is not None:
        arrays["Slots"] = re.findall(r'"([^"]*)"', slots_match.group("body"))
    return arrays


def resolve_slot_name(value: str, arrays: dict[str, list[str]]) -> str | None:
    if value == "null":
        return None
    if value.startswith('"') and value.endswith('"'):
        return value[1:-1]
    match = re.fullmatch(r"(?P<name>\w+)\[(?P<index>\d+)\]", value)
    if match is None:
        return None
    options = arrays.get(match.group("name"), [])
    index = int(match.group("index"))
    return options[index] if index < len(options) else None


def direct_variable_monsters(body: str) -> dict[str, str]:
    return {
        match.group("name"): match.group("class")
        for match in _DIRECT_VARIABLE_RE.finditer(body)
    }


def monster_id(monster_class: str) -> str:
    return snake_case_upper(monster_class)


def resolve_slot_options(
    value: str,
    arrays: dict[str, list[str]],
    variables: dict[str, str],
) -> list[str] | None:
    value = value.removesuffix(".ToMutable()")
    if match := re.fullmatch(r"ModelDb\.Monster<(?P<class>\w+)>\(\)", value):
        return [match.group("class")]
    if match := re.fullmatch(r"base\.Rng\.NextItem\((?P<name>\w+)\)", value):
        return arrays.get(match.group("name"))
    if value in variables:
        return [variables[value]]
    return None


def weighted_compositions(
    outcomes: list[tuple[list[str], Fraction]],
    *,
    fixed_id: str = "FIXED",
    slot_names: list[str | None] | None = None,
) -> list[dict] | None:
    if not outcomes:
        return None

    combined: dict[tuple[str, ...], Fraction] = {}
    for monsters, probability in outcomes:
        key = tuple(monsters)
        combined[key] = combined.get(key, Fraction()) + probability

    denominator = math.lcm(*(probability.denominator for probability in combined.values()))
    raw_weights = [
        probability.numerator * (denominator // probability.denominator)
        for probability in combined.values()
    ]
    divisor = math.gcd(*raw_weights)
    normalized_weights = [weight // divisor for weight in raw_weights]
    multiple = len(combined) > 1

    compositions = [
        {
            "id": f"OPTION_{index:02d}" if multiple else fixed_id,
            "weight": normalized_weights[index - 1],
            "slots": [[monster_id(monster)] for monster in monsters],
        }
        for index, monsters in enumerate(combined, start=1)
    ]
    if slot_names is not None and any(slot_name is not None for slot_name in slot_names):
        for composition in compositions:
            composition["slot_names"] = slot_names
    return compositions


def parse_constrained_random_compositions(text: str, body: str) -> list[dict] | None:
    selection = re.search(r"(?P<name>_\w+)\.Keys\.Where\(", body)
    loop = re.search(r"for\s*\(int\s+\w+\s*=\s*0;\s*\w+\s*<\s*(?P<count>\d+);", body)
    if selection is None or loop is None:
        return None

    dictionary_name = selection.group("name")
    declaration = re.search(
        rf"Dictionary<MonsterModel,\s*int>\s+{re.escape(dictionary_name)}\s*=\s*"
        r"new\s+Dictionary<MonsterModel,\s*int>\s*\{",
        text,
    )
    if declaration is None:
        return None
    dictionary_block = extract_braced_block(text, declaration.end() - 1)
    if dictionary_block is None:
        return None
    limits = [
        (match.group("class"), int(match.group("count")))
        for match in re.finditer(
            r"ModelDb\.Monster<(?P<class>\w+)>\(\)\s*,\s*(?P<count>\d+)",
            dictionary_block[0],
        )
    ]
    if not limits:
        return None

    loop_start = body.find(loop.group(0))
    prefix_pairs = span_tuple_pairs(body[:loop_start])
    prefix_values = [value for value, _slot in prefix_pairs]
    variables = direct_variable_monsters(body)
    prefix: list[str] = []
    for value in prefix_values:
        options = resolve_slot_options(value, parse_monster_arrays(text), variables)
        if options is None or len(options) != 1:
            return None
        prefix.append(options[0])

    outcomes: list[tuple[list[str], Fraction]] = []

    def visit(sequence: list[str], counts: dict[str, int], probability: Fraction) -> None:
        if len(sequence) == int(loop.group("count")):
            outcomes.append((prefix + sequence, probability))
            return
        valid = [(monster, limit) for monster, limit in limits if counts.get(monster, 0) < limit]
        for monster, _limit in valid:
            next_counts = dict(counts)
            next_counts[monster] = next_counts.get(monster, 0) + 1
            visit(sequence + [monster], next_counts, probability / len(valid))

    visit([], {}, Fraction(1))
    string_arrays = parse_string_arrays(text)
    slot_names = [resolve_slot_name(slot, string_arrays) for _value, slot in prefix_pairs]
    if dictionary_slots := string_arrays.get("_slotNames"):
        slot_names.extend(dictionary_slots[len(slot_names) : len(prefix) + int(loop.group("count"))])
    else:
        slot_names.extend([None] * int(loop.group("count")))
    return weighted_compositions(outcomes, slot_names=slot_names)


def parse_without_replacement_compositions(
    text: str,
    body: str,
) -> list[dict] | None:
    arrays = parse_monster_arrays(text)
    copy_match = re.search(
        r"List<MonsterModel>\s+(?P<list>\w+)\s*=\s*(?P<array>_\w+)\.ToList\(\)\s*;",
        body,
    )
    if copy_match is None or copy_match.group("array") not in arrays:
        return None
    list_name = copy_match.group("list")
    choice_variables = re.findall(
        rf"MonsterModel\s+(\w+)\s*=\s*base\.Rng\.NextItem\({re.escape(list_name)}\)\s*;",
        body,
    )
    if len(choice_variables) < 2:
        return None

    pairs = [
        (match.group("value"), match.group("slot"))
        for match in re.finditer(
            r"\.Add\(\s*\(\s*(?P<value>(?:base\.Rng\.NextItem\(\w+\)|[a-z]\w*)"
            r"(?:\.ToMutable\(\))?)\s*,\s*(?P<slot>null|\"[^\"]*\"|"
            r"(?:Slots|_\w+)\[[^\]]+\])\s*\)",
            body,
        )
    ]
    values = [value for value, _slot in pairs]
    if not values:
        return None

    outcomes: list[tuple[list[str], Fraction]] = []
    source = arrays[copy_match.group("array")]
    for selected in permutations(source, len(choice_variables)):
        selected_by_variable = dict(zip(choice_variables, selected, strict=True))
        slot_options: list[list[str]] = []
        for value in values:
            value = value.removesuffix(".ToMutable()")
            if value in selected_by_variable:
                slot_options.append([selected_by_variable[value]])
                continue
            options = resolve_slot_options(value, arrays, {})
            if not options:
                return None
            slot_options.append(options)
        combinations = list(product(*slot_options))
        probability = Fraction(1, math.perm(len(source), len(choice_variables)) * len(combinations))
        outcomes.extend((list(monsters), probability) for monsters in combinations)
    string_arrays = parse_string_arrays(text)
    slot_names = [resolve_slot_name(slot, string_arrays) for _value, slot in pairs]
    return weighted_compositions(outcomes, slot_names=slot_names)


def parse_boolean_compositions(text: str, body: str) -> list[dict] | None:
    flag_match = re.search(r"bool\s+(?P<flag>\w+)\s*=\s*base\.Rng\.NextBool\(\)\s*;", body)
    if flag_match is None:
        return None
    flag = flag_match.group("flag")
    conditional_variables = {
        match.group("name"): (match.group("true"), match.group("false"))
        for match in re.finditer(
            rf"MonsterModel\s+(?P<name>\w+)\s*=\s*\({re.escape(flag)}\s*\?\s*"
            r"\(\(MonsterModel\)ModelDb\.Monster<(?P<true>\w+)>\(\)\)\s*:\s*"
            r"\(\(MonsterModel\)ModelDb\.Monster<(?P<false>\w+)>\(\)\)\)\s*;",
            body,
        )
    }
    if not conditional_variables:
        return None

    return_start = body.rfind("return ")
    pairs = tuple_pairs(body[return_start:]) if return_start >= 0 else []
    values = [value for value, _slot in pairs]
    arrays = parse_monster_arrays(text)
    outcomes: list[tuple[list[str], Fraction]] = []
    for truthy in (True, False):
        variables = direct_variable_monsters(body)
        variables.update({name: choices[0 if truthy else 1] for name, choices in conditional_variables.items()})
        monsters: list[str] = []
        for value in values:
            options = resolve_slot_options(value, arrays, variables)
            if options is None or len(options) != 1:
                return None
            monsters.append(options[0])
        outcomes.append((monsters, Fraction(1, 2)))
    string_arrays = parse_string_arrays(text)
    slot_names = [resolve_slot_name(slot, string_arrays) for _value, slot in pairs]
    return weighted_compositions(outcomes, slot_names=slot_names)


def parse_return_compositions(text: str, body: str) -> list[dict] | None:
    return_start = body.rfind("return ")
    if return_start < 0:
        return None
    pairs = tuple_pairs(body[return_start:])
    values = [value for value, _slot in pairs]
    if not values:
        return None

    arrays = parse_monster_arrays(text)
    variables = direct_variable_monsters(body)
    slot_options: list[list[str]] = []
    for value in values:
        options = resolve_slot_options(value, arrays, variables)
        if not options:
            return None
        slot_options.append(options)
    combinations = list(product(*slot_options))
    probability = Fraction(1, len(combinations))
    string_arrays = parse_string_arrays(text)
    slot_names = [resolve_slot_name(slot, string_arrays) for _value, slot in pairs]
    return weighted_compositions(
        [(list(monsters), probability) for monsters in combinations],
        slot_names=slot_names,
    )


def parse_list_composition(text: str, body: str) -> list[dict] | None:
    arrays = parse_monster_arrays(text)
    variables = direct_variable_monsters(body)
    pairs = span_tuple_pairs(body)
    pairs.extend(
        (match.group("value"), match.group("slot"))
        for match in re.finditer(
            r"\.Add\(\s*\(\s*(?P<value>(?:ModelDb\.Monster<\w+>\(\)|[a-z]\w*)"
            r"(?:\.ToMutable\(\))?)\s*,\s*(?P<slot>null|\"[^\"]*\"|"
            r"(?:Slots|_\w+)\[[^\]]+\])\s*\)",
            body,
        )
    )
    values = [value for value, _slot in pairs]
    if not values:
        return None

    monsters: list[str] = []
    for value in values:
        options = resolve_slot_options(value, arrays, variables)
        if options is None or len(options) != 1:
            return None
        monsters.append(options[0])
    string_arrays = parse_string_arrays(text)
    slot_names = [resolve_slot_name(slot, string_arrays) for _value, slot in pairs]
    return weighted_compositions([(monsters, Fraction(1))], slot_names=slot_names)


def parse_foreach_slot_composition(text: str, body: str) -> list[dict] | None:
    if "foreach (string slot in Slots)" not in body:
        return None
    monster_match = re.search(r"ModelDb\.Monster<(?P<class>\w+)>\(\)\.ToMutable\(\)", body)
    slot_count = re.search(r"Slots\s*=>.*?new\s+string\[(?P<count>\d+)\]", text, re.DOTALL)
    if monster_match is None or slot_count is None:
        return None
    monsters = [monster_match.group("class")] * int(slot_count.group("count"))
    return weighted_compositions(
        [(monsters, Fraction(1))],
        slot_names=parse_string_arrays(text).get("Slots"),
    )


def parse_encounter_compositions(text: str) -> list[dict] | None:
    body = generate_monsters_body(text)
    if body is None:
        return None
    return (
        parse_random_enum_compositions(text)
        or parse_constrained_random_compositions(text, body)
        or parse_without_replacement_compositions(text, body)
        or parse_boolean_compositions(text, body)
        or parse_return_compositions(text, body)
        or parse_foreach_slot_composition(text, body)
        or parse_list_composition(text, body)
    )


def parse_random_enum_compositions(text: str) -> list[dict] | None:
    """Parse equal-weight enum branches into weighted, ordered monster slots."""
    switch_match = _RANDOM_ENUM_SWITCH_RE.search(text)
    if switch_match is None:
        return None

    enum_name = switch_match.group("enum")
    enum_match = re.search(rf"private\s+enum\s+{re.escape(enum_name)}\s*\{{", text)
    if enum_match is None:
        return None
    enum_block = extract_braced_block(text, enum_match.end() - 1)
    if enum_block is None:
        return None
    enum_values = re.findall(r"\b[A-Za-z_]\w*\b", enum_block[0])
    if not enum_values:
        return None

    switch_open = text.find("{", switch_match.end())
    switch_block = extract_braced_block(text, switch_open)
    if switch_block is None:
        return None
    switch_body, switch_end = switch_block
    arrays = parse_monster_arrays(text)
    compositions: list[dict] = []

    for branch_name in enum_values:
        branch_match = re.search(
            rf"case\s+{re.escape(enum_name)}\.{re.escape(branch_name)}\s*:",
            switch_body,
        )
        if branch_match is None:
            return None
        next_branch = re.search(
            rf"(?:case\s+{re.escape(enum_name)}\.\w+\s*:|default\s*:)",
            switch_body[branch_match.end() :],
        )
        branch_end = (
            branch_match.end() + next_branch.start() if next_branch is not None else len(switch_body)
        )
        branch_body = switch_body[branch_match.end() : branch_end]
        slots: list[list[str]] = []
        for assignment in _SPAN_ASSIGNMENT_RE.finditer(branch_body):
            value = assignment.group("value").strip()
            monster_match = _MONSTER_REF_RE.fullmatch(value)
            if monster_match is not None:
                slots.append([monster_match.group("cls")])
                continue
            array_match = re.fullmatch(r"base\.Rng\.NextItem\((?P<name>_\w+)\)", value)
            if array_match is not None and arrays.get(array_match.group("name")):
                slots.append(arrays[array_match.group("name")])
                continue
            return None
        if not slots:
            return None
        compositions.append(
            {
                "id": snake_case_upper(branch_name),
                "weight": 1,
                "slots": [[snake_case_upper(monster) for monster in slot] for slot in slots],
            }
        )

    tail = text[switch_end :]
    tail_end = tail.find("return ")
    if tail_end >= 0:
        tail = tail[:tail_end]
    trailing_monsters = [match.group("cls") for match in _MONSTER_REF_RE.finditer(tail)]
    for composition in compositions:
        composition["slots"].extend(
            [[snake_case_upper(monster)] for monster in trailing_monsters]
        )
    return compositions


def parse_encounter_meta(text: str) -> dict:
    rt = _ROOMTYPE_RE.search(text)
    out = {
        "room_type": rt.group("rt") if rt else "Monster",
        "is_weak": bool(_ISWEAK_RE.search(text)),
        "monster_classes": [],
        "compositions": parse_encounter_compositions(text),
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
    deprecated_ids = {
        e["id"]
        for e in existing_kor
        if e.get("deprecated") and not e["id"].startswith(SKIP_PREFIXES)
    }
    ids = sorted(set(ids) | deprecated_ids)
    act_index = build_act_index(source_root)

    kor_out, eng_out = [], []
    added, removed = [], []

    for ent_id in ids:
        deprecated_only = ent_id not in loc_kor_by_id and ent_id not in loc_eng_by_id
        cs = find_encounter_class(source_root, ent_id)
        if cs is not None:
            meta = parse_encounter_meta(cs.read_text())
        else:
            meta = {
                "room_type": "Monster",
                "is_weak": False,
                "monster_classes": [],
                "compositions": None,
                "tags": [],
            }

        act_label = act_index.get(ent_id)

        for lang, loc_by_id, mon_name_by_id, old_by_id, out in (
            ("kor", loc_kor_by_id, monster_name_by_id_kor, old_kor_by_id, kor_out),
            ("eng", loc_eng_by_id, monster_name_by_id_eng, old_eng_by_id, eng_out),
        ):
            lnode = loc_by_id.get(ent_id, {})
            old = old_by_id.get(ent_id, {})
            if deprecated_only and old.get("deprecated"):
                out.append(old)
                continue

            monsters = []
            for cls in meta["monster_classes"]:
                mid = snake_case_upper(cls)
                monsters.append({"id": mid, "name": mon_name_by_id.get(mid) or mid})
            entry = {
                "id": ent_id,
                "name": lnode.get("title") or old.get("name"),
            }
            for lifecycle_key in ("introducedInPatch", "deprecated", "deprecatedInPatch"):
                if old.get(lifecycle_key) is not None:
                    entry[lifecycle_key] = old[lifecycle_key]
            entry.update({
                "room_type": meta["room_type"],
                "is_weak": meta["is_weak"],
                "act": act_label if act_label is not None else old.get("act"),
                "tags": meta["tags"] or None,
                "monsters": monsters if monsters else old.get("monsters", []),
                "loss_text": lnode.get("loss") or old.get("loss_text"),
            })
            if meta["compositions"] is not None:
                entry["compositions"] = meta["compositions"]
            elif old.get("compositions") is not None:
                entry["compositions"] = old["compositions"]
            out.append(entry)

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
