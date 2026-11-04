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
    Sym,
    SymRef,
    Tainted,
    Wide,
    parse_descriptor,
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
VFX_PACKAGE = "com.megacrit.cardcrawl.vfx."
SETTINGS = "com.megacrit.cardcrawl.core.Settings"
COLOR = "com.badlogic.gdx.graphics.Color"
MATH_UTILS = "com.badlogic.gdx.math.MathUtils"
EFFECT_LISTS = {"effectList", "effectsQueue", "topLevelEffects"}
# Dialog and floating text are not replayed on the site.
TEXT_EFFECTS = {"SpeechBubble", "MegaSpeechBubble", "SpeechTextEffect", "TextAboveCreatureEffect"}
# Actions whose first update flashes `FlashAtkImgEffect(target.hb.cX, target.hb.cY, attackEffect)`.
FLASH_ACTIONS = {"DamageAction", "LoseHPAction", "VampireDamageAction", "ApplyPowerAction"}
ACTION_DURATIONS = {
    (SETTINGS, "ACTION_DUR_XFAST"): 0.1,
    (SETTINGS, "ACTION_DUR_FASTER"): 0.2,
    (SETTINGS, "ACTION_DUR_FAST"): 0.25,
    (SETTINGS, "ACTION_DUR_MED"): 0.5,
    (SETTINGS, "ACTION_DUR_LONG"): 1.0,
    (SETTINGS, "ACTION_DUR_XLONG"): 1.5,
    (SETTINGS, "FAST_MODE"): 0,
    (SETTINGS, "scale"): 1.0,
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
        if name == "<init>" and owner == ABSTRACT_MONSTER and target is frame.this:
            target.fields["__monster"] = list(args)
            return VOID
        if name == "loadAnimation" and target is frame.this:
            target.fields["__loadAnimation"] = list(args)
            return VOID
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


class _VfxRecorder(_Recorder):
    """Also keeps the action queue in the game's order, direct effect adds and symbolic rolls."""

    def __init__(self) -> None:
        super().__init__()
        self.queue: list[Obj] = []
        self.immediate: list[tuple[str, Obj]] = []
        self.rolls = 0

    def _roll(self, low: Any, high: Any, integer: bool) -> Any:
        low, high = untaint(low), untaint(high)
        if not all(isinstance(value, (int, float)) and not isinstance(value, bool) for value in (low, high)):
            return OPAQUE
        if low == high:
            return low
        self.rolls += 1
        return Sym(0.0, ((f"{'randi' if integer else 'rand'}{self.rolls}:{low}:{high}", 1.0),))

    def hook(self, frame: Frame, owner: str, name: str, desc: str, target: Any, args: list[Any]) -> Any:
        if name == "<init>" and isinstance(target, Obj) and owner == target.cls and target is not frame.this:
            target.fields["__desc"] = desc
            return NotImplemented
        if name in {"addToBottom", "addToBot"} and args and isinstance(args[-1], Obj):
            self.queue.append(args[-1])
            return VOID
        if name == "addToTop" and args and isinstance(args[-1], Obj):
            self.queue.insert(0, args[-1])
            return VOID
        if name == "add" and isinstance(target, Static) and target.owner == ABSTRACT_DUNGEON and target.name in EFFECT_LISTS:
            if args and isinstance(args[0], Obj):
                self.immediate.append((target.name, args[0]))
            return 1
        if owner == MATH_UTILS and name == "random":
            if desc == "()F":
                return self._roll(0.0, 1.0, False)
            if desc == "(F)F":
                return self._roll(0.0, args[0], False)
            if desc == "(FF)F":
                return self._roll(args[0], args[1], False)
            if desc == "(I)I":
                return self._roll(0, args[0], True)
            if desc == "(II)I":
                return self._roll(args[0], args[1], True)
        if name == "cpy" and (isinstance(target, Static) and target.owner == COLOR or isinstance(target, Obj) and target.cls == COLOR):
            return target
        if name == "valueOf" and owner == COLOR and args and isinstance(args[0], str):
            return Obj(COLOR, args=[args[0]])
        return super().hook(frame, owner, name, desc, target, args)


def _encode_vfx_arg(value: Any, kind: str, this: Obj, unknown: list[str]) -> Any:
    value = untaint(value.value if isinstance(value, Wide) else value)
    if kind == "Z":
        return bool(value) if isinstance(value, (int, bool)) else None
    if isinstance(value, Range):
        value = Sym(0.0, ((f"randi0:{value.low}:{value.high}", 1.0),))
    if isinstance(value, Sym):
        if not value.terms:
            return round(value.const, 4)
        return {"c": round(value.const, 4), "t": {name: round(coeff, 4) for name, coeff in value.terms}}
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return round(float(value), 4) if isinstance(value, float) else value
    if isinstance(value, str):
        return value
    if value is this or value == SymRef("m"):
        return {"creature": "monster"}
    if value == SymRef("p"):
        return {"creature": "player"}
    if value == SymRef("m.hb"):
        return {"hitbox": "monster"}
    if value == SymRef("p.hb"):
        return {"hitbox": "player"}
    if isinstance(value, Static) and value.owner == COLOR:
        return {"color": value.name}
    if isinstance(value, Static) and value.owner == SETTINGS and value.name.endswith("_COLOR"):
        return {"color": f"Settings.{value.name}"}
    if isinstance(value, Obj) and value.cls == COLOR and value.args:
        plain = [untaint(arg) for arg in value.args]
        if len(plain) == 1 and isinstance(plain[0], str):
            return {"color": plain[0] if plain[0].startswith("#") else f"#{plain[0]}"}
        if len(plain) == 1 and isinstance(plain[0], int):
            return {"color": plain[0]}
        if len(plain) == 4 and all(isinstance(arg, (int, float)) for arg in plain):
            return {"color": [round(float(arg), 4) for arg in plain]}
    if isinstance(value, Static) and "$" in value.owner:
        return {"enum": value.name}
    if value is None:
        return None
    unknown.append(repr(value)[:80])
    return None


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

    def body(self) -> dict[str, Any]:
        """Hitbox, offset and skeleton scale from the constructor's `super(...)` and `loadAnimation(...)`."""
        this = self._constructed(0)
        args = [_plain(arg) for arg in this.fields.get("__monster", [])]
        body: dict[str, Any] = {}
        if len(args) >= 7 and all(isinstance(arg, (int, float)) for arg in args[3:7]):
            body["hitbox"] = args[3:7]
        if len(args) >= 10 and all(isinstance(arg, (int, float)) for arg in args[8:10]):
            body["offset"] = args[8:10]
        if len(args) >= 8 and isinstance(args[7], str):
            body["image"] = args[7]
        load = this.fields.get("__loadAnimation")
        if load and len(load) >= 3 and isinstance(_plain(load[2]), (int, float)) and _plain(load[2]) != 1:
            body["skeletonScale"] = _plain(load[2])
        return body

    def _action_duration(self, action: Obj) -> float:
        """How long the action holds the queue: its constructor's `duration` if `update()` ticks it down."""
        key = (action.cls, action.fields.get("__desc"))
        cache = self.__dict__.setdefault("_durations", {})
        if key in cache:
            return cache[key]
        duration = 0.0
        if action.simple_name in {"VFXAction", "WaitAction"} or action.cls.startswith("com.megacrit.cardcrawl.actions."):
            try:
                cls = parse_class_file(self.jar.read(action.cls.replace(".", "/") + ".class"))
            except KeyError:
                cls = None
            update = cls.method("update", "()V") if cls else None
            ticks = bool(update and update.code and "tickDuration" in self._method_names(cls, update))
            constructor = cls.method("<init>", action.fields.get("__desc")) if cls and action.fields.get("__desc") else None
            if ticks and constructor and constructor.code:
                this = Obj(cls.name)
                Machine(cls, statics=dict(ACTION_DURATIONS), invoke_hook=lambda *_args: NotImplemented).run(constructor, this, list(action.args or []))
                value = _plain(this.fields.get("duration"))
                duration = float(value) if isinstance(value, (int, float)) else 0.0
        cache[key] = duration
        return duration

    @staticmethod
    def _method_names(cls: JavaClass, method: Any) -> set[str]:
        names = set()
        for insn in Machine(cls).insns(method).values():
            if insn.op in {182, 183, 184, 185}:
                names.add(cls.methodref(insn.operand)[1])
        return names

    def vfx_turn(self, move_id: int) -> tuple[list[dict[str, Any]], list[str]]:
        """`takeTurn` for one move as a timeline: when each clip, motion, state change, flash and effect starts."""
        this = self._constructed(0)
        this.fields.update({
            "nextMove": move_id,
            "hb": SymRef("m.hb"),
            "drawX": Sym.of("m.drawX"),
            "drawY": Sym.of("m.drawY"),
            "animX": Sym.of("m.animX"),
            "animY": Sym.of("m.animY"),
        })
        recorder = _VfxRecorder()
        machine = Machine(
            self.cls,
            statics={
                **self._static_aliases(),
                **ACTION_DURATIONS,
                (ABSTRACT_DUNGEON, "ascensionLevel"): 0,
                (SETTINGS, "xScale"): 1.0,
                (SETTINGS, "yScale"): 1.0,
                (SETTINGS, "renderScale"): 1.0,
                (SETTINGS, "WIDTH"): Sym.of("screen.w"),
                (SETTINGS, "HEIGHT"): Sym.of("screen.h"),
                (ABSTRACT_DUNGEON, "floorY"): Sym.of("floorY"),
                (ABSTRACT_DUNGEON, "player"): SymRef("p"),
            },
            switch_maps=self.switch_maps,
            invoke_hook=recorder.hook,
        )
        take_turn = self.cls.method("takeTurn", "()V")
        if take_turn and take_turn.code:
            machine.run(take_turn, this)
        unknown: list[str] = []

        def creature(value: Any) -> str | None:
            if value is this or value == SymRef("m"):
                return "m"
            if value == SymRef("p"):
                return "p"
            return None

        def effect_event(at: float, effect: Obj, list_name: str) -> dict[str, Any]:
            desc = effect.fields.get("__desc") or ""
            kinds = parse_descriptor(desc)[0] if desc else []
            event = {
                "at": round(at, 3),
                "type": "effect",
                "effect": effect.cls.removeprefix(VFX_PACKAGE),
                "args": [_encode_vfx_arg(arg, kinds[index] if index < len(kinds) else "", this, unknown)
                         for index, arg in enumerate(effect.args or [])],
            }
            if list_name == "topLevelEffects":
                event["list"] = "top"
            return event

        def flash(at: float, target: Any, attack: str) -> dict[str, Any] | None:
            ref = creature(target)
            if not ref or attack == "NONE":
                return None
            return {
                "at": round(at, 3),
                "type": "effect",
                "effect": "combat.FlashAtkImgEffect",
                "args": [{"c": 0, "t": {f"{ref}.hb.cX": 1}}, {"c": 0, "t": {f"{ref}.hb.cY": 1}}, {"enum": attack}],
            }

        events: list[dict[str, Any]] = [
            effect_event(0.0, effect, name) for name, effect in recorder.immediate if effect.simple_name not in TEXT_EFFECTS
        ]
        at = 0.0
        for action in recorder.queue:
            name = action.simple_name
            args = action.args or []
            if name == "VFXAction":
                effect = next((arg for arg in args if isinstance(arg, Obj) and arg.cls.startswith(VFX_PACKAGE)), None)
                if effect and effect.simple_name not in TEXT_EFFECTS:
                    top = len(args) == 4 and _plain(args[3]) == 1
                    events.append(effect_event(at, effect, "topLevelEffects" if top else "effectList"))
            elif name in FLASH_ACTIONS:
                attack = next((arg.name for arg in args if isinstance(arg, Static) and arg.owner.endswith("$AttackEffect")), "NONE")
                event = flash(at, args[0] if args else None, attack)
                if event:
                    events.append(event)
            elif name == "GainBlockAction" and args:
                event = flash(at, args[0], "SHIELD")
                if event:
                    events.append(event)
            elif name in MOTION_ACTIONS:
                events.append({"at": round(at, 3), "type": "motion", "name": MOTION_ACTIONS[name]})
            elif name == "SetAnimationAction" and len(args) >= 2 and isinstance(args[1], str):
                events.append({"at": round(at, 3), "type": "spine", "name": args[1]})
            elif name == "ChangeStateAction" and len(args) >= 2 and isinstance(args[1], str):
                events.append({"at": round(at, 3), "type": "state", "name": args[1]})
                for animation in self._state_animations(machine, this, args[1]):
                    events.append({"at": round(at, 3), "type": "spine", "name": animation})
            elif name == "ShakeScreenAction" and len(args) >= 3:
                dur, intensity = args[1], args[2]
                if isinstance(dur, Static) and isinstance(intensity, Static):
                    events.append({"at": round(at, 3), "type": "shake", "intensity": intensity.name, "dur": dur.name})
            at += self._action_duration(action)
        return events, unknown

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


def read_monster_vfx(jar: Any, class_path: str, move_ids: list[int], *, switch_maps: dict[str, dict[str, int]], class_ids: dict[str, str]) -> dict[str, Any]:
    """Body (hitbox, offset, skeleton scale) and each move's playback timeline."""
    reader = MonsterReader(jar, class_path, switch_maps=switch_maps, class_ids=class_ids)
    timelines: dict[str, list[dict[str, Any]]] = {}
    unknown: list[str] = []
    for move_id in move_ids:
        events, missing = reader.vfx_turn(move_id)
        unknown += missing
        if events:
            timelines[str(move_id)] = events
    return {**reader.body(), "moves": timelines, "unknown": unknown}


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
