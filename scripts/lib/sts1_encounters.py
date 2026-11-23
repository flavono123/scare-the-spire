"""STS1 encounters: which monsters each MonsterHelper encounter key spawns, where it
is listed, and what the game calls it.

Compositions come from running MonsterHelper.getEncounter(key) (and the private
static helpers it calls) through a tiny path-forking interpreter: random rolls
stay unknown, `ArrayList.get(random)` becomes a symbolic pick from that list,
and branches on unknowns fork. Act lists come from the dungeon classes'
MonsterInfo lists and boss lists; names from MonsterHelper.getEncounterName.
"""

from __future__ import annotations

import copy
import itertools
import json
import math
import re
from dataclasses import dataclass, field
from fractions import Fraction
from pathlib import Path
from typing import Any, Callable

from scripts.lib.java_classfile import JavaClass, parse_class_file
from scripts.lib.jvm_eval import decode, java_string_hash, parse_descriptor
from scripts.lib.sts1_monster_moves import class_ids

ROOT = Path(__file__).resolve().parents[2]
HELPER = "com.megacrit.cardcrawl.helpers.MonsterHelper"
MONSTER_PREFIX = "com.megacrit.cardcrawl.monsters."
EVENT_PREFIX = "com.megacrit.cardcrawl.events."
DUNGEONS = (
    ("exordium", "com.megacrit.cardcrawl.dungeons.Exordium"),
    ("city", "com.megacrit.cardcrawl.dungeons.TheCity"),
    ("beyond", "com.megacrit.cardcrawl.dungeons.TheBeyond"),
    ("ending", "com.megacrit.cardcrawl.dungeons.TheEnding"),
)
POOLS = (
    ("weak", "generateWeakEnemies"),
    ("strong", "generateStrongEnemies"),
    ("elite", "generateElites"),
    ("boss", "initializeBoss"),
)
POOL_ORDER = [name for name, _ in POOLS] + ["event"]


class _Unknown:
    def __deepcopy__(self, memo: Any) -> "_Unknown":
        return self

    def __repr__(self) -> str:
        return "?"


UNKNOWN = _Unknown()


@dataclass(frozen=True)
class Mon:
    cls: str


@dataclass(frozen=True)
class Pick:
    """One draw from list `uid`; `mapped` turns a drawn item into a monster."""

    uid: int
    mapped: tuple[tuple[Any, Any], ...] | None = None


@dataclass(frozen=True)
class StaticRef:
    owner: str
    name: str


@dataclass(frozen=True)
class ElemRef:
    owner: str
    name: str
    index: int


@dataclass
class Arr:
    items: list[Any]


@dataclass
class AList:
    uid: int
    items: list[Any] = field(default_factory=list)


@dataclass
class Group:
    slots: list[Any] | None = None


@dataclass
class State:
    pc: int
    stack: list[Any]
    local: dict[int, Any]
    pending: Pick | None = None  # a pick just compared with String.equals


class Interpreter:
    """Runs MonsterHelper's static methods, forking on unknown branches."""

    def __init__(self, cls: JavaClass, ids: dict[str, str]):
        self.cls = cls
        self.ids = ids
        self.monster_classes = {name for name in ids if name.startswith(MONSTER_PREFIX)}
        self.uids = itertools.count(1)
        self.pools: dict[int, list[Any]] = {}  # list uid -> items at its first draw
        self.removed: set[int] = set()
        self.problems: list[str] = []

    def call(self, name: str, desc: str, args: list[Any], depth: int = 0) -> list[Any]:
        """Distinct return values over every path."""
        method = self.cls.method(name, desc)
        if method is None or not method.code or depth > 8:
            return [UNKNOWN]
        insns = decode(method.code)
        local: dict[int, Any] = {}
        slot = 0
        for kind, value in zip(parse_descriptor(desc)[0], args):
            local[slot] = value
            slot += 2 if kind in {"J", "D"} else 1
        results: list[Any] = []
        pending = [State(0, [], local)]
        steps = 0
        while pending:
            state = pending.pop()
            while True:
                steps += 1
                if steps > 200000:
                    raise RuntimeError(f"{name}{desc}: step budget exceeded")
                outcome = self._step(state, insns[state.pc], depth)
                if outcome is None:
                    continue
                kind, payload = outcome
                if kind == "return":
                    if payload not in results:
                        results.append(payload)
                    break
                if kind == "stop":
                    break
                # "fork": payload is a list of successor states; run the first here.
                state = payload[0]
                pending.extend(payload[1:])
        return results

    def _fork(self, state: State, variants: list[tuple[int, list[Any]]]) -> tuple[str, list[State]]:
        """One state per (pc, values to push); shares nothing mutable."""
        out = []
        for pc, push in variants:
            stack, local = copy.deepcopy((state.stack, state.local))
            out.append(State(pc, stack + push, local, state.pending))
        return "fork", out

    def _step(self, state: State, insn: Any, depth: int) -> tuple[str, Any] | None:
        op, stack, cls = insn.op, state.stack, self.cls
        state.pc = insn.next
        if op == 0 or op == 192:  # nop, checkcast
            return None
        if op == 1:
            stack.append(None)
        elif 2 <= op <= 8:
            stack.append(op - 3)
        elif 11 <= op <= 13:
            stack.append(float(op - 11))
        elif op in {16, 17}:
            stack.append(insn.operand)
        elif op in {18, 19}:
            stack.append(cls.ldc_value(insn.operand))
        elif 21 <= op <= 25:
            stack.append(state.local.get(insn.operand, UNKNOWN))
        elif 26 <= op <= 45:
            stack.append(state.local.get((op - 26) % 4, UNKNOWN))
        elif 46 <= op <= 53:
            index, array = stack.pop(), stack.pop()
            if isinstance(array, Arr) and isinstance(index, int):
                stack.append(array.items[index])
            elif isinstance(array, StaticRef) and isinstance(index, int):
                stack.append(ElemRef(array.owner, array.name, index))
            else:
                stack.append(UNKNOWN)
        elif 54 <= op <= 58:
            state.local[insn.operand] = stack.pop()
        elif 59 <= op <= 78:
            state.local[(op - 59) % 4] = stack.pop()
        elif 79 <= op <= 86:
            value, index, array = stack.pop(), stack.pop(), stack.pop()
            if isinstance(array, Arr) and isinstance(index, int):
                array.items[index] = value
        elif op == 87:
            stack.pop()
        elif op == 89:
            stack.append(stack[-1])
        elif 96 <= op <= 115:
            right, left = stack.pop(), stack.pop()
            known = all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in (left, right))
            kind = (op - 96) // 4
            if not known or (kind >= 3 and right == 0):
                stack.append(UNKNOWN)
            else:
                stack.append([left + right, left - right, left * right, left / right, math.fmod(left, right)][kind])
        elif 148 <= op <= 152:
            right, left = stack.pop(), stack.pop()
            stack.append((left > right) - (left < right) if isinstance(left, (int, float)) and isinstance(right, (int, float)) else UNKNOWN)
        elif 153 <= op <= 158:
            value = stack.pop()
            if isinstance(value, (int, float)):
                taken = [value == 0, value != 0, value < 0, value >= 0, value > 0, value <= 0][op - 153]
                state.pc = insn.operand if taken else insn.next
            else:
                return self._fork(state, [(insn.operand, []), (insn.next, [])])
        elif 159 <= op <= 164:
            right, left = stack.pop(), stack.pop()
            if isinstance(left, (int, float)) and isinstance(right, (int, float)):
                taken = [left == right, left != right, left < right, left >= right, left > right, left <= right][op - 159]
                state.pc = insn.operand if taken else insn.next
            else:
                return self._fork(state, [(insn.operand, []), (insn.next, [])])
        elif op in {198, 199}:  # ifnull / ifnonnull
            value = stack.pop()
            if value is UNKNOWN:
                return self._fork(state, [(insn.operand, []), (insn.next, [])])
            state.pc = insn.operand if (value is None) == (op == 198) else insn.next
        elif op == 167:
            state.pc = insn.operand
        elif op in {170, 171}:
            key = stack.pop()
            default, targets = insn.operand
            if isinstance(key, int):
                state.pc = targets.get(key, default)
            else:
                unique = list(dict.fromkeys([*targets.values(), default]))
                return self._fork(state, [(target, []) for target in unique])
        elif op == 176:
            return "return", stack.pop()
        elif op in {172, 173, 174, 175}:
            return "return", UNKNOWN
        elif op == 177:
            return "return", None
        elif op == 191:
            return "stop", None
        elif op == 178:
            owner, name, _desc = cls.fieldref(insn.operand)
            stack.append(StaticRef(owner, name))
        elif op == 179:
            stack.pop()
        elif op == 187:
            name = cls.class_name(insn.operand)
            if name in self.monster_classes and state.pending is not None:
                # `if (drawn.equals("SpikeSlime_S")) new SpikeSlime_S else new AcidSlime_S`:
                # the monster built under that test is the draw itself.
                pick, state.pending = state.pending, None
                if not any(item == self.ids.get(name) for item in self.pools.get(pick.uid, [])):
                    self.problems.append(f"{name} built under a test on a pick that cannot hold it")
                stack.append(pick)
            elif name in self.monster_classes:
                stack.append(Mon(name))
            elif name == "java.util.ArrayList":
                stack.append(AList(next(self.uids)))
            elif name == "com.megacrit.cardcrawl.monsters.MonsterGroup":
                stack.append(Group())
            else:
                stack.append(UNKNOWN)
        elif op == 189:
            count = stack.pop()
            stack.append(Arr([None] * count) if isinstance(count, int) else UNKNOWN)
        elif op in {182, 183, 184, 185}:
            owner, name, desc = cls.methodref(insn.operand)
            arg_types, ret = parse_descriptor(desc)
            args = [stack.pop() for _ in arg_types][::-1]
            target = stack.pop() if op != 184 else None
            if op == 184 and owner == HELPER:
                results = self._call_helper(name, desc, args, depth)
            else:
                results = self._invoke(state, owner, name, target, args)
            if ret == "V":
                return None
            if len(results) == 1:
                stack.append(results[0])
            else:
                return self._fork(state, [(state.pc, [value]) for value in results])
        else:
            raise RuntimeError(f"unsupported opcode {op} at {insn.offset}")
        return None

    def _call_helper(self, name: str, desc: str, args: list[Any], depth: int) -> list[Any]:
        picks = [arg for arg in args if isinstance(arg, Pick)]
        if picks:
            # getGremlin(drawn, x, y): map the helper over what the draw can hold.
            pick = picks[0]
            mapped = []
            for item in self.pools[pick.uid]:
                concrete = [item if arg is pick else arg for arg in args]
                result = self.call(name, desc, concrete, depth + 1)
                if len(result) != 1:
                    self.problems.append(f"{name} on a pick item gave {len(result)} results")
                mapped.append((item, result[0]))
            return [Pick(pick.uid, tuple(mapped))]
        results = self.call(name, desc, args, depth + 1)
        if len(results) > 1 and all(isinstance(value, (Mon, Pick)) for value in results):
            # getLouse(): a 50/50 monster is a draw from a two-item list.
            uid = next(self.uids)
            self.pools[uid] = results
            return [Pick(uid)]
        return results

    def _invoke(self, state: State, owner: str, name: str, target: Any, args: list[Any]) -> list[Any]:
        if isinstance(target, str):
            if name == "hashCode":
                return [java_string_hash(target)]
            if name == "equals":
                return [int(target == args[0])] if isinstance(args[0], str) else [UNKNOWN]
        if isinstance(target, Pick) and name == "equals":
            state.pending = target
            return [UNKNOWN]
        if isinstance(target, AList):
            if name == "add":
                target.items.append(args[0])
                return [1]
            if name == "size":
                return [len(target.items)]
            if name == "get":
                if isinstance(args[0], int):
                    return [target.items[args[0]]]
                self.pools.setdefault(target.uid, list(target.items))
                return [Pick(target.uid)]
            if name == "remove":
                self.removed.add(target.uid)
                if target.items:
                    target.items.pop()
                return [UNKNOWN]
        if isinstance(target, Group) and name == "<init>":
            target.slots = list(args[0].items) if isinstance(args[0], Arr) else list(args)
        return [UNKNOWN]


def _slug(key: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", key.lower()).strip("-")


def _string_switch_keys(cls: JavaClass, method_name: str) -> list[str]:
    """Strings a method compares its argument with (`key.equals("...")`), in order."""
    method = cls.method(method_name)
    insns = decode(method.code)
    keys: list[str] = []
    offsets = sorted(insns)
    for prev, here in zip(offsets, offsets[1:]):
        a, b = insns[prev], insns[here]
        if a.op in {18, 19} and b.op == 182 and cls.methodref(b.operand)[1] == "equals":
            value = cls.ldc_value(a.operand)
            if isinstance(value, str) and value not in keys:
                keys.append(value)
    return keys


def _code_strings(cls: JavaClass, method_name: str | None = None) -> list[str]:
    out: list[str] = []
    for method in cls.methods:
        if not method.code or (method_name and method.name != method_name):
            continue
        for insn in decode(method.code).values():
            if insn.op in {18, 19}:
                value = cls.ldc_value(insn.operand)
                if isinstance(value, str):
                    out.append(value)
    return out


def _monster_infos(cls: JavaClass, method_name: str) -> list[tuple[str, float | None]]:
    """`new MonsterInfo("key", weight)` calls, in order; or listed keys for a boss list."""
    method = cls.method(method_name)
    if method is None or not method.code:
        return []
    insns = decode(method.code)
    out: list[tuple[str, float | None]] = []
    last_string: str | None = None
    last_float: float | None = None
    for offset in sorted(insns):
        insn = insns[offset]
        if insn.op in {18, 19}:
            value = cls.ldc_value(insn.operand)
            if isinstance(value, str):
                last_string, last_float = value, None
            elif isinstance(value, float):
                last_float = value
        elif 11 <= insn.op <= 13:
            last_float = float(insn.op - 11)
        elif insn.op == 183:
            owner, name, _desc = cls.methodref(insn.operand)
            if owner.endswith(".MonsterInfo") and name == "<init>" and last_string is not None:
                out.append((last_string, last_float))
    return out


def _direct_list_keys(cls: JavaClass, method_name: str, list_field: str) -> list[str]:
    """`AbstractDungeon.<list_field>.add("key")` calls (TheEnding fills its lists without MonsterInfo)."""
    method = cls.method(method_name)
    if method is None or not method.code:
        return []
    insns = decode(method.code)
    offsets = sorted(insns)
    out = []
    for prev, here in zip(offsets, offsets[1:]):
        a, b = insns[prev], insns[here]
        if a.op == 178 and cls.fieldref(a.operand)[1] == list_field and b.op in {18, 19}:
            out.append(cls.ldc_value(b.operand))
    return out


def _weighted(items: list[Any], resolve: Callable[[Any], dict[str, Fraction]]) -> list[dict[str, Any]]:
    """A list's items as integer copy counts per monster id (nested draws split by weight)."""
    totals: dict[str, Fraction] = {}
    for item in items:
        for monster, share in resolve(item).items():
            totals[monster] = totals.get(monster, Fraction(0)) + share
    scale = math.lcm(*(share.denominator for share in totals.values()))
    return [{"id": monster, "count": int(share * scale)} for monster, share in totals.items()]


class _Resolver:
    def __init__(self, interp: Interpreter, ids: dict[str, str], known: set[str], missing: set[str]):
        self.interp, self.ids, self.known, self.missing = interp, ids, known, missing

    def monster(self, value: Any) -> str | None:
        """A monster class (or the id string a pool holds) as a known game id."""
        monster = self.ids.get(value.cls) if isinstance(value, Mon) else value if isinstance(value, str) else None
        if monster is None or monster not in self.known:
            self.missing.add(value.cls if isinstance(value, Mon) else str(value))
            return None
        return monster

    def distribution(self, value: Any) -> dict[str, Fraction]:
        if isinstance(value, Pick):
            items = [dict(value.mapped)[item] if value.mapped else item for item in self.interp.pools[value.uid]]
            out: dict[str, Fraction] = {}
            for item in items:
                for monster, share in self.distribution(item).items():
                    out[monster] = out.get(monster, Fraction(0)) + share / len(items)
            return out
        monster = self.monster(value)
        return {monster: Fraction(1)} if monster else {}

    def composition(self, slots: list[Any]) -> dict[str, Any]:
        monsters: dict[str, int] = {}
        draws: dict[int, list[Pick]] = {}
        for slot in slots:
            if isinstance(slot, Pick):
                draws.setdefault(slot.uid, []).append(slot)
            elif (monster := self.monster(slot)) is not None:
                monsters[monster] = monsters.get(monster, 0) + 1
        choices: list[tuple[dict[str, Any], bool]] = []
        for uid, picks in draws.items():
            pick = picks[0]
            items = [dict(pick.mapped)[item] if pick.mapped else item for item in self.interp.pools[uid]]
            pool = _weighted(items, self.distribution)
            replace = uid not in self.interp.removed
            same = next((c for c, r in choices if r and replace and c["from"] == pool), None)
            if same is not None:  # two Louse: independent draws from equal lists
                same["pick"] += len(picks)
            elif not replace and len(picks) == sum(entry["count"] for entry in pool):
                for entry in pool:  # drawing the whole pool is a fixed set
                    monsters[entry["id"]] = monsters.get(entry["id"], 0) + entry["count"]
            else:
                choices.append(({"pick": len(picks), "from": pool}, replace))
        for choice, replace in choices:
            if replace and choice["pick"] > 1:
                choice["independent"] = True
        out: dict[str, Any] = {"monsters": [{"id": monster, "count": count} for monster, count in monsters.items()]}
        if choices:
            out["choices"] = [choice for choice, _replace in choices]
        return out


def _class_name_source(jar, class_name: str) -> tuple[str, str] | None:
    """`NAME = languagePack.getMonsterStrings("Id").NAME` -> ("monsters.json", "Id")."""
    cls = parse_class_file(jar.read(class_name.replace(".", "/") + ".class"))
    method = cls.method("<clinit>")
    insns = decode(method.code)
    offsets = sorted(insns)
    tables = {"getMonsterStrings": "monsters.json", "getEventString": "events.json"}
    for prev, here in zip(offsets, offsets[1:]):
        a, b = insns[prev], insns[here]
        if b.op == 182 and cls.methodref(b.operand)[1] in tables:
            if a.op in {18, 19}:
                key = cls.ldc_value(a.operand)
            elif a.op == 178:
                key = next((f.const_value for f in cls.fields if f.name == cls.fieldref(a.operand)[1]), None)
            else:
                key = None
            if isinstance(key, str):
                return tables[cls.methodref(b.operand)[1]], key
    return None


def _ui_table_of(cls: JavaClass, field_name: str) -> str | None:
    """`uiStrings = getUIString("Table")` feeding the array field (MIXED_COMBAT_NAMES)."""
    strings = [s for s in _code_strings(cls, "<clinit>")]
    return strings[-1] if strings and any(f.name == field_name for f in cls.fields) else None


def _load(jar, locale: str, name: str) -> dict[str, Any]:
    try:
        return json.loads(jar.read(f"localization/{locale}/{name}").decode("utf-8"))
    except KeyError:
        return json.loads(jar.read(f"localization/eng/{name}").decode("utf-8"))


def extract_encounters(jar, locales: list[str], write_json: Callable[[Path, Any], None]) -> dict[str, Any]:
    helper = parse_class_file(jar.read(HELPER.replace(".", "/") + ".class"))
    ids = class_ids(jar)
    known = {row["id"] for row in json.loads((ROOT / "data" / "sts1" / "monsters.json").read_text(encoding="utf-8"))}
    interp = Interpreter(helper, ids)
    missing: set[str] = set()
    resolver = _Resolver(interp, ids, known, missing)

    keys = _string_switch_keys(helper, "getEncounter")
    listings: dict[str, list[tuple[str, str, int, float | None]]] = {key: [] for key in keys}
    for dungeon, class_name in DUNGEONS:
        cls = parse_class_file(jar.read(class_name.replace(".", "/") + ".class"))
        for pool, method_name in POOLS:
            if pool == "boss":
                entries = [(s, None) for s in dict.fromkeys(_code_strings(cls, method_name)) if s in listings]
            else:
                entries = _monster_infos(cls, method_name)
            if not entries and pool == "elite":
                entries = [(key, None) for key in dict.fromkeys(_direct_list_keys(cls, "generateMonsters", "eliteMonsterList"))]
            for position, (key, weight) in enumerate(entries):
                if key not in listings:
                    raise SystemExit(f"{class_name}.{method_name} lists unknown encounter {key!r}")
                listings[key].append((dungeon, pool, position, weight))
    event_users: dict[str, list[str]] = {}
    for name in jar.namelist():
        if not name.startswith(EVENT_PREFIX.replace(".", "/")) or not name.endswith(".class"):
            continue
        cls = parse_class_file(jar.read(name))
        calls = any(entry and entry[0] == "methodref" and cls.methodref(index)[:2] == (HELPER, "getEncounter")
                    for index, entry in enumerate(cls.cp))
        if calls and not cls.name.rsplit(".", 1)[-1].startswith("Abstract"):  # AbstractEvent only serves Colosseum
            for key in dict.fromkeys(_code_strings(cls)):
                if key in listings:
                    event_users.setdefault(key, []).append(cls.name.rsplit(".", 1)[-1])

    rows = []
    for index, key in enumerate(keys):
        groups = [g for g in interp.call("getEncounter", "(Ljava/lang/String;)Lcom/megacrit/cardcrawl/monsters/MonsterGroup;", [key]) if isinstance(g, Group)]
        if len(groups) > 1 and len({len(g.slots) for g in groups}) == 1:
            differ = [i for i in range(len(groups[0].slots)) if len({repr(g.slots[i]) for g in groups}) > 1]
            if len(differ) == 1:  # Large Slime: one slot that is either of two monsters
                uid = next(interp.uids)
                interp.pools[uid] = [g.slots[differ[0]] for g in groups]
                slots = list(groups[0].slots)
                slots[differ[0]] = Pick(uid)
                groups = [Group(slots)]
        listed = listings[key]
        row: dict[str, Any] = {
            "key": key,
            "slug": _slug(key),
            "dungeons": list(dict.fromkeys(d for d, _p, _i, _w in listed)),
            "pools": list(dict.fromkeys([p for _d, p, _i, _w in listed] + (["event"] if key in event_users else []))),
        }
        weights = {f"{d}:{p}": w for d, p, _i, w in listed if w is not None}
        if weights:
            row["weights"] = weights
        if key in event_users:
            row["events"] = event_users[key]
        if len(groups) == 1:
            row.update(resolver.composition(groups[0].slots))
        else:
            row["monsters"] = []
            row["variants"] = [resolver.composition(g.slots) for g in groups]
        dungeon_index = {d: i for i, (d, _c) in enumerate(DUNGEONS)}
        sort = min(((dungeon_index[d], POOL_ORDER.index(p), i) for d, p, i, _w in listed), default=(len(DUNGEONS), POOL_ORDER.index("event") if key in event_users else len(POOL_ORDER), index))
        rows.append((sort, row))
    rows.sort(key=lambda pair: pair[0])
    encounters = [row for _sort, row in rows]

    if interp.problems:
        raise SystemExit("encounter decoding problems: " + "; ".join(interp.problems))
    slugs = [row["slug"] for row in encounters]
    if len(set(slugs)) != len(slugs):
        raise SystemExit("duplicate encounter slugs")
    write_json(
        ROOT / "data" / "sts1" / "encounters.json",
        {
            "source": "MonsterHelper.getEncounter (+ private spawn helpers) for compositions; Exordium/TheCity/TheBeyond/TheEnding "
            "generateWeakEnemies/generateStrongEnemies/generateElites MonsterInfo lists and initializeBoss for listings; "
            "event classes calling getEncounter; MonsterHelper.getEncounterName for names",
            "encounters": encounters,
        },
    )

    # Names: getEncounterName(key) returns MIXED_COMBAT_NAMES[i] (a ui.json table) or SomeMonster.NAME.
    name_refs = {}
    unnamed = []
    for key in keys:
        result = interp.call("getEncounterName", "(Ljava/lang/String;)Ljava/lang/String;", [key])
        ref = result[0] if len(result) == 1 else None
        if isinstance(ref, ElemRef) or (isinstance(ref, StaticRef) and ref.name == "NAME"):
            name_refs[key] = ref
        else:
            unnamed.append(key)
    sources = {ref.owner: _class_name_source(jar, ref.owner) for ref in name_refs.values() if isinstance(ref, StaticRef)}
    ui_table = _ui_table_of(helper, "MIXED_COMBAT_NAMES")
    for locale in locales:
        tables: dict[str, dict[str, Any]] = {}
        names: dict[str, str] = {}
        for key, ref in name_refs.items():
            if isinstance(ref, ElemRef):
                ui = tables.setdefault("ui.json", _load(jar, locale, "ui.json"))
                text = ((ui.get(ui_table) or {}).get("TEXT") or [])
                value = text[ref.index] if ref.index < len(text) else None
            else:
                table, entry = sources[ref.owner]
                value = (tables.setdefault(table, _load(jar, locale, table)).get(entry) or {}).get("NAME")
            if value:
                names[key] = value
        write_json(ROOT / "data" / "sts1" / "localization" / locale / "encounters.json", names)
    return {"count": len(encounters), "missing_monsters": sorted(missing), "unnamed": unnamed}
