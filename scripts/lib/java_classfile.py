"""Minimal JVM class-file reader for STS1 constructor/metadata extraction."""

from __future__ import annotations

import struct
from dataclasses import dataclass, field
from typing import Any


UTF8 = 1
INTEGER = 3
FLOAT = 4
LONG = 5
DOUBLE = 6
CLASS = 7
STRING = 8
FIELDREF = 9
METHODREF = 10
INTERFACE_METHODREF = 11
NAME_AND_TYPE = 12
METHOD_HANDLE = 15
METHOD_TYPE = 16
DYNAMIC = 17
INVOKE_DYNAMIC = 18
MODULE = 19
PACKAGE = 20


@dataclass
class MethodInfo:
    name: str
    descriptor: str
    code: bytes | None
    max_stack: int = 0
    max_locals: int = 0


@dataclass
class FieldInfo:
    name: str
    descriptor: str
    const_value: Any = None


@dataclass
class JavaClass:
    name: str
    super_name: str | None
    cp: list[Any]
    methods: list[MethodInfo] = field(default_factory=list)
    fields: list[FieldInfo] = field(default_factory=list)

    def method(self, name: str, descriptor: str | None = None) -> MethodInfo | None:
        for method in self.methods:
            if method.name != name:
                continue
            if descriptor is None or method.descriptor == descriptor:
                return method
        return None


class ClassFileReader:
    def __init__(self, data: bytes):
        self.data = data
        self.offset = 0

    def u1(self) -> int:
        value = self.data[self.offset]
        self.offset += 1
        return value

    def u2(self) -> int:
        value = struct.unpack_from(">H", self.data, self.offset)[0]
        self.offset += 2
        return value

    def u4(self) -> int:
        value = struct.unpack_from(">I", self.data, self.offset)[0]
        self.offset += 4
        return value

    def bytes(self, n: int) -> bytes:
        value = self.data[self.offset : self.offset + n]
        self.offset += n
        return value


def parse_class_file(data: bytes) -> JavaClass:
    reader = ClassFileReader(data)
    magic = reader.u4()
    if magic != 0xCAFEBABE:
        raise ValueError("not a Java class file")
    reader.u2()
    reader.u2()
    cp_count = reader.u2()
    cp: list[Any] = [None]
    i = 1
    while i < cp_count:
        tag = reader.u1()
        if tag == UTF8:
            length = reader.u2()
            cp.append(("utf8", reader.bytes(length).decode("utf-8", "replace")))
        elif tag == INTEGER:
            cp.append(("int", struct.unpack(">i", reader.bytes(4))[0]))
        elif tag == FLOAT:
            cp.append(("float", struct.unpack(">f", reader.bytes(4))[0]))
        elif tag == LONG:
            cp.append(("long", struct.unpack(">q", reader.bytes(8))[0]))
            cp.append(None)
            i += 2
            continue
        elif tag == DOUBLE:
            cp.append(("double", struct.unpack(">d", reader.bytes(8))[0]))
            cp.append(None)
            i += 2
            continue
        elif tag == CLASS:
            cp.append(("class", reader.u2()))
        elif tag == STRING:
            cp.append(("string", reader.u2()))
        elif tag == FIELDREF:
            cp.append(("fieldref", reader.u2(), reader.u2()))
        elif tag == METHODREF or tag == INTERFACE_METHODREF:
            cp.append(("methodref", reader.u2(), reader.u2()))
        elif tag == NAME_AND_TYPE:
            cp.append(("nat", reader.u2(), reader.u2()))
        elif tag == METHOD_HANDLE:
            cp.append(("mh", reader.u1(), reader.u2()))
        elif tag == METHOD_TYPE:
            cp.append(("mt", reader.u2()))
        elif tag == DYNAMIC or tag == INVOKE_DYNAMIC:
            cp.append(("dyn", reader.u2(), reader.u2()))
        elif tag == MODULE or tag == PACKAGE:
            cp.append(("mod", reader.u2()))
        else:
            raise ValueError(f"unknown cp tag {tag}")
        i += 1

    def utf8(index: int) -> str:
        entry = cp[index]
        return entry[1] if entry and entry[0] == "utf8" else ""

    def class_name(index: int) -> str:
        entry = cp[index]
        if not entry or entry[0] != "class":
            return ""
        return utf8(entry[1]).replace("/", ".")

    def nat(index: int) -> tuple[str, str]:
        entry = cp[index]
        if not entry or entry[0] != "nat":
            return ("", "")
        return utf8(entry[1]), utf8(entry[2])

    def fieldref(index: int) -> tuple[str, str, str]:
        entry = cp[index]
        owner = class_name(entry[1])
        name, desc = nat(entry[2])
        return owner, name, desc

    def methodref(index: int) -> tuple[str, str, str]:
        entry = cp[index]
        owner = class_name(entry[1])
        name, desc = nat(entry[2])
        return owner, name, desc

    def ldc_value(index: int) -> Any:
        entry = cp[index]
        if not entry:
            return None
        kind = entry[0]
        if kind in {"int", "float", "long", "double", "utf8"}:
            return entry[1]
        if kind == "string":
            return utf8(entry[1])
        if kind == "class":
            return class_name(index)
        return None

    reader.u2()  # access
    this_class = class_name(reader.u2())
    super_index = reader.u2()
    super_name = class_name(super_index) if super_index else None
    iface_count = reader.u2()
    reader.offset += iface_count * 2

    fields: list[FieldInfo] = []
    field_count = reader.u2()
    for _ in range(field_count):
        reader.u2()
        name = utf8(reader.u2())
        descriptor = utf8(reader.u2())
        attr_count = reader.u2()
        const_value = None
        for _ in range(attr_count):
            attr_name = utf8(reader.u2())
            length = reader.u4()
            body = reader.bytes(length)
            if attr_name == "ConstantValue" and length == 2:
                const_value = ldc_value(struct.unpack(">H", body)[0])
        fields.append(FieldInfo(name, descriptor, const_value))

    methods: list[MethodInfo] = []
    method_count = reader.u2()
    for _ in range(method_count):
        reader.u2()
        name = utf8(reader.u2())
        descriptor = utf8(reader.u2())
        attr_count = reader.u2()
        code = None
        max_stack = 0
        max_locals = 0
        for _ in range(attr_count):
            attr_name = utf8(reader.u2())
            length = reader.u4()
            body = reader.bytes(length)
            if attr_name == "Code":
                max_stack, max_locals, code_len = struct.unpack(">HHI", body[:8])
                code = body[8 : 8 + code_len]
        methods.append(MethodInfo(name, descriptor, code, max_stack, max_locals))

    java_class = JavaClass(this_class, super_name, cp, methods, fields)
    java_class.utf8 = utf8  # type: ignore[attr-defined]
    java_class.class_name = class_name  # type: ignore[attr-defined]
    java_class.fieldref = fieldref  # type: ignore[attr-defined]
    java_class.methodref = methodref  # type: ignore[attr-defined]
    java_class.ldc_value = ldc_value  # type: ignore[attr-defined]
    return java_class


# Operand widths for JVM opcodes that are not 0-arg, tableswitch, lookupswitch, or wide.
_OP_LEN_1 = {
    16,  # bipush
    18,  # ldc
    21, 22, 23, 24, 25,  # xload
    54, 55, 56, 57, 58,  # xstore
    169,  # ret
    188,  # newarray
}
_OP_LEN_2 = {
    17,  # sipush
    19, 20,  # ldc_w, ldc2_w
    132,  # iinc
    *range(153, 169),  # if* / goto / jsr
    178, 179, 180, 181, 182, 183, 184,  # field/method
    187, 189, 192, 193,  # new / anewarray / checkcast / instanceof
    198, 199,  # ifnull / ifnonnull
}
_OP_LEN_3 = {197}  # multianewarray
_OP_LEN_4 = {185, 186, 200, 201}  # invokeinterface, invokedynamic, goto_w, jsr_w


def iter_opcodes(code: bytes):
    i = 0
    n = len(code)
    while i < n:
        op = code[i]
        start = i
        i += 1
        if op in {170, 171}:  # tableswitch / lookupswitch
            padding = (4 - (i % 4)) % 4
            i += padding
            if op == 170:
                default, low, high = struct.unpack_from(">iii", code, i)
                i += 12 + 4 * (high - low + 1)
            else:
                default, npairs = struct.unpack_from(">ii", code, i)
                i += 8 + 8 * npairs
            yield start, op, b""
        elif op == 196:  # wide
            wide_op = code[i]
            i += 1
            extra = 4 if wide_op == 132 else 2
            yield start, op, bytes([wide_op]) + code[i : i + extra]
            i += extra
        elif op in _OP_LEN_1:
            yield start, op, code[i : i + 1]
            i += 1
        elif op in _OP_LEN_2:
            yield start, op, code[i : i + 2]
            i += 2
        elif op in _OP_LEN_3:
            yield start, op, code[i : i + 3]
            i += 3
        elif op in _OP_LEN_4:
            yield start, op, code[i : i + 4]
            i += 4
        else:
            yield start, op, b""


def u2_from(arg: bytes) -> int:
    return struct.unpack(">H", arg)[0]


def s1_from(arg: bytes) -> int:
    return struct.unpack(">b", arg)[0]


def s2_from(arg: bytes) -> int:
    return struct.unpack(">h", arg)[0]


def descriptor_arg_count(descriptor: str) -> int:
    if not descriptor.startswith("("):
        return 0
    i = 1
    count = 0
    while i < len(descriptor) and descriptor[i] != ")":
        if descriptor[i] == "[":
            while i < len(descriptor) and descriptor[i] == "[":
                i += 1
            if i < len(descriptor) and descriptor[i] == "L":
                i = descriptor.index(";", i) + 1
            else:
                i += 1
            count += 1
            continue
        if descriptor[i] == "L":
            i = descriptor.index(";", i) + 1
            count += 1
            continue
        i += 1
        count += 1
    return count
