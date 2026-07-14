#!/usr/bin/env python3
"""Parse monsters from the local STS2 PCK + decompiled DLL source.

Writes data/sts2/{eng,kor}/monsters.json, preserving the existing schema.

Data sources:
- Initial HP (base + ascension) and the authoritative move list come from the
  decompiled .cs class file — DLL is source of truth for gameplay data.
- Move titles and display names come from the PCK localization tables.
- Damage/block numbers are pulled from `private int XxxDamage => ...` properties.

Prerequisites:
- Local STS2 install (PCK auto-detected)
- Decompiled DLL source at /tmp/sts2-src (default). Produce with:
    ilspycmd -p -o /tmp/sts2-src "<sts2.dll path>"
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
SKIP_PREFIXES = ("DEPRECATED_", "MOCK_", "ATTACK_MOVE_MONSTER", "BIG_DUMMY", "GENERIC")
SKIP_IDS = {"OSTY"}

MONSTER_NAMESPACES = [
    "MegaCrit.Sts2.Core.Models.Monsters",
    "MegaCrit.Sts2.Core.Models.Events",
]

_HP_ASC_RE = re.compile(
    r"public\s+override\s+int\s+(?P<field>MinInitialHp|MaxInitialHp)\s*=>\s*"
    r"AscensionHelper\.GetValueIfAscension\([^,]+,\s*(?P<asc>\d+)\s*,\s*(?P<base>\d+)\s*\)\s*;"
)
_HP_PLAIN_RE = re.compile(
    r"public\s+override\s+int\s+(?P<field>MinInitialHp|MaxInitialHp)\s*=>\s*(?P<base>\d+)\s*;"
)
_INT_PROP_ASC_RE = re.compile(
    r"(?:public|private|protected)\s+(?:static\s+)?int\s+(?P<name>\w+)\s*=>\s*"
    r"AscensionHelper\.GetValueIfAscension\([^,]+,\s*(?P<asc>\d+)\s*,\s*(?P<base>\d+)\s*\)\s*;"
)
_INT_PROP_PLAIN_RE = re.compile(
    r"(?:public|private|protected)\s+(?:static\s+)?int\s+(?P<name>\w+)\s*=>\s*(?P<val>\d+)\s*;"
)
_INT_PROP_DEFAULT_GETTER_RE = re.compile(
    r"(?:public|private|protected)\s+(?:static\s+)?int\s+(?P<name>\w+)\s*\{.*?"
    r"return\s+[^;]*\?\?\s*(?P<val>\d+)\s*;.*?\n\t\}",
    re.DOTALL,
)
_INT_LOCAL_ASC_RE = re.compile(
    r"\bint\s+(?P<name>\w+)\s*=\s*"
    r"AscensionHelper\.GetValueIfAscension\([^,]+,\s*(?P<asc>\d+)\s*,\s*(?P<base>\d+)\s*\)\s*;"
)
_INT_LOCAL_ENEMY_SIDE_TERNARY_RE = re.compile(
    r"\bint\s+(?P<name>\w+)\s*=\s*"
    r"\(\(base\.CombatState\.CurrentSide\s*!=\s*CombatSide\.Enemy\)\s*\?\s*\d+\s*:\s*(?P<enemy>\d+)\)\s*;"
)
_INT_LOCAL_PLAIN_RE = re.compile(r"\bint\s+(?P<name>\w+)\s*=\s*(?P<val>\d+)\s*;")
_MOVESTATE_START_RE = re.compile(r'new\s+MoveState\(\s*"(?P<id>\w+)"')
_INTENT_START_RE = re.compile(r"new\s+(?P<kind>\w+Intent)\s*\(")
_MOVE_VAR_RE = re.compile(r"MoveState\s+(?P<var>\w+)\s*=.*?new\s+MoveState\(\s*\"(?P<id>\w+)\"", re.DOTALL)
_RANDOM_BRANCH_VAR_RE = re.compile(r"RandomBranchState\s+(?P<var>\w+)\s*=.*?new\s+RandomBranchState\(\s*\"(?P<id>\w+)\"", re.DOTALL)
_CONDITIONAL_BRANCH_VAR_RE = re.compile(r"ConditionalBranchState\s+(?P<var>\w+)\s*=.*?new\s+ConditionalBranchState\(\s*\"(?P<id>\w+)\"", re.DOTALL)
_FOLLOWUP_RE = re.compile(r"(?P<from>\w+)\.FollowUpState\s*=\s*(?P<target>\w+)")
_INLINE_MOVE_FOLLOWUP_RE = re.compile(r"MoveState\s+(?P<target>\w+)\s*=[^;\n]*\((?P<from>\w+)\.FollowUpState\s*=\s*new\s+MoveState")
_ADD_BRANCH_RE = re.compile(r"(?P<branch>\w+)\.AddBranch\((?P<args>[^;]+)\);")
_ADD_CONDITIONAL_STATE_RE = re.compile(r"(?P<branch>\w+)\.AddState\((?P<target>\w+),")
_ADD_CONDITIONAL_STATE_ARGS_RE = re.compile(r"(?P<branch>\w+)\.AddState\((?P<args>[^;]+)\);")
_MOVE_PROPERTY_RE = re.compile(r"(?<!\.)\b(?P<var>[A-Z]\w*)\s*=\s*new\s+MoveState\(\s*\"(?P<id>\w+)\"", re.DOTALL)
_POWER_APPLY_GENERIC_RE = re.compile(r"PowerCmd\.Apply<(?P<power>\w+Power)>\((?P<args>.*?)\);", re.DOTALL)
_POWER_APPLY_DYNAMIC_RE = re.compile(r"PowerCmd\.Apply\((?P<args>.*?)\);", re.DOTALL)
_POWER_VAR_DECL_RE = re.compile(r"(?P<class>\w+Power)\s+(?P<var>\w+)\b")
_POWER_MODELDB_ASSIGN_RE = re.compile(r"(?P<var>\w+)\s*=\s*\((?P<class>\w+Power)\)ModelDb\.Power<\w+Power>")
_CARD_ADD_RE = re.compile(r"CardPileCmd\.AddToCombatAndPreview<(?P<card>\w+)>\((?P<args>.*?)\);", re.DOTALL)
_GAIN_BLOCK_RE = re.compile(r"CreatureCmd\.GainBlock\([^,]+,\s*(?P<value>[^,\)]+)")

INTENT_ACTION_TYPES = {
    "SingleAttackIntent": "attack",
    "MultiAttackIntent": "attack",
    "DeathBlowIntent": "attack",
    "AttackIntent": "attack",
    "DefendIntent": "defense",
    "DebuffIntent": "debuff",
    "CardDebuffIntent": "debuff",
    "StatusIntent": "debuff",
    "BuffIntent": "buff",
    "HealIntent": "buff",
    "SummonIntent": "buff",
    "EscapeIntent": "special",
    "HiddenIntent": "special",
    "SleepIntent": "special",
    "StunIntent": "special",
}


def _balanced_span(text: str, start: int) -> int:
    """Given an index of '(', return the index of matching ')'; -1 if none."""
    depth = 0
    i = start
    while i < len(text):
        c = text[i]
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1


def _balanced_brace_span(text: str, start: int) -> int:
    """Given an index of '{', return the index of matching '}'; -1 if none."""
    depth = 0
    for index in range(start, len(text)):
        if text[index] == "{":
            depth += 1
        elif text[index] == "}":
            depth -= 1
            if depth == 0:
                return index
    return -1


def pascal_case(snake: str) -> str:
    return "".join(w.capitalize() for w in snake.split("_"))


def find_monster_class(source_root: Path, ent_id: str) -> Path | None:
    class_name = pascal_case(ent_id)
    for ns in MONSTER_NAMESPACES:
        p = source_root / ns / f"{class_name}.cs"
        if p.is_file():
            return p
    return None


def parse_hp(text: str) -> dict:
    out = {"min_hp": None, "max_hp": None, "min_hp_ascension": None, "max_hp_ascension": None}
    for m in _HP_ASC_RE.finditer(text):
        if m.group("field") == "MinInitialHp":
            out["min_hp"] = int(m.group("base"))
            out["min_hp_ascension"] = int(m.group("asc"))
        else:
            out["max_hp"] = int(m.group("base"))
            out["max_hp_ascension"] = int(m.group("asc"))
    for m in _HP_PLAIN_RE.finditer(text):
        if m.group("field") == "MinInitialHp" and out["min_hp"] is None:
            out["min_hp"] = int(m.group("base"))
        elif m.group("field") == "MaxInitialHp" and out["max_hp"] is None:
            out["max_hp"] = int(m.group("base"))
    return out


def parse_int_props(text: str) -> dict[str, dict]:
    """Return {prop_name: {normal, ascension}} for every int property, inc. plain ints."""
    out: dict[str, dict] = {}
    for m in _INT_PROP_ASC_RE.finditer(text):
        out[m.group("name")] = {
            "normal": int(m.group("base")),
            "ascension": int(m.group("asc")),
        }
    for m in _INT_PROP_PLAIN_RE.finditer(text):
        name = m.group("name")
        if name not in out:
            out[name] = {"normal": int(m.group("val")), "ascension": None}
    for m in _INT_PROP_DEFAULT_GETTER_RE.finditer(text):
        name = m.group("name")
        if name not in out:
            out[name] = {"normal": int(m.group("val")), "ascension": None}
    for m in _INT_LOCAL_ASC_RE.finditer(text):
        out[m.group("name")] = {
            "normal": int(m.group("base")),
            "ascension": int(m.group("asc")),
        }
    for m in _INT_LOCAL_ENEMY_SIDE_TERNARY_RE.finditer(text):
        out[m.group("name")] = {"normal": int(m.group("enemy")), "ascension": None}
    for m in _INT_LOCAL_PLAIN_RE.finditer(text):
        name = m.group("name")
        if name not in out:
            out[name] = {"normal": int(m.group("val")), "ascension": None}
    return out


def strip_move_suffix(move_id: str) -> str:
    return move_id[:-5] if move_id.endswith("_MOVE") else move_id


def move_title_candidates(move_id: str) -> list[str]:
    """Return localization lookup keys for a move, preserving distinct move IDs."""
    candidates: list[str] = []

    def add(candidate: str) -> None:
        if candidate and candidate not in candidates:
            candidates.append(candidate)

    seeds = [move_id, strip_move_suffix(move_id)]
    for seed in seeds:
        add(seed)

        move_number_match = re.match(r"(.+)_MOVE_\d+$", seed)
        if move_number_match:
            add(move_number_match.group(1))

        trailing_number_match = re.match(r"(.+?)\d+$", seed)
        if trailing_number_match:
            add(trailing_number_match.group(1))

        underscore_number_match = re.match(r"(.+)_\d+$", seed)
        if underscore_number_match:
            add(underscore_number_match.group(1))

    return candidates


def resolve_move_title(loc_entry: dict, move_id: str) -> str | None:
    """Try locale under move ID variants, both title and _self."""
    moves = loc_entry.get("moves", {}) or {}
    for key in move_title_candidates(move_id):
        node = moves.get(key)
        if isinstance(node, dict):
            title = node.get("title") or node.get("_self")
            if title:
                return title
        elif isinstance(node, str):
            return node
    return None


def method_body(text: str, method_name: str) -> str | None:
    idx = text.find(method_name)
    if idx < 0:
        return None
    open_brace = text.find("{", idx)
    if open_brace < 0:
        return None
    depth = 0
    for i in range(open_brace, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return text[open_brace + 1 : i]
    return None


def parse_show_in_compendium(text: str) -> bool:
    return not re.search(r"ShouldShowInCompendium\s*=>\s*false\s*;", text)


def parse_hidden_bestiary_moves(text: str) -> set[str]:
    body = method_body(text, "ShouldShowMoveInBestiary")
    if not body:
        return set()
    # Current overrides are hide-lists expressed as `moveStateId != "X"` plus
    # `return false` fallbacks. Every literal in the override is hidden.
    return {strip_move_suffix(m) for m in re.findall(r'"([A-Z0-9_]+)"', body)}


def parse_inserted_bestiary_moves(text: str) -> list[tuple[int, str]]:
    body = method_body(text, "GenerateBestiaryMoveList")
    if not body:
        return []

    inserted: list[tuple[int, str]] = []
    for m in re.finditer(
        r"list\.Insert\(\s*(?P<idx>\d+)\s*,\s*BestiaryMonsterMove\."
        r"From(?:Action|NonStateMove)\(\s*GetBestiaryMoveName\(\"(?P<id>[A-Z0-9_]+)\"\)",
        body,
    ):
        inserted.append((int(m.group("idx")), m.group("id")))

    for m in re.finditer(r"list\.Insert\(\s*(?P<idx>\d+)\s*,\s*BestiaryMonsterMove\.FromStun\(", body):
        inserted.append((int(m.group("idx")), "STUNNED"))

    return inserted


def build_bestiary_move_ids(move_ids: list[str], text: str) -> list[str]:
    hidden = parse_hidden_bestiary_moves(text)
    visible = [
        strip_move_suffix(move_id)
        for move_id in move_ids
        if strip_move_suffix(move_id) not in hidden
    ]
    for index, move_id in sorted(parse_inserted_bestiary_moves(text), key=lambda item: item[0]):
        if move_id in visible:
            continue
        visible.insert(min(index, len(visible)), move_id)
    return visible


def split_args(args: str) -> list[str]:
    return split_top_level_args(args)


def split_top_level_args(args: str) -> list[str]:
    out: list[str] = []
    start = 0
    paren = bracket = brace = angle = 0
    for i, ch in enumerate(args):
        if ch == "(":
            paren += 1
        elif ch == ")":
            paren = max(0, paren - 1)
        elif ch == "[":
            bracket += 1
        elif ch == "]":
            bracket = max(0, bracket - 1)
        elif ch == "{":
            brace += 1
        elif ch == "}":
            brace = max(0, brace - 1)
        elif ch == "<":
            angle += 1
        elif ch == ">":
            angle = max(0, angle - 1)
        elif ch == "," and paren == 0 and bracket == 0 and brace == 0 and angle == 0:
            part = args[start:i].strip()
            if part:
                out.append(part)
            start = i + 1
    tail = args[start:].strip()
    if tail:
        out.append(tail)
    return out


def parse_float_literal(value: str) -> float | None:
    m = re.fullmatch(r"(?P<num>\d+(?:\.\d+)?)(?:f|m)?", value.strip())
    return float(m.group("num")) if m else None


def parse_random_branch_args(args: list[str]) -> dict:
    """Decode RandomBranchState.AddBranch overloads from decompiled C#."""
    rule_args = args[1:]
    weight = 1.0
    weight_expression = None

    if rule_args:
        candidate = rule_args[-1].strip()
        lambda_match = re.fullmatch(r"\(\)\s*=>\s*(?P<expr>.+)", candidate)
        if lambda_match:
            expression = lambda_match.group("expr").strip()
            literal = parse_float_literal(expression)
            weight = literal
            weight_expression = None if literal is not None else expression
            rule_args = rule_args[:-1]
        elif len(args) >= 3 and (candidate.endswith(("f", "m")) or "." in candidate):
            literal = parse_float_literal(candidate)
            if literal is not None:
                weight = literal
                rule_args = rule_args[:-1]

    repeat_type = "forever"
    max_repeats = None
    cooldown = 0
    repeat_arg_index = next(
        (index for index, value in enumerate(rule_args) if "MoveRepeatType." in value),
        None,
    )

    if repeat_arg_index is not None:
        repeat_name = rule_args[repeat_arg_index].split("MoveRepeatType.", 1)[1].strip()
        repeat_type = {
            "CanRepeatForever": "forever",
            "CanRepeatXTimes": "max_consecutive",
            "CannotRepeat": "cannot_repeat",
            "UseOnlyOnce": "once",
        }.get(repeat_name, "forever")
        integers = [int(value) for value in rule_args[:repeat_arg_index] if value.isdigit()]
        if integers:
            cooldown = integers[0]
    else:
        integers = [int(value) for value in rule_args if value.isdigit()]
        if integers:
            repeat_type = "max_consecutive"
            if len(integers) == 1:
                max_repeats = integers[0]
            else:
                cooldown, max_repeats = integers[0], integers[1]

    return {
        "weight": weight,
        "weight_expression": weight_expression,
        "repeat": repeat_type,
        "max_repeats": max_repeats,
        "cooldown": cooldown,
    }


def parse_initial_state_variants(text: str, state_vars: dict[str, str]) -> list[tuple[str, str | None]]:
    """Resolve every runtime-selectable initial state from the returned machine."""
    body = method_body(text, "GenerateMoveStateMachine") or text
    return_matches = list(re.finditer(r"\breturn\s+(?P<expression>.*?);", body, re.DOTALL))
    if not return_matches:
        return []
    variants: list[tuple[str, str | None]] = []
    prior_return_conditions: list[str] = []
    for return_match in return_matches:
        return_condition = enclosing_if_condition(body, return_match.start())
        if return_condition:
            prior_return_conditions.append(return_condition)
        elif prior_return_conditions:
            return_condition = " && ".join(invert_condition(condition) for condition in prior_return_conditions)
        nested_variants = parse_initial_state_expression(return_match.group("expression"), body, state_vars)
        for state_var, nested_condition in nested_variants:
            combined_condition = (
                f"({return_condition}) && ({nested_condition})"
                if return_condition and nested_condition
                else return_condition or nested_condition
            )
            variants.append((state_var, combined_condition))
    return variants


def enclosing_if_condition(body: str, position: int) -> str | None:
    """Return the innermost block-form `if` condition enclosing a position."""
    candidates: list[tuple[int, str]] = []
    for match in re.finditer(r"\bif\s*\(", body):
        open_paren = body.find("(", match.start())
        close_paren = _balanced_span(body, open_paren)
        if close_paren < 0:
            continue
        open_brace = body.find("{", close_paren)
        if open_brace < 0:
            continue
        close_brace = _balanced_brace_span(body, open_brace)
        if open_brace < position < close_brace:
            candidates.append((open_brace, simplify_condition(body[open_paren + 1 : close_paren]) or ""))
    return max(candidates, default=(0, None), key=lambda candidate: candidate[0])[1]


def invert_condition(condition: str) -> str:
    return f"!{condition}" if re.fullmatch(r"\w+", condition) else f"!({condition})"


def parse_initial_state_expression(
    expression: str,
    body: str,
    state_vars: dict[str, str],
) -> list[tuple[str, str | None]]:
    expression = expression.strip()

    constructor = re.search(r"new\s+MonsterMoveStateMachine\s*\(", expression)
    if constructor and expression[:constructor.start()].strip() in {"", "("}:
        open_paren = expression.find("(", constructor.start())
        close_paren = _balanced_span(expression, open_paren)
        if close_paren >= 0:
            args = split_top_level_args(expression[open_paren + 1 : close_paren])
            if len(args) >= 2:
                return parse_initial_state_expression(args[-1], body, state_vars)

    switch_match = re.search(r"(?P<subject>.*?)\s+switch\s*\{(?P<arms>.*)\}\s*$", expression, re.DOTALL)
    if switch_match:
        subject = switch_match.group("subject").strip().strip("()")
        arms = [
            (match.group("label").strip(), match.group("value").strip())
            for match in re.finditer(
                r"^\s*(?P<label>[^=,]+?)\s*=>\s*(?P<value>.*?)\s*,?\s*$",
                switch_match.group("arms"),
                re.MULTILINE,
            )
        ]
        explicit_labels = [label for label, _ in arms if label != "_"]
        variants: list[tuple[str, str | None]] = []
        for label, value in arms:
            nested = parse_initial_state_expression(value, body, state_vars)
            condition = switch_case_condition(subject, label, explicit_labels)
            variants.extend((state_var, condition) for state_var, _ in nested)
        if variants:
            return variants

    identifier = re.fullmatch(r"\(?\s*(?:\(\w+\)\s*)?(?P<var>\w+)\s*\)?", expression)
    if identifier:
        state_var = identifier.group("var")
        if state_var in state_vars:
            return [(state_var, None)]
        declaration = re.search(
            rf"\b(?:MoveState|MonsterState)\s+{re.escape(state_var)}\s*=\s*(?P<value>.*?);",
            body,
            re.DOTALL,
        )
        if declaration:
            return parse_initial_state_expression(declaration.group("value"), body, state_vars)

    question = expression.find("?")
    if question >= 0:
        condition = expression[:question].strip().lstrip("(").strip()
        candidates = [
            token
            for token in re.findall(r"\b\w+\b", expression[question + 1 :])
            if token in state_vars
        ]
        if len(candidates) >= 2:
            false_condition = invert_condition(condition)
            return [(candidates[0], simplify_condition(condition)), (candidates[1], false_condition)]

    candidates = [token for token in re.findall(r"\b\w+\b", expression) if token in state_vars]
    return [(candidates[0], None)] if candidates else []


def switch_case_condition(subject: str, label: str, explicit_labels: list[str]) -> str:
    if label != "_":
        return f"{subject} == {label}"
    modulo = re.search(r"%\s*(?P<count>\d+)$", subject)
    numeric_labels = {int(value) for value in explicit_labels if value.isdigit()}
    if modulo:
        missing = set(range(int(modulo.group("count")))) - numeric_labels
        if len(missing) == 1:
            return f"{subject} == {missing.pop()}"
    if explicit_labels:
        return " && ".join(f"{subject} != {value}" for value in explicit_labels)
    return f"otherwise({subject})"


def parse_move_graph(text: str) -> dict | None:
    move_vars = {
        m.group("var"): strip_move_suffix(m.group("id"))
        for m in _MOVE_VAR_RE.finditer(text)
    }
    move_vars.update({
        m.group("var"): strip_move_suffix(m.group("id"))
        for m in _MOVE_PROPERTY_RE.finditer(text)
    })
    if not move_vars:
        return None

    branch_vars = {
        m.group("var"): m.group("id")
        for m in _RANDOM_BRANCH_VAR_RE.finditer(text)
    }
    conditional_branch_vars = {
        m.group("var"): m.group("id")
        for m in _CONDITIONAL_BRANCH_VAR_RE.finditer(text)
    }
    state_vars = {**move_vars, **branch_vars, **conditional_branch_vars}
    initial_variants = parse_initial_state_variants(text, state_vars)
    initial_var = initial_variants[0][0] if initial_variants else None
    initial = state_vars.get(initial_var) if initial_var else None

    followups: dict[str, str] = {}
    for m in _FOLLOWUP_RE.finditer(text):
        followups[m.group("from")] = m.group("target")
    for m in _INLINE_MOVE_FOLLOWUP_RE.finditer(text):
        followups[m.group("from")] = m.group("target")
    for line in text.splitlines():
        for branch_var in branch_vars:
            if f"RandomBranchState {branch_var}" in line and "new RandomBranchState" in line:
                for from_var in re.findall(r"(\w+)\.FollowUpState", line):
                    followups[from_var] = branch_var
        for branch_var in conditional_branch_vars:
            if f"ConditionalBranchState {branch_var}" in line and "new ConditionalBranchState" in line:
                for from_var in re.findall(r"(\w+)\.FollowUpState", line):
                    followups[from_var] = branch_var

    random_branches: dict[str, list[dict]] = {}
    for m in _ADD_BRANCH_RE.finditer(text):
        branch_var = m.group("branch")
        args = split_args(m.group("args"))
        if not args or branch_var not in branch_vars:
            continue
        target_var = args[0]
        if target_var not in move_vars:
            continue
        branch_rule = parse_random_branch_args(args)
        random_branches.setdefault(branch_var, []).append({
            "target_var": target_var,
            **branch_rule,
        })

    conditional_branches: dict[str, list[dict]] = {}
    for m in _ADD_CONDITIONAL_STATE_ARGS_RE.finditer(text):
        branch_var = m.group("branch")
        args = split_args(m.group("args"))
        if not args:
            continue
        target_var = args[0]
        if branch_var in conditional_branch_vars and target_var in state_vars:
            conditional_branches.setdefault(branch_var, []).append({
                "target_var": target_var,
                "condition": simplify_condition(args[1]) if len(args) > 1 else None,
            })

    transitions: list[dict] = []
    confidence = "static"

    random_state_entries: dict[str, list[dict]] = {}
    for branch_var, entries in random_branches.items():
        known_weights = [entry["weight"] for entry in entries if entry["weight"] is not None]
        total = sum(known_weights)
        random_state_entries[branch_var] = []
        for entry in entries:
            weight = entry["weight"]
            if weight is None:
                confidence = "partial"
            random_state_entries[branch_var].append({
                "to": state_vars[entry["target_var"]],
                "weight": weight,
                "weightExpression": entry["weight_expression"],
                "baseChance": round((weight / total) * 100, 1) if weight is not None and total > 0 else None,
                "repeat": entry["repeat"],
                "maxRepeats": entry["max_repeats"],
                "cooldown": entry["cooldown"],
            })

    states: list[dict] = []
    declarations: list[tuple[int, str, str]] = []
    declarations.extend((m.start(), m.group("var"), "move") for m in _MOVE_VAR_RE.finditer(text))
    declarations.extend((m.start(), m.group("var"), "move") for m in _MOVE_PROPERTY_RE.finditer(text))
    declarations.extend((m.start(), m.group("var"), "random") for m in _RANDOM_BRANCH_VAR_RE.finditer(text))
    declarations.extend((m.start(), m.group("var"), "conditional") for m in _CONDITIONAL_BRANCH_VAR_RE.finditer(text))
    seen_state_vars: set[str] = set()
    for _, state_var, state_kind in sorted(declarations):
        if state_var in seen_state_vars or state_var not in state_vars:
            continue
        seen_state_vars.add(state_var)
        if state_kind == "move":
            next_var = followups.get(state_var)
            states.append({
                "id": state_vars[state_var],
                "kind": "move",
                "next": state_vars.get(next_var) if next_var else None,
            })
        elif state_kind == "random":
            states.append({
                "id": state_vars[state_var],
                "kind": "random",
                "branches": random_state_entries.get(state_var, []),
            })
        else:
            states.append({
                "id": state_vars[state_var],
                "kind": "conditional",
                "branches": [
                    {
                        "to": state_vars[entry["target_var"]],
                        "condition": entry["condition"],
                    }
                    for entry in conditional_branches.get(state_var, [])
                ],
            })

    def random_targets(from_var: str | None, branch_var: str) -> list[tuple[str, float | None]]:
        nonlocal confidence
        entries = random_branches.get(branch_var, [])
        weighted = []
        for entry in entries:
            weight = entry["weight"]
            if from_var is not None and entry["target_var"] == from_var and (
                entry["repeat"] in {"cannot_repeat", "once"} or entry["cooldown"] > 0
            ):
                weight = 0.0
            if weight is None:
                confidence = "partial"
            weighted.append((entry, weight))

        known_weights = [weight for _, weight in weighted if weight is not None]
        total = sum(known_weights)
        targets: list[tuple[str, float | None]] = []
        for entry, weight in weighted:
            if weight == 0:
                continue
            chance = round((weight / total) * 100, 1) if weight is not None and total > 0 else None
            targets.append((entry["target_var"], chance))
        return targets

    def resolve_transitions(
        source_id: str,
        source_var: str | None,
        target_var: str,
        *,
        condition: str | None = None,
        chance: float | None = 100.0,
        visited: set[str] | None = None,
    ) -> None:
        """Flatten nested branch states while retaining every branch constraint."""
        visited = set(visited or ())
        if target_var in visited:
            return
        visited.add(target_var)

        if target_var in move_vars:
            is_conditional = condition is not None
            is_random = chance is None or chance < 100
            transition = {
                "from": source_id,
                "to": move_vars[target_var],
                "chance": chance if is_random else (None if is_conditional else 100.0),
                "kind": "conditional" if is_conditional else ("random" if is_random else "fixed"),
            }
            if condition is not None:
                transition["condition"] = condition
            transitions.append(transition)
            return

        if target_var in random_branches:
            for nested_target, nested_chance in random_targets(source_var, target_var):
                combined_chance = (
                    None
                    if chance is None or nested_chance is None
                    else round(chance * nested_chance / 100, 1)
                )
                resolve_transitions(
                    source_id,
                    source_var,
                    nested_target,
                    condition=condition,
                    chance=combined_chance,
                    visited=visited,
                )
            return

        if target_var in conditional_branches:
            for entry in conditional_branches[target_var]:
                nested_condition = entry["condition"]
                combined_condition = (
                    f"({condition}) && ({nested_condition})"
                    if condition and nested_condition
                    else condition or nested_condition
                )
                resolve_transitions(
                    source_id,
                    source_var,
                    entry["target_var"],
                    condition=combined_condition,
                    chance=chance,
                    visited=visited,
                )

    for from_var, from_id in move_vars.items():
        target_var = followups.get(from_var)
        if target_var:
            resolve_transitions(from_id, from_var, target_var)

    if initial_variants and (
        len(initial_variants) > 1
        or initial_variants[0][1] is not None
        or initial_variants[0][0] not in move_vars
    ):
        for variant_var, condition in initial_variants:
            resolve_transitions("__START__", None, variant_var, condition=condition)

    if not states:
        return None
    return {
        "initial": initial,
        "confidence": confidence,
        "transitions": transitions,
        "states": states,
    }


def simplify_condition(condition: str | None) -> str | None:
    if not condition:
        return None
    return re.sub(r"\s+", " ", condition.replace("() =>", "").strip())


def method_body_by_name(text: str, method_name: str) -> str | None:
    m = re.search(rf"\b(?:private|protected|public)\s+(?:async\s+)?[\w<>\?\s]+\s+{re.escape(method_name)}\s*\(", text)
    if not m:
        return None
    open_paren = text.find("(", m.end() - 1)
    close_paren = _balanced_span(text, open_paren)
    if close_paren < 0:
        return None
    open_brace = text.find("{", close_paren)
    if open_brace < 0:
        return None
    depth = 0
    for i in range(open_brace, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return text[open_brace + 1 : i]
    return None


def numeric_value(expr: str, int_props: dict[str, dict]) -> dict | None:
    expr = expr.strip().strip("()")
    if expr in int_props:
        return int_props[expr]
    m = re.fullmatch(r"(?P<num>-?\d+(?:\.\d+)?)(?:m|f)?", expr)
    if m:
        value = float(m.group("num"))
        normalized = int(value) if value.is_integer() else value
        return {"normal": normalized, "ascension": None}
    return None


def normalize_lambda_expr(expr: str) -> str:
    expr = expr.strip()
    if expr.startswith("() =>"):
        return expr[5:].strip()
    return expr


def intent_value_key(expr: str, suffix: str) -> str:
    expr = normalize_lambda_expr(expr).strip()
    if expr.endswith(suffix):
        return expr[:-len(suffix)]
    return expr


def iter_intent_constructors(text: str):
    for match in _INTENT_START_RE.finditer(text):
        open_paren = text.find("(", match.start(), match.end())
        if open_paren < 0:
            continue
        close_paren = _balanced_span(text, open_paren)
        if close_paren < 0:
            continue
        yield match.group("kind"), text[open_paren + 1 : close_paren]


def parse_intent_detail(kind: str, args: list[str], int_props: dict[str, dict]) -> dict:
    detail: dict = {"type": kind}
    if not args:
        return detail

    first = normalize_lambda_expr(args[0])
    if kind in ("SingleAttackIntent", "MultiAttackIntent", "DeathBlowIntent", "AttackIntent"):
        detail["damage_key"] = intent_value_key(first, "Damage")
        if kind == "MultiAttackIntent" and len(args) > 1:
            repeat_expr = normalize_lambda_expr(args[1])
            repeat = numeric_value(repeat_expr, int_props)
            detail["repeat"] = repeat
            if repeat is None:
                detail["repeat_expression"] = repeat_expr
        else:
            detail["repeat"] = {"normal": 1, "ascension": None}
    elif kind == "DefendIntent":
        detail["block_key"] = intent_value_key(first, "Block")

    return detail


def power_id_from_class(class_name: str) -> str:
    cls = class_name[:-len("Power")] if class_name.endswith("Power") else class_name
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", cls).upper()


def card_id_from_class(class_name: str) -> str:
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", class_name).upper()


def classify_power_target(target_expr: str) -> str:
    target = target_expr.strip()
    if "GetOpponentsOf(base.Creature)" in target:
        return "player"
    if "base.Creature" in target:
        return "self"
    if target in {"target", "targets"} or "Player" in target:
        return "player"
    if "Teammates" in target or "teammate" in target:
        return "ally"
    if "Enemy" in target or "Enemies" in target:
        return "enemy"
    return "unknown"


def power_variable_types(body: str) -> dict[str, str]:
    out = {m.group("var"): m.group("class") for m in _POWER_VAR_DECL_RE.finditer(body)}
    out.update({m.group("var"): m.group("class") for m in _POWER_MODELDB_ASSIGN_RE.finditer(body)})
    return out


def parse_power_applications(body: str, int_props: dict[str, dict]) -> list[dict]:
    applications: list[dict] = []
    seen: set[tuple] = set()
    var_types = power_variable_types(body)

    def add(power_class: str, args_text: str, generic: bool) -> None:
        args = split_top_level_args(args_text)
        if len(args) < 3:
            return
        target_index = 1 if generic else 2
        amount_index = 2 if generic else 3
        if len(args) <= amount_index:
            return
        power_id = power_id_from_class(power_class)
        target = classify_power_target(args[target_index])
        amount = numeric_value(args[amount_index], int_props)
        key = (power_id, target, json.dumps(amount, sort_keys=True))
        if key in seen:
            return
        seen.add(key)
        applications.append({
            "power_id": power_id,
            "target": target,
            "amount": amount,
        })

    for m in _POWER_APPLY_GENERIC_RE.finditer(body):
        add(m.group("power"), m.group("args"), True)

    for m in _POWER_APPLY_DYNAMIC_RE.finditer(body):
        start = m.start()
        if start >= 1 and body[start - 1] == ">":
            continue
        args = split_top_level_args(m.group("args"))
        if len(args) < 4:
            continue
        power_class = var_types.get(args[1].strip())
        if power_class:
            add(power_class, m.group("args"), False)

    return applications


def parse_initial_power_applications(text: str) -> list[dict]:
    body = method_body_by_name(text, "AfterAddedToRoom")
    if not body:
        return []
    return parse_power_applications(body, parse_int_props(text))


def parse_card_applications(body: str, int_props: dict[str, dict]) -> list[dict]:
    applications: list[dict] = []
    seen: set[tuple] = set()

    for m in _CARD_ADD_RE.finditer(body):
        args = split_top_level_args(m.group("args"))
        if len(args) < 3:
            continue
        card_id = card_id_from_class(m.group("card"))
        amount = numeric_value(args[2], int_props)
        key = (card_id, json.dumps(amount, sort_keys=True))
        if key in seen:
            continue
        seen.add(key)
        applications.append({
            "card_id": card_id,
            "amount": amount,
        })

    return applications


def parse_moves_and_damage(text: str) -> tuple[list[str], dict, dict, dict]:
    """Return (ordered move ids, damage values, block values, per-move metadata)."""
    int_props = parse_int_props(text)
    move_ids: list[str] = []
    damage_values: dict[str, dict] = {}
    block_values: dict[str, dict] = {}
    move_metadata: dict[str, dict] = {}

    for m in _MOVESTATE_START_RE.finditer(text):
        move_id = m.group("id")
        stripped_move_id = strip_move_suffix(move_id)
        if move_id not in move_ids:
            move_ids.append(move_id)
        # Walk forward to the matching ')' of the MoveState constructor.
        # m.start() points at "new MoveState", so the '(' is between there and m.end().
        open_paren = text.find("(", m.start(), m.end())
        if open_paren < 0:
            continue
        close_paren = _balanced_span(text, open_paren)
        if close_paren < 0:
            continue
        body = text[open_paren + 1 : close_paren]
        constructor_args = split_top_level_args(body)
        method_name = constructor_args[1] if len(constructor_args) > 1 else None
        action_types: list[str] = []
        intents: list[str] = []
        intent_details: list[dict] = []
        for kind, args_text in iter_intent_constructors(body):
            intents.append(kind)
            action_type = INTENT_ACTION_TYPES.get(kind, "special")
            if action_type not in action_types:
                action_types.append(action_type)
            args = split_top_level_args(args_text)
            intent_details.append(parse_intent_detail(kind, args, int_props))
            if not args:
                continue
            first = args[0]
            # Attack intents carry a Damage identifier as the first arg.
            if kind in ("SingleAttackIntent", "MultiAttackIntent", "DeathBlowIntent", "AttackIntent"):
                prop = int_props.get(first)
                if prop is not None:
                    dmg_key = first[:-len("Damage")] if first.endswith("Damage") else first
                    damage_values.setdefault(dmg_key, prop)
            # Defend intents optionally carry a Block identifier.
            if kind == "DefendIntent" and first:
                prop = int_props.get(first)
                if prop is not None:
                    blk_key = first[:-len("Block")] if first.endswith("Block") else first
                    block_values.setdefault(blk_key, prop)
        method_body_text = method_body_by_name(text, method_name) if method_name else None
        power_applications: list[dict] = []
        card_applications: list[dict] = []
        if method_body_text:
            power_applications = parse_power_applications(method_body_text, int_props)
            card_applications = parse_card_applications(method_body_text, int_props)
            for block_match in _GAIN_BLOCK_RE.finditer(method_body_text):
                block_value = numeric_value(block_match.group("value"), int_props)
                if block_value is None:
                    continue
                block_key = block_match.group("value").strip()
                block_key = block_key[:-len("Block")] if block_key.endswith("Block") else stripped_move_id
                block_values.setdefault(block_key, block_value)
        move_metadata[stripped_move_id] = {
            "action_types": action_types,
            "intents": intents,
            "intent_details": intent_details,
            "power_applications": power_applications,
            "card_applications": card_applications,
        }
    return move_ids, damage_values, block_values, move_metadata


def build_entries(
    loc_kor_by_id: dict,
    loc_eng_by_id: dict,
    existing_kor: list,
    existing_eng: list,
    source_root: Path,
    move_graph_sample_ids: set[str] | None = None,
) -> tuple[list, list, list, list]:
    ids = sorted(set(loc_kor_by_id) | set(loc_eng_by_id))
    ids = [i for i in ids if not i.startswith(SKIP_PREFIXES)]
    ids = [i for i in ids if i not in SKIP_IDS]

    old_kor_by_id = {e["id"]: e for e in existing_kor}
    old_eng_by_id = {e["id"]: e for e in existing_eng}
    deprecated_ids = {
        e["id"]
        for e in existing_kor
        if e.get("deprecated") and not e["id"].startswith(SKIP_PREFIXES)
    }
    ids = sorted(set(ids) | deprecated_ids)

    kor_out, eng_out = [], []
    added, removed = [], []

    for ent_id in ids:
        deprecated_only = ent_id not in loc_kor_by_id and ent_id not in loc_eng_by_id
        cs = find_monster_class(source_root, ent_id)
        if cs is not None:
            text = cs.read_text()
            hp = parse_hp(text)
            move_ids, damage_values, block_values, move_metadata = parse_moves_and_damage(text)
            initial_power_applications = parse_initial_power_applications(text)
            show_in_compendium = parse_show_in_compendium(text)
            bestiary_move_ids = build_bestiary_move_ids(move_ids, text)
            move_graph = parse_move_graph(text)
            if move_graph_sample_ids is not None and ent_id not in move_graph_sample_ids:
                move_graph = old_kor_by_id.get(ent_id, {}).get("move_graph")
        else:
            hp = {"min_hp": None, "max_hp": None, "min_hp_ascension": None, "max_hp_ascension": None}
            move_ids, damage_values, block_values = [], {}, {}
            move_metadata = {}
            initial_power_applications = old_kor_by_id.get(ent_id, {}).get("initial_power_applications", [])
            show_in_compendium = old_kor_by_id.get(ent_id, {}).get("show_in_compendium", True)
            bestiary_move_ids = []
            move_graph = old_kor_by_id.get(ent_id, {}).get("move_graph")

        # If no class-derived moves, fall back to whatever the locale lists.
        locale_fallback_moves = None
        if not move_ids:
            locale_fallback_moves = list((loc_kor_by_id.get(ent_id, {}).get("moves") or {}).keys())

        for lang, loc_by_id, old_by_id, out in (
            ("kor", loc_kor_by_id, old_kor_by_id, kor_out),
            ("eng", loc_eng_by_id, old_eng_by_id, eng_out),
        ):
            lnode = loc_by_id.get(ent_id, {})
            old = old_by_id.get(ent_id, {})

            if deprecated_only and old.get("deprecated"):
                out.append(old)
                continue

            if move_ids:
                moves = []
                for mid in move_ids:
                    stripped = strip_move_suffix(mid)
                    metadata = move_metadata.get(stripped, {})
                    moves.append({
                        "id": stripped,
                        "name": resolve_move_title(lnode, mid) or stripped.replace("_", " ").title(),
                        "action_types": metadata.get("action_types", []),
                        "intents": metadata.get("intents", []),
                        "intent_details": metadata.get("intent_details", []),
                        "power_applications": metadata.get("power_applications", []),
                        "card_applications": metadata.get("card_applications", []),
                    })
                bestiary_moves = []
                generic_lnode = loc_by_id.get("GENERIC", {})
                for mid in bestiary_move_ids:
                    metadata = move_metadata.get(strip_move_suffix(mid), {})
                    bestiary_moves.append({
                        "id": mid,
                        "name": (
                            resolve_move_title(lnode, mid)
                            or resolve_move_title(generic_lnode, mid)
                            or mid.replace("_", " ").title()
                        ),
                        "action_types": metadata.get("action_types", []),
                        "intents": metadata.get("intents", []),
                        "intent_details": metadata.get("intent_details", []),
                        "power_applications": metadata.get("power_applications", []),
                        "card_applications": metadata.get("card_applications", []),
                    })
            elif locale_fallback_moves:
                moves = []
                for mid in locale_fallback_moves:
                    moves.append({
                        "id": mid,
                        "name": resolve_move_title(lnode, mid) or mid.replace("_", " ").title(),
                    })
                bestiary_moves = moves
            else:
                moves = old.get("moves") or []
                bestiary_moves = old.get("bestiary_moves") or moves
                if cs is None and not moves:
                    show_in_compendium = False

            entry = {
                "id": ent_id,
                "name": lnode.get("name") or old.get("name"),
            }
            for lifecycle_key in ("introducedInPatch", "deprecated", "deprecatedInPatch"):
                if old.get(lifecycle_key) is not None:
                    entry[lifecycle_key] = old[lifecycle_key]
            entry.update({
                "type": old.get("type") or "Normal",
                "show_in_compendium": show_in_compendium,
                **hp,
                "moves": moves,
                "bestiary_moves": bestiary_moves,
                "move_graph": move_graph,
                "damage_values": damage_values or old.get("damage_values"),
                "block_values": block_values or old.get("block_values"),
                "image_url": old.get("image_url"),
            })
            if initial_power_applications:
                entry["initial_power_applications"] = initial_power_applications
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


def merge_move_graph_samples(existing: list[dict], generated: list[dict], sample_ids: set[str]) -> list[dict]:
    generated_by_id = {entry["id"]: entry for entry in generated}
    return [
        {
            **entry,
            "move_graph": generated_by_id[entry["id"]].get("move_graph"),
        }
        if entry["id"] in sample_ids and entry["id"] in generated_by_id
        else entry
        for entry in existing
    ]


def main() -> int:
    ap = argparse.ArgumentParser(description="Parse monsters from PCK + DLL source.")
    ap.add_argument("--pck", default=default_pck_path())
    ap.add_argument("--source", default=str(DEFAULT_SOURCE))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--move-graph-samples",
        help="Comma-separated monster IDs whose move graphs should be refreshed; other graphs stay unchanged.",
    )
    args = ap.parse_args()

    source = Path(args.source)
    if not source.exists():
        print(f"ERROR: decompiled source not found at {source}", file=sys.stderr)
        return 1

    reader = PCKReader(args.pck)
    try:
        loc_kor = group_loc_by_id(reader.read_json("localization/kor/monsters.json"))
        loc_eng = group_loc_by_id(reader.read_json("localization/eng/monsters.json"))
    finally:
        reader.close()

    existing_kor = json.loads((DATA_DIR / "kor/monsters.json").read_text() or "[]")
    existing_eng = json.loads((DATA_DIR / "eng/monsters.json").read_text() or "[]")

    move_graph_sample_ids = (
        {value.strip().upper() for value in args.move_graph_samples.split(",") if value.strip()}
        if args.move_graph_samples
        else None
    )
    kor_out, eng_out, added, removed = build_entries(
        loc_kor,
        loc_eng,
        existing_kor,
        existing_eng,
        source,
        move_graph_sample_ids,
    )
    if move_graph_sample_ids is not None:
        kor_out = merge_move_graph_samples(existing_kor, kor_out, move_graph_sample_ids)
        eng_out = merge_move_graph_samples(existing_eng, eng_out, move_graph_sample_ids)

    print(f"Monsters: {len(kor_out)} entries")
    if added:
        print(f"  + Added ({len(added)}): {', '.join(added)}")
    if removed:
        print(f"  - Removed ({len(removed)}): {', '.join(removed)}")

    if args.dry_run:
        print("(dry-run: no files written)")
        return 0

    write_json(DATA_DIR / "kor/monsters.json", kor_out)
    write_json(DATA_DIR / "eng/monsters.json", eng_out)
    print(f"Wrote {DATA_DIR / 'kor/monsters.json'}")
    print(f"Wrote {DATA_DIR / 'eng/monsters.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
