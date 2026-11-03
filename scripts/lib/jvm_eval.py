"""A small JVM bytecode evaluator for reading game rules out of class files.

It runs real methods with concrete values where the game's own state is known
(ascension level, fields set by constructors) and stands in `OPAQUE` for the
rest (player state, RNG). Branches on opaque values either take the "false"
side (`run`) or fork into both sides (`explore`), which is how a static reader
finds every move a monster can pick.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass, field
from typing import Any, Callable, Iterator

from scripts.lib.java_classfile import JavaClass, MethodInfo


class _Opaque:
    def __repr__(self) -> str:
        return "OPAQUE"


OPAQUE = _Opaque()


class _Ally(_Opaque):
    """An element of an unknown collection (another monster in the room)."""

    def __repr__(self) -> str:
        return "ALLY"


ALLY = _Ally()
VOID = object()


@dataclass(eq=False)
class Obj:
    cls: str
    args: list[Any] | None = None
    fields: dict[str, Any] = field(default_factory=dict)

    @property
    def simple_name(self) -> str:
        return self.cls.rsplit(".", 1)[-1]


@dataclass(eq=False)
class ListObj:
    items: list[Any] = field(default_factory=list)


@dataclass(eq=False)
class IterObj:
    remaining: int = 1


@dataclass(frozen=True)
class Static:
    owner: str
    name: str


@dataclass(frozen=True)
class StaticArray:
    owner: str
    name: str


@dataclass(frozen=True)
class Elem:
    array: str
    index: int


@dataclass(frozen=True)
class Ordinal:
    value: Static


@dataclass(frozen=True)
class SwitchMap:
    owner: str
    name: str


@dataclass(frozen=True)
class Wide:
    value: Any


@dataclass(frozen=True)
class Tainted:
    """A known value that branches must not decide on (explored both ways)."""

    value: Any


def untaint(value: Any) -> Any:
    return value.value if isinstance(value, Tainted) else value


@dataclass(frozen=True)
class Range:
    """An inclusive random roll, e.g. `random(5, 7)`."""

    low: int
    high: int


@dataclass
class Insn:
    offset: int
    op: int
    operand: Any
    next: int


def _signed(value: int) -> int:
    value &= 0xFFFFFFFF
    return value - 0x100000000 if value & 0x80000000 else value


def java_string_hash(value: str) -> int:
    result = 0
    for char in value.encode("utf-16-be").decode("utf-16-be"):
        result = (31 * result + ord(char)) & 0xFFFFFFFF
    return _signed(result)


def parse_descriptor(descriptor: str) -> tuple[list[str], str]:
    args: list[str] = []
    index = 1
    while descriptor[index] != ")":
        start = index
        while descriptor[index] == "[":
            index += 1
        if descriptor[index] == "L":
            index = descriptor.index(";", index)
        index += 1
        args.append(descriptor[start:index])
    return args, descriptor[index + 1:]


def _is_wide_type(kind: str) -> bool:
    return kind in {"J", "D"}


def decode(code: bytes) -> dict[int, Insn]:
    insns: dict[int, Insn] = {}
    index = 0
    size = len(code)
    while index < size:
        start = index
        op = code[index]
        index += 1
        operand: Any = None
        if op in {16, 18, 21, 22, 23, 24, 25, 54, 55, 56, 57, 58, 188}:
            operand = struct.unpack_from(">b" if op == 16 else ">B", code, index)[0]
            index += 1
        elif op == 17:
            operand = struct.unpack_from(">h", code, index)[0]
            index += 2
        elif op in {19, 20, 178, 179, 180, 181, 182, 183, 184, 187, 189, 192, 193}:
            operand = struct.unpack_from(">H", code, index)[0]
            index += 2
        elif op == 132:
            operand = (code[index], struct.unpack_from(">b", code, index + 1)[0])
            index += 2
        elif 153 <= op <= 168 or op in {198, 199}:
            operand = start + struct.unpack_from(">h", code, index)[0]
            index += 2
        elif op in {200, 201}:
            operand = start + struct.unpack_from(">i", code, index)[0]
            index += 4
        elif op in {185, 186}:
            operand = struct.unpack_from(">H", code, index)[0]
            index += 4
        elif op == 197:
            operand = (struct.unpack_from(">H", code, index)[0], code[index + 2])
            index += 3
        elif op == 170:
            index += (4 - index % 4) % 4
            default, low, high = struct.unpack_from(">iii", code, index)
            index += 12
            targets = {}
            for key in range(low, high + 1):
                targets[key] = start + struct.unpack_from(">i", code, index)[0]
                index += 4
            operand = (start + default, targets)
        elif op == 171:
            index += (4 - index % 4) % 4
            default, pairs = struct.unpack_from(">ii", code, index)
            index += 8
            targets = {}
            for _ in range(pairs):
                key, offset = struct.unpack_from(">ii", code, index)
                targets[key] = start + offset
                index += 8
            operand = (start + default, targets)
        elif op == 196:
            wide_op = code[index]
            if wide_op == 132:
                operand = (wide_op, struct.unpack_from(">H", code, index + 1)[0], struct.unpack_from(">h", code, index + 3)[0])
                index += 5
            else:
                operand = (wide_op, struct.unpack_from(">H", code, index + 1)[0])
                index += 3
        insns[start] = Insn(start, op, operand, index)
    return insns


def _num(value: Any) -> Any:
    if isinstance(value, Wide):
        value = value.value
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return value
    return 0


def _known(*values: Any) -> bool:
    return all(isinstance(value.value if isinstance(value, Wide) else value, (int, float)) for value in values)


InvokeHook = Callable[["Frame", str, str, str, Any, list[Any]], Any]


@dataclass
class Frame:
    pc: int
    stack: list[Any]
    local: dict[int, Any]
    this: Obj
    fields: dict[str, Any]
    visits: dict[int, int] = field(default_factory=dict)


class Machine:
    """Runs methods of one class against a shared `this` object."""

    def __init__(
        self,
        cls: JavaClass,
        *,
        statics: dict[tuple[str, str], Any] | None = None,
        switch_maps: dict[str, dict[str, int]] | None = None,
        invoke_hook: InvokeHook | None = None,
        max_steps: int = 20000,
    ):
        self.cls = cls
        self.statics = statics or {}
        self.switch_maps = switch_maps or {}
        self.invoke_hook = invoke_hook
        self.max_steps = max_steps
        self.exploring = False
        self._decoded: dict[int, dict[int, Insn]] = {}

    def insns(self, method: MethodInfo) -> dict[int, Insn]:
        key = id(method)
        if key not in self._decoded:
            self._decoded[key] = decode(method.code or b"")
        return self._decoded[key]

    def own_method(self, name: str, descriptor: str) -> MethodInfo | None:
        method = self.cls.method(name, descriptor)
        return method if method and method.code else None

    # -- running -------------------------------------------------------------

    def run(self, method: MethodInfo, this: Obj, args: list[Any] | None = None, depth: int = 0) -> Any:
        """One path; opaque branches go the "false" way."""
        results = list(self._execute(method, this, args or [], depth, fork=False))
        return results[0] if results else OPAQUE

    def explore(self, method: MethodInfo, this: Obj, args: list[Any] | None = None, max_paths: int = 4000) -> int:
        """Every path; opaque branches fork. Returns how many paths ended."""
        count = 0
        self.exploring = True
        try:
            for _ in self._execute(method, this, args or [], 0, fork=True, max_paths=max_paths):
                count += 1
        finally:
            self.exploring = False
        return count

    def _initial_locals(self, method: MethodInfo, this: Obj, args: list[Any]) -> dict[int, Any]:
        local: dict[int, Any] = {0: this}
        slot = 1
        arg_types, _ret = parse_descriptor(method.descriptor)
        for index, kind in enumerate(arg_types):
            local[slot] = args[index] if index < len(args) else OPAQUE
            slot += 2 if _is_wide_type(kind) else 1
        return local

    def _execute(
        self,
        method: MethodInfo,
        this: Obj,
        args: list[Any],
        depth: int,
        *,
        fork: bool,
        max_paths: int = 1,
    ) -> Iterator[Any]:
        insns = self.insns(method)
        fields = dict(this.fields) if fork else this.fields
        pending = [Frame(0, [], self._initial_locals(method, this, args), this, fields)]
        paths = 0
        steps = 0
        budget = self.max_steps * (20 if fork else 1)
        while pending:
            frame = pending.pop()
            while True:
                steps += 1
                if steps > budget:
                    return
                insn = insns.get(frame.pc)
                if insn is None:
                    break
                insn_offset = insn.offset
                outcome = self._step(frame, insn, depth)
                if outcome is None:
                    continue
                kind, payload = outcome
                if kind == "return":
                    paths += 1
                    yield payload
                    break
                if kind == "branch":
                    taken, fallthrough, decided, underlying, about_ally = payload
                    if decided is None and underlying is not None:
                        # A tainted value forks once per path; a loop that
                        # comes back to the same test follows the real value.
                        seen = frame.visits.get(insn_offset, 0)
                        frame.visits[insn_offset] = seen + 1
                        if not fork or seen:
                            decided = underlying
                    if decided is not None:
                        frame.pc = taken if decided else fallthrough
                        continue
                    if taken <= insn_offset:
                        # Never loop on an unknown.
                        frame.pc = fallthrough
                        continue
                    if not fork:
                        # Code guarded by an ally's state runs once (the
                        # per-ally effect); any other unknown guard skips it.
                        seen = frame.visits.get(insn_offset, 0)
                        frame.visits[insn_offset] = seen + 1
                        frame.pc = fallthrough if about_ally and not seen else taken
                        continue
                    if paths + len(pending) < max_paths:
                        pending.append(Frame(taken, list(frame.stack), dict(frame.local), frame.this, dict(frame.fields), dict(frame.visits)))
                    frame.pc = fallthrough
                    continue
                if kind == "switch":
                    targets, decided = payload
                    if decided is not None:
                        frame.pc = decided
                        continue
                    unique = list(dict.fromkeys(targets))
                    if fork:
                        for target in unique[1:]:
                            if paths + len(pending) < max_paths:
                                pending.append(Frame(target, list(frame.stack), dict(frame.local), frame.this, dict(frame.fields), dict(frame.visits)))
                    frame.pc = unique[0]
                    continue
                if kind == "stop":
                    paths += 1
                    break

    # -- one instruction -----------------------------------------------------

    def _step(self, frame: Frame, insn: Insn, depth: int) -> tuple[str, Any] | None:
        op = insn.op
        stack = frame.stack
        cls = self.cls
        frame.pc = insn.next

        if op == 0:
            return None
        if op == 1:
            stack.append(None)
        elif 2 <= op <= 8:
            stack.append(op - 3)
        elif op in {9, 10}:
            stack.append(Wide(op - 9))
        elif 11 <= op <= 13:
            stack.append(float(op - 11))
        elif op in {14, 15}:
            stack.append(Wide(float(op - 14)))
        elif op in {16, 17}:
            stack.append(insn.operand)
        elif op in {18, 19}:
            value = cls.ldc_value(insn.operand)
            stack.append(value)
        elif op == 20:
            stack.append(Wide(cls.ldc_value(insn.operand)))
        elif 21 <= op <= 25:
            stack.append(frame.local.get(insn.operand, OPAQUE))
        elif 26 <= op <= 45:
            stack.append(frame.local.get((op - 26) % 4, OPAQUE))
        elif 46 <= op <= 53:
            index, array = stack.pop(), stack.pop()
            stack.append(self._array_load(array, index))
        elif 54 <= op <= 58:
            frame.local[insn.operand] = stack.pop()
        elif 59 <= op <= 78:
            frame.local[(op - 59) % 4] = stack.pop()
        elif 79 <= op <= 86:
            del stack[-3:]
        elif op == 87:
            stack.pop()
        elif op == 88:
            top = stack.pop()
            if not isinstance(top, Wide):
                stack.pop()
        elif op == 89:
            stack.append(stack[-1])
        elif op == 90:
            stack.insert(-2, stack[-1])
        elif op == 91:
            stack.insert(-3 if not isinstance(stack[-2], Wide) else -2, stack[-1])
        elif op == 92:
            if isinstance(stack[-1], Wide):
                stack.append(stack[-1])
            else:
                stack.extend(stack[-2:])
        elif op == 93:
            if isinstance(stack[-1], Wide):
                stack.insert(-2, stack[-1])
            else:
                stack[-3:-3] = stack[-2:]
        elif op == 94:
            if isinstance(stack[-1], Wide):
                stack.insert(-3, stack[-1])
            else:
                stack[-4:-4] = stack[-2:]
        elif op == 95:
            stack[-1], stack[-2] = stack[-2], stack[-1]
        elif 96 <= op <= 115:
            right, left = stack.pop(), stack.pop()
            stack.append(self._arith((op - 96) // 4, left, right, wide=(op - 96) % 4 in {1, 3}))
        elif 116 <= op <= 119:
            value = stack.pop()
            stack.append(-_num(value) if _known(value) else OPAQUE)
        elif 120 <= op <= 131:
            right, left = stack.pop(), stack.pop()
            stack.append(self._bits(op, left, right))
        elif op == 132:
            slot, delta = insn.operand
            current = frame.local.get(slot, OPAQUE)
            frame.local[slot] = current + delta if isinstance(current, int) else OPAQUE
        elif 133 <= op <= 147:
            stack.append(self._convert(op, stack.pop()))
        elif 148 <= op <= 152:
            right, left = stack.pop(), stack.pop()
            if _known(left, right):
                a, b = _num(left), _num(right)
                stack.append((a > b) - (a < b))
            else:
                stack.append(OPAQUE)
        elif 153 <= op <= 158:
            value = stack.pop()
            decided = underlying = None
            if _known(value) or value is None:
                number = _num(value)
                decided = [number == 0, number != 0, number < 0, number >= 0, number > 0, number <= 0][op - 153]
            elif isinstance(value, Tainted) and _known(value.value):
                number = _num(value.value)
                underlying = [number == 0, number != 0, number < 0, number >= 0, number > 0, number <= 0][op - 153]
            return "branch", (insn.operand, insn.next, decided, underlying, value is ALLY)
        elif 159 <= op <= 164:
            right, left = stack.pop(), stack.pop()
            decided = underlying = None
            if _known(left, right):
                a, b = _num(left), _num(right)
                decided = [a == b, a != b, a < b, a >= b, a > b, a <= b][op - 159]
            elif _known(untaint(left), untaint(right)):
                a, b = _num(untaint(left)), _num(untaint(right))
                underlying = [a == b, a != b, a < b, a >= b, a > b, a <= b][op - 159]
            return "branch", (insn.operand, insn.next, decided, underlying, left is ALLY or right is ALLY)
        elif op in {165, 166}:
            right, left = stack.pop(), stack.pop()
            if isinstance(left, _Opaque) or isinstance(right, _Opaque):
                decided = None if (isinstance(left, _Opaque) and isinstance(right, _Opaque)) else (op == 166)
            else:
                same = left is right or (isinstance(left, Static) and left == right)
                decided = same if op == 165 else not same
            return "branch", (insn.operand, insn.next, decided, None, False)
        elif op in {167, 200}:
            frame.pc = insn.operand
        elif op in {170, 171}:
            key = stack.pop()
            default, targets = insn.operand
            if isinstance(key, int) and not isinstance(key, bool):
                return "switch", ([], targets.get(key, default))
            return "switch", (list(targets.values()) + [default], None)
        elif 172 <= op <= 176:
            return "return", stack.pop()
        elif op == 177:
            return "return", VOID
        elif op == 178:
            owner, name, desc = cls.fieldref(insn.operand)
            stack.append(self._get_static(owner, name, desc))
        elif op == 179:
            owner, name, _desc = cls.fieldref(insn.operand)
            value = stack.pop()
            # Keep aliases like `NAME_X = MOVES[2]`; other statics stay symbolic.
            if owner == cls.name and isinstance(value, Elem):
                self.statics[(owner, name)] = value
        elif op == 180:
            owner, name, desc = cls.fieldref(insn.operand)
            target = stack.pop()
            if target is frame.this and self.exploring and name not in frame.fields and desc in {"I", "Z", "B", "F", "S"}:
                # Inherited state (hit points, block) is unknown while exploring.
                stack.append(OPAQUE)
            else:
                stack.append(self._get_field(frame.fields if target is frame.this else target, name, desc))
        elif op == 181:
            owner, name, desc = cls.fieldref(insn.operand)
            value, target = stack.pop(), stack.pop()
            if target is frame.this:
                frame.fields[name] = value
            elif isinstance(target, Obj):
                target.fields[name] = value
        elif op in {182, 183, 184, 185}:
            owner, name, desc = cls.methodref(insn.operand)
            arg_types, ret = parse_descriptor(desc)
            args = [stack.pop() for _ in arg_types][::-1]
            target = stack.pop() if op != 184 else None
            result = self._invoke(frame, op, owner, name, desc, target, args, depth)
            if result is not VOID and ret != "V":
                stack.append(Wide(result) if _is_wide_type(ret) and not isinstance(result, Wide) else result)
        elif op == 186:
            _bootstrap, nat = self.cls.cp[insn.operand][1], self.cls.cp[insn.operand][2]
            _name, desc = self._nat(nat)
            arg_types, _ret = parse_descriptor(desc)
            del stack[len(stack) - len(arg_types):]
            stack.append(OPAQUE)
        elif op == 187:
            stack.append(Obj(cls.class_name(insn.operand)))
        elif op in {188, 189}:
            stack.pop()
            stack.append(OPAQUE)
        elif op == 190:
            array = stack.pop()
            stack.append(len(array) if isinstance(array, list) else OPAQUE)
        elif op == 191:
            return "stop", None
        elif op == 192:
            pass
        elif op == 193:
            stack.pop()
            stack.append(OPAQUE)
        elif op in {194, 195}:
            stack.pop()
        elif op == 196:
            wide_op = insn.operand[0]
            if wide_op == 132:
                _op, slot, delta = insn.operand
                current = frame.local.get(slot, OPAQUE)
                frame.local[slot] = current + delta if isinstance(current, int) else OPAQUE
            elif 21 <= wide_op <= 25:
                stack.append(frame.local.get(insn.operand[1], OPAQUE))
            elif 54 <= wide_op <= 58:
                frame.local[insn.operand[1]] = stack.pop()
        elif op == 197:
            _index, dims = insn.operand
            del stack[len(stack) - dims:]
            stack.append(OPAQUE)
        elif op in {198, 199}:
            value = stack.pop()
            decided = None if isinstance(value, _Opaque) else ((value is None) == (op == 198))
            return "branch", (insn.operand, insn.next, decided, None, value is ALLY)
        else:
            return "stop", None
        return None

    def _nat(self, index: int) -> tuple[str, str]:
        entry = self.cls.cp[index]
        return self.cls.utf8(entry[1]), self.cls.utf8(entry[2])

    # -- values ----------------------------------------------------------------

    @staticmethod
    def _arith(kind: int, left: Any, right: Any, wide: bool) -> Any:
        if isinstance(left, Range) or isinstance(right, Range):
            if kind in {0, 1} and (isinstance(left, Range) != isinstance(right, Range)):
                rng, other = (left, right) if isinstance(left, Range) else (right, left)
                other = untaint(other)
                if isinstance(other, int) and not isinstance(other, bool):
                    if kind == 0:
                        return Range(rng.low + other, rng.high + other)
                    if isinstance(left, Range):
                        return Range(rng.low - other, rng.high - other)
            return OPAQUE
        if isinstance(left, Tainted) or isinstance(right, Tainted):
            value = Machine._arith(kind, untaint(left), untaint(right), wide)
            return value if value is OPAQUE or isinstance(value, Wide) and value.value is OPAQUE else Tainted(value)
        if not _known(left, right):
            return Wide(OPAQUE) if wide else OPAQUE
        a, b = _num(left), _num(right)
        try:
            if kind == 0:
                value = a + b
            elif kind == 1:
                value = a - b
            elif kind == 2:
                value = a * b
            elif kind == 3:
                value = int(a / b) if isinstance(a, int) and isinstance(b, int) else a / b
            else:
                value = a - b * int(a / b) if isinstance(a, int) and isinstance(b, int) else a % b
        except ZeroDivisionError:
            value = OPAQUE
        return Wide(value) if wide else value

    @staticmethod
    def _bits(op: int, left: Any, right: Any) -> Any:
        if not (isinstance(_num(left), int) and isinstance(_num(right), int) and _known(left, right)):
            return OPAQUE
        a, b = int(_num(left)), int(_num(right))
        if op in {120, 121}:
            return _signed(a << (b & 31))
        if op in {122, 123, 124, 125}:
            return a >> (b & 31)
        if op in {126, 127}:
            return a & b
        if op in {128, 129}:
            return a | b
        return a ^ b

    @staticmethod
    def _convert(op: int, value: Any) -> Any:
        if not _known(value):
            return Wide(OPAQUE) if op in {133, 135, 138, 140, 141, 143} else OPAQUE
        number = _num(value)
        if op in {133, 140, 143}:  # to long
            return Wide(int(number))
        if op in {135, 138, 141}:  # to double
            return Wide(float(number))
        if op in {134, 137, 144}:  # to float
            return float(number)
        if op in {136, 139, 142}:  # to int
            return int(number)
        if op == 145:  # i2b
            return ((int(number) + 128) & 0xFF) - 128
        if op == 146:  # i2c
            return int(number) & 0xFFFF
        return ((int(number) + 0x8000) & 0xFFFF) - 0x8000

    def _array_load(self, array: Any, index: Any) -> Any:
        if isinstance(array, StaticArray) and isinstance(index, int):
            return Elem(array.name, index)
        if isinstance(array, SwitchMap) and isinstance(index, Ordinal):
            value = self.switch_maps.get(array.name, {}).get(index.value.name)
            return value if value is not None else 0
        if isinstance(array, list) and isinstance(index, int) and 0 <= index < len(array):
            return array[index]
        return OPAQUE

    def _get_static(self, owner: str, name: str, desc: str) -> Any:
        if (owner, name) in self.statics:
            return self.statics[(owner, name)]
        if "$SwitchMap$" in name:
            return SwitchMap(owner, name)
        if desc.startswith("["):
            return StaticArray(owner, name)
        return Static(owner, name)

    @staticmethod
    def _get_field(target: Any, name: str, desc: str) -> Any:
        if target is ALLY:
            return ALLY
        if isinstance(target, (Obj, dict)):
            fields = target if isinstance(target, dict) else target.fields
            if name in fields:
                return fields[name]
            if desc in {"I", "B", "S", "C", "Z"}:
                return 0
            if desc == "F":
                return 0.0
            if desc in {"J", "D"}:
                return Wide(0)
            return None
        return OPAQUE

    def _invoke(
        self,
        frame: Frame,
        op: int,
        owner: str,
        name: str,
        desc: str,
        target: Any,
        args: list[Any],
        depth: int,
    ) -> Any:
        if self.invoke_hook:
            hooked = self.invoke_hook(frame, owner, name, desc, target, args)
            if hooked is not NotImplemented:
                return hooked
        if name == "<init>":
            if isinstance(target, Obj):
                if target is frame.this and owner == self.cls.name and depth < 4:
                    method = self.own_method(name, desc)
                    if method:
                        self.run(method, frame.this, args, depth + 1)
                elif target.cls == owner and target.args is None:
                    target.args = args
            return VOID
        if isinstance(target, ListObj):
            if name == "add" and len(args) == 1:
                target.items.append(args[0])
                return 1
            if name == "get" and args and isinstance(args[0], int):
                return target.items[args[0]] if 0 <= args[0] < len(target.items) else OPAQUE
            if name == "size":
                return len(target.items)
            if name == "iterator":
                return IterObj(remaining=len(target.items))
            return OPAQUE
        if name == "iterator" and not args:
            # An unknown collection: one element when running, two while
            # exploring so "more than one ally" branches are reachable.
            return IterObj(remaining=2 if self.exploring else 1)
        if isinstance(target, IterObj):
            if name == "hasNext":
                return 1 if target.remaining > 0 else 0
            if name == "next":
                target.remaining -= 1
                return ALLY
            return OPAQUE
        if target is ALLY:
            return ALLY
        if isinstance(target, str):
            if name == "hashCode":
                return java_string_hash(target)
            if name == "equals" and args:
                return 1 if isinstance(args[0], str) and args[0] == target else (OPAQUE if args[0] is OPAQUE else 0)
            return OPAQUE
        if name == "ordinal" and isinstance(target, Static):
            return Ordinal(target)
        if target is frame.this and op in {182, 183} and depth < 4 and owner == self.cls.name:
            method = self.own_method(name, desc)
            if method:
                result = self.run(method, frame.this, args, depth + 1)
                if result is VOID:
                    return OPAQUE
                # While exploring, helper results must not prune branches.
                return Tainted(result) if self.exploring and not isinstance(result, Tainted) else result
        return OPAQUE


def switch_maps_from(cls: JavaClass) -> dict[str, dict[str, int]]:
    """Reads `$SwitchMap$...[Enum.X.ordinal()] = n` from a synthetic class's <clinit>."""
    maps: dict[str, dict[str, int]] = {}
    method = cls.method("<clinit>")
    if not method or not method.code:
        return maps
    insns = decode(method.code)
    current: str | None = None
    constant: str | None = None
    for offset in sorted(insns):
        insn = insns[offset]
        if insn.op == 178:
            _owner, name, desc = cls.fieldref(insn.operand)
            if "$SwitchMap$" in name:
                current = name
            elif desc.startswith("L"):
                constant = name
        elif insn.op in {4, 5, 6, 7, 8, 16, 17} and current and constant:
            value = insn.op - 3 if insn.op <= 8 else insn.operand
            maps.setdefault(current, {})[constant] = value
            constant = None
    return maps
