"""STS1 monster moves read from the game's own methods.

For each ascension level the constructor runs for real, so damage, block and
power amounts come out the way the game sets them. `setMove` calls are found
by exploring every branch of the monster's methods; each move's effects come
from `takeTurn` run with that move queued.
"""

from __future__ import annotations

from typing import Any

from scripts.lib.java_classfile import JavaClass, parse_class_file
from scripts.lib.jvm_eval import (
    OPAQUE,
    VOID,
    Elem,
    Frame,
    ListObj,
    Machine,
    Obj,
    Range,
    Static,
    Tainted,
    Wide,
    switch_maps_from,
    untaint,
)

ASCENSION_LEVELS = range(0, 21)
ABSTRACT_MONSTER = "com.megacrit.cardcrawl.monsters.AbstractMonster"
ABSTRACT_DUNGEON = "com.megacrit.cardcrawl.dungeons.AbstractDungeon"
INTENT_ENUM = "com.megacrit.cardcrawl.monsters.AbstractMonster$Intent"
SWITCH_CLASS = "com/megacrit/cardcrawl/monsters/AbstractMonster$1.class"
CARD_PACKAGE = "com.megacrit.cardcrawl.cards."
POWER_PACKAGE = "com.megacrit.cardcrawl.powers."
MONSTER_PACKAGE = "com.megacrit.cardcrawl.monsters."
ACTION_QUEUE_METHODS = {"addToBottom", "addToTop", "addToBot"}
# Sprite motions the game applies to the whole monster, not to its skeleton.
MOTION_ACTIONS = {
    "AnimateFastAttackAction": "fast-attack",
    "AnimateSlowAttackAction": "slow-attack",
    "AnimateHopAction": "hop",
    "AnimateJumpAction": "jump",
    "AnimateShakeAction": "shake",
}
CARD_PILES = {
    "MakeTempCardInDiscardAction": "discard",
    "MakeTempCardInDrawPileAction": "draw",
    "MakeTempCardInHandAction": "hand",
    "MakeTempCardInDiscardAndDeckAction": "discard-and-deck",
}


def _plain(value: Any) -> Any:
    value = untaint(value)
    if isinstance(value, Wide):
        value = value.value
    if isinstance(value, Range):
        return {"min": value.low, "max": value.high}
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value if isinstance(value, (int, float, str)) else None


class _Recorder:
    """Collects what a run queues, animates and sets as the next move."""

    def __init__(self) -> None:
        self.actions: list[Obj] = []
        self.animations: list[str] = []
        self.moves: list[dict[str, Any]] = []

    def hook(self, frame: Frame, owner: str, name: str, desc: str, target: Any, args: list[Any]) -> Any:
        if name == "<init>" and owner.endswith(".DamageInfo") and isinstance(target, Obj) and len(args) >= 2:
            target.fields["base"] = args[1]
            target.fields["output"] = args[1]
            return NotImplemented
        if name in ACTION_QUEUE_METHODS and args and isinstance(args[-1], Obj):
            self.actions.append(args[-1])
            return VOID
        if name == "setAnimation" and owner.endswith("AnimationState") and len(args) >= 2 and isinstance(args[1], str):
            self.animations.append(args[1])
            return OPAQUE
        if name == "setMove" and target is frame.this:
            self.moves.append(_set_move_call(desc, args))
            return VOID
        if name in {"loadAnimation", "setHp", "createIntent", "rollMove", "init", "showHealthBar"} and target is frame.this:
            return VOID
        if name == "random" and desc in {"(II)I", "(II)F"} and all(isinstance(untaint(arg), int) for arg in args):
            low, high = (untaint(arg) for arg in args)
            return Range(low, high) if low != high else low
        return NotImplemented

    def set_move_actions(self) -> list[dict[str, Any]]:
        calls = []
        for action in self.actions:
            if action.simple_name == "SetMoveAction" and action.args:
                values = list(action.args[1:])
                named = values and (isinstance(values[0], (str, Elem)) or values[0] is None and len(values) > 2 and isinstance(values[2], Static))
                desc = "(Ljava/lang/String;" if named else "("
                calls.append(_set_move_call(desc, values))
        return calls


def _set_move_call(desc: str, args: list[Any]) -> dict[str, Any]:
    values = list(args)
    name = values.pop(0) if desc.startswith("(Ljava/lang/String;") else None
    move_id, intent = values[0], values[1]
    damage = values[2] if len(values) > 2 else None
    multiplier = values[3] if len(values) > 3 else None
    is_multi = values[4] if len(values) > 4 else False
    return {
        "id": _plain(move_id),
        "nameIndex": name.index if isinstance(name, Elem) and name.array == "MOVES" else None,
        "intent": intent.name if isinstance(intent, Static) and intent.owner == INTENT_ENUM else None,
        "damage": _plain(damage) if damage is not None else None,
        "multiplier": _plain(multiplier) if _plain(is_multi) else None,
    }


class MonsterReader:
    def __init__(self, jar: Any, class_path: str, *, switch_maps: dict[str, dict[str, int]], class_ids: dict[str, str]):
        self.jar = jar
        self.cls: JavaClass = parse_class_file(jar.read(class_path))
        self.switch_maps = switch_maps
        self.class_ids = class_ids

    def _static_aliases(self) -> dict[tuple[str, str], Any]:
        """Static fields <clinit> sets to a `MOVES[i]` entry."""
        if not hasattr(self, "_aliases"):
            machine = Machine(self.cls, invoke_hook=lambda *_args: NotImplemented)
            clinit = self.cls.method("<clinit>")
            if clinit and clinit.code:
                machine.run(clinit, Obj(self.cls.name))
            self._aliases = dict(machine.statics)
        return self._aliases

    def _machine(self, ascension: int, recorder: _Recorder) -> Machine:
        return Machine(
            self.cls,
            statics={**self._static_aliases(), (ABSTRACT_DUNGEON, "ascensionLevel"): ascension},
            switch_maps=self.switch_maps,
            invoke_hook=recorder.hook,
        )

    def _constructed(self, ascension: int) -> Obj:
        this = Obj(self.cls.name, fields={"damage": ListObj(), "state": Static("spine", "state")})
        constructors = [m for m in self.cls.methods if m.name == "<init>" and m.code]
        constructor = min(constructors, key=lambda method: len(method.descriptor))
        machine = self._machine(ascension, _Recorder())
        machine.run(constructor, this, [0.0, 0.0])
        return this

    def _tainted_state(self, this: Obj) -> Obj:
        """Own scalar fields stay readable as arguments but never decide a branch."""
        scalar = {field.name for field in self.cls.fields if field.descriptor in {"I", "Z", "B", "F", "S"}}
        fields = {
            name: Tainted(value) if name in scalar and not isinstance(value, Tainted) else value
            for name, value in this.fields.items()
        }
        for name in scalar - fields.keys():
            fields[name] = Tainted(0)
        fields["nextMove"] = Tainted(0)
        return Obj(this.cls, fields=fields)

    def move_calls(self, ascension: int) -> list[dict[str, Any]]:
        this = self._constructed(ascension)
        recorder = _Recorder()
        machine = self._machine(ascension, recorder)
        explored = self._tainted_state(this)
        for method in self.cls.methods:
            if method.name in {"<init>", "<clinit>"} or not method.code:
                continue
            refs = self._method_refs(method)
            if "setMove" not in refs and "SetMoveAction" not in refs:
                continue
            machine.explore(method, explored, [OPAQUE] * 4)
        return recorder.moves + recorder.set_move_actions()

    def _method_refs(self, method: Any) -> set[str]:
        names = set()
        for insn in Machine(self.cls).insns(method).values():
            if insn.op in {182, 183, 184, 185}:
                owner, name, _desc = self.cls.methodref(insn.operand)
                names.add(name)
                names.add(owner.rsplit(".", 1)[-1])
        return names

    def turn(self, ascension: int, move_id: int) -> dict[str, Any]:
        this = self._constructed(ascension)
        this.fields["nextMove"] = move_id
        recorder = _Recorder()
        machine = self._machine(ascension, recorder)
        take_turn = self.cls.method("takeTurn", "()V")
        if take_turn and take_turn.code:
            machine.run(take_turn, this)
        return self._summarize(recorder, this, machine)

    def opening(self, ascension: int) -> dict[str, Any]:
        this = self._constructed(ascension)
        recorder = _Recorder()
        machine = self._machine(ascension, recorder)
        method = self.cls.method("usePreBattleAction", "()V")
        if method and method.code:
            machine.run(method, this)
        return self._summarize(recorder, this, machine)

    def _state_animations(self, machine: Machine, this: Obj, state: str) -> list[str]:
        method = self.cls.method("changeState", "(Ljava/lang/String;)V")
        if not method or not method.code:
            return []
        recorder = _Recorder()
        previous = machine.invoke_hook
        machine.invoke_hook = recorder.hook
        try:
            machine.run(method, this, [state])
        finally:
            machine.invoke_hook = previous
        return recorder.animations

    def _summarize(self, recorder: _Recorder, this: Obj, machine: Machine) -> dict[str, Any]:
        hits: list[Any] = []
        block: list[dict[str, Any]] = []
        powers: list[dict[str, Any]] = []
        cards: list[dict[str, Any]] = []
        heal: list[dict[str, Any]] = []
        summons: list[str] = []
        flags: list[str] = []
        triggers: list[dict[str, str]] = [{"type": "spine", "name": name} for name in recorder.animations]

        def target_of(value: Any) -> str:
            if value is this:
                return "self"
            if isinstance(value, Static) and value.owner == ABSTRACT_DUNGEON and value.name == "player":
                return "player"
            return "ally"

        for action in list(recorder.actions):
            name = action.simple_name
            args = action.args or []
            infos = [arg for arg in args if isinstance(arg, Obj) and arg.simple_name == "DamageInfo"]
            if infos and "Damage" in name:
                info = infos[0]
                base = _plain((info.args or [None, None])[1]) if info.args else _plain(info.fields.get("base"))
                hits.append(base)
            elif name == "GainBlockAction" and len(args) >= 3:
                block.append({"target": target_of(args[0]), "amount": _plain(args[2])})
            elif name == "GainBlockRandomMonsterAction" and len(args) >= 2:
                block.append({"target": "ally", "amount": _plain(args[1])})
            elif name == "ApplyPowerAction" and len(args) >= 3 and isinstance(args[2], Obj):
                power = args[2]
                amount = _plain(args[3]) if len(args) > 3 and _plain(args[3]) is not None else None
                if amount is None and power.args and len(power.args) > 1:
                    amount = _plain(power.args[1])
                powers.append({
                    "power": self.class_ids.get(power.cls, power.simple_name),
                    "target": target_of(args[0]),
                    "amount": amount,
                })
            elif name in CARD_PILES:
                card = next((arg for arg in args if isinstance(arg, Obj) and arg.cls.startswith(CARD_PACKAGE)), None)
                if card:
                    after = args[args.index(card) + 1:] if card in args else []
                    count = next((_plain(arg) for arg in after if isinstance(_plain(arg), int)), 1)
                    cards.append({"card": self.class_ids.get(card.cls, card.simple_name), "amount": count, "pile": CARD_PILES[name]})
            elif name == "HealAction" and len(args) >= 3:
                heal.append({"target": target_of(args[0]), "amount": _plain(args[2])})
            elif name == "SpawnMonsterAction" and args and isinstance(args[0], Obj):
                summons.append(self.class_ids.get(args[0].cls, args[0].simple_name))
            elif name in MOTION_ACTIONS:
                triggers.append({"type": "motion", "name": MOTION_ACTIONS[name]})
            elif name == "SetAnimationAction" and len(args) >= 2 and isinstance(args[1], str):
                triggers.append({"type": "spine", "name": args[1]})
            elif name == "ChangeStateAction" and len(args) >= 2 and isinstance(args[1], str):
                for animation in self._state_animations(machine, this, args[1]):
                    triggers.append({"type": "spine", "name": animation})
            elif name == "EscapeAction":
                flags.append("escape")
            elif name == "SuicideAction":
                flags.append("suicide")
        return {
            "hits": hits,
            "block": block,
            "powers": powers,
            "cards": cards,
            "heal": heal,
            "summons": summons,
            "flags": flags,
            "triggers": triggers,
        }


def byte_constant_names(cls: JavaClass) -> dict[int, str]:
    names: dict[int, str] = {}
    for field in cls.fields:
        if field.descriptor == "B" and isinstance(field.const_value, int):
            names.setdefault(field.const_value, field.name)
    return names


def _tiers(snapshots: list[tuple[int, dict[str, Any]]]) -> list[dict[str, Any]]:
    tiers: list[dict[str, Any]] = []
    for ascension, full in snapshots:
        snapshot = {key: value for key, value in full.items() if value not in (None, [], {})}
        if not tiers or {k: v for k, v in tiers[-1].items() if k != "ascension"} != snapshot:
            tiers.append({"ascension": ascension, **snapshot})
    return tiers


def _merge_call(calls: list[dict[str, Any]]) -> dict[str, Any]:
    named = [call for call in calls if call["nameIndex"] is not None]
    first = (named or calls)[0]
    damage = next((call["damage"] for call in calls if call["damage"] is not None), None)
    multiplier = next((call["multiplier"] for call in calls if call["multiplier"] is not None), None)
    intent = next((call["intent"] for call in calls if call["intent"]), None)
    return {"nameIndex": first["nameIndex"], "intent": intent, "damage": damage, "multiplier": multiplier}


def read_monster_moves(jar: Any, class_path: str, *, switch_maps: dict[str, dict[str, int]], class_ids: dict[str, str]) -> dict[str, Any]:
    reader = MonsterReader(jar, class_path, switch_maps=switch_maps, class_ids=class_ids)
    keys = byte_constant_names(reader.cls)
    calls_by_level = {level: reader.move_calls(level) for level in ASCENSION_LEVELS}
    move_ids: list[int] = []
    for calls in calls_by_level.values():
        for call in calls:
            if isinstance(call["id"], int) and call["id"] not in move_ids:
                move_ids.append(call["id"])

    moves = []
    for move_id in move_ids:
        snapshots = []
        name_index = None
        triggers: list[dict[str, str]] = []
        for level in ASCENSION_LEVELS:
            calls = [call for call in calls_by_level[level] if call["id"] == move_id]
            if not calls:
                continue
            call = _merge_call(calls)
            name_index = name_index if name_index is not None else call["nameIndex"]
            turn = reader.turn(level, move_id)
            if not triggers:
                triggers = turn["triggers"]
            snapshots.append((level, {
                "intent": call["intent"],
                "damage": call["damage"],
                "multiplier": call["multiplier"],
                **{key: value for key, value in turn.items() if key != "triggers"},
            }))
        moves.append({
            "id": move_id,
            "key": keys.get(move_id),
            "nameIndex": name_index,
            "triggers": triggers,
            "tiers": _tiers(snapshots),
        })
    starting = _tiers([
        (level, {key: value for key, value in reader.opening(level).items() if key not in {"triggers", "hits"}})
        for level in ASCENSION_LEVELS
    ])
    return {"moves": moves, "startingEffects": starting}


def intent_switch_maps(jar: Any) -> dict[str, dict[str, int]]:
    return switch_maps_from(parse_class_file(jar.read(SWITCH_CLASS)))


def class_ids(jar: Any) -> dict[str, str]:
    """Card, power and monster class names mapped to their game IDs."""
    ids: dict[str, str] = {}
    for name in jar.namelist():
        if not name.endswith(".class") or "$" in name:
            continue
        dotted = name[:-6].replace("/", ".")
        if not dotted.startswith((CARD_PACKAGE, POWER_PACKAGE, MONSTER_PACKAGE)):
            continue
        cls = parse_class_file(jar.read(name))
        for field_name in ("POWER_ID", "ID"):
            value = next((f.const_value for f in cls.fields if f.name == field_name), None)
            if isinstance(value, str):
                ids[dotted] = value
                break
    return ids


def intent_header_indexes(jar: Any, switch_maps: dict[str, dict[str, int]]) -> dict[str, int]:
    """Which `AbstractMonster.TEXT` entry heads each intent's tooltip."""
    cls = parse_class_file(jar.read("com/megacrit/cardcrawl/monsters/AbstractMonster.class"))
    method = cls.method("updateIntentTip", "()V")
    intents = sorted({name for mapping in switch_maps.values() for name in mapping})
    headers: dict[str, int] = {}
    for intent in intents:
        tip = Obj("com.megacrit.cardcrawl.helpers.PowerTip")
        this = Obj(cls.name, fields={"intent": Static(INTENT_ENUM, intent), "intentTip": tip})
        machine = Machine(
            cls,
            switch_maps=switch_maps,
            invoke_hook=lambda _frame, _owner, name, *_rest: NotImplemented if name == "ordinal" else OPAQUE,
        )
        machine.run(method, this)
        header = tip.fields.get("header")
        if isinstance(header, Elem) and header.array == "TEXT":
            headers[intent] = header.index
    return headers
