#!/usr/bin/env python3
"""Extract the Blitz merchant room for the dev node simulator from a STS2 PCK.

- Entry icons: `images/packed/blitz/entry_<type>.png` (the inventory slot) and
  `images/packed/blitz/small_tokens/entry_<type>.png` (the merchant's tray).
- Spine: the merchant (`animations/backgrounds/blitz_merchant_room/top`), the
  merchant hand (`animations/backgrounds/merchant_room/hand`) and each
  character's merchant pose (`scenes/merchant/characters/<c>_merchant.tscn`:
  the character skeleton with its `<c>_shop` atlas).
- Localization (kor, eng): every `MERCHANT.blitz*` line of merchant_room.json,
  the enchantments the entries name, REPLAY_DYNAMIC, RETAIN and the
  characters' short titles.
- Layout read from the scenes: blitz_merchant_room.tscn (background container,
  merchant button, character container), blitz_merchant_button.tscn
  (MerchantVisual), merchant_inventory.tscn (rug, six slot offsets, selection
  text, merchant hand), blitz_merchant_entry.tscn (hitbox, icon, shadow),
  hover_tip.tscn (margins, fonts) and back_button.tscn.

Writes public/images/sts2/blitz-merchant/**, public/spine/sts2/blitz-merchant/**
and data/sts2/blitz-merchant.json.

  python3 scripts/extract-blitz-merchant-assets.py --archive-version 0.113.0
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

from PIL import Image  # noqa: E402

from scripts.lib.pck import PCKReader, default_pck_path  # noqa: E402

# extract-sts2-spine-assets.py has a dash in its name: load it by path for its import helpers.
import importlib.util  # noqa: E402

_spec = importlib.util.spec_from_file_location("spine_assets", ROOT / "scripts/extract-sts2-spine-assets.py")
spine_assets = importlib.util.module_from_spec(_spec)
sys.modules["spine_assets"] = spine_assets
_spec.loader.exec_module(spine_assets)  # type: ignore[union-attr]

IMG_ROOT = ROOT / "public/images/sts2/blitz-merchant"
SPINE_ROOT = ROOT / "public/spine/sts2/blitz-merchant"
MANIFEST = ROOT / "data/sts2/blitz-merchant.json"

# BlitzMerchantEntryType, in enum order (the order the game draws from).
ENTRY_TYPES = [
    "CardUpgrade", "UpgradedCardReward", "RandomUpgrades", "CardTransform", "CardRemoval",
    "CardRewards", "ColorlessCardReward", "Potions", "CardEnchant", "EnchantedCardReward",
    "PrismaticCardReward", "RareCardReward", "UpgradedRareCard", "Relic", "Glam",
    "TwoMoreChoices", "CardRewardOfEachRarity", "UpgradedRareCardReward", "TwoRelics", "FullHealAndMaxHp",
]
# BlitzRunModel.shopEnchantmentOptions and BlitzMerchantGlamEntry.
ENCHANTMENTS = ["SHARP", "NIMBLE", "ADROIT", "STEADY", "SWIFT", "VIGOROUS", "GLAM"]
CHARACTERS = ["IRONCLAD", "SILENT", "DEFECT", "REGENT", "NECROBINDER", "FOOL"]
LANGS = ["kor", "eng"]


def snake(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pck", help="Path to Slay the Spire 2.pck (default: the Steam install)")
    parser.add_argument("--archive-version", help="Read ~/sts2-builds/<version>/.../Slay the Spire 2.pck instead")
    return parser.parse_args()


def pck_path(args: argparse.Namespace) -> str:
    if args.pck:
        return args.pck
    if args.archive_version:
        return str(Path.home() / "sts2-builds" / args.archive_version / "SlayTheSpire2.app/Contents/Resources/Slay the Spire 2.pck")
    return default_pck_path()


def nodes(text: str) -> dict[str, dict[str, str]]:
    """`[node name=... parent=...]` blocks keyed by their path from the root ("." is the root)."""
    out: dict[str, dict[str, str]] = {}
    for block in re.split(r"\n(?=\[)", text):
        head = re.match(r'\[node name="([^"]+)"(?: type="[^"]+")?(?: parent="([^"]+)")?', block)
        if not head:
            continue
        name, parent = head.group(1), head.group(2)
        key = "." if parent is None else (name if parent == "." else f"{parent}/{name}")
        props = dict(re.findall(r"^(\w[\w/]*) = (.+)$", block, re.M))
        out[key] = props
    return out


def vec(value: str) -> list[float]:
    """`Vector2(1, 2)`, `Color(...)`, `Rect2(...)` -> the numbers inside the parentheses."""
    inner = value[value.index("(") + 1 : value.rindex(")")] if "(" in value else value
    return [float(part) for part in re.findall(r"-?[0-9.]+(?:e-?\d+)?", inner)]


def num(props: dict[str, str], key: str, default: float = 0.0) -> float:
    return float(props[key]) if key in props else default


def offsets(props: dict[str, str]) -> dict[str, float]:
    return {side: num(props, f"offset_{side}") for side in ("left", "top", "right", "bottom")}


def ext_paths(text: str) -> dict[str, str]:
    return {m.group(2): m.group(1) for m in re.finditer(r'\[ext_resource[^\]]*path="res://([^"]+)"[^\]]*id="([^"]+)"', text)}


def clear_edge_strips(image: Image.Image) -> Image.Image:
    """Make edge pixels transparent where the pixel one step inward is (nearly) transparent.

    entry_full_heal_and_max_hp.png has an opaque 1 px white column at x=799 beside a clear or
    faint-glow (alpha <= 16) column, likely packing bleed: hidden on the rug, a line on a dark stage.
    """
    image = image.convert("RGBA")
    px = image.load()
    w, h = image.size
    edges = [((0, y), (1, y)) for y in range(h)] + [((w - 1, y), (w - 2, y)) for y in range(h)]
    edges += [((x, 0), (x, 1)) for x in range(w)] + [((x, h - 1), (x, h - 2)) for x in range(w)]
    for edge, inner in edges:
        if px[edge][3] and px[inner][3] < 32:
            px[edge] = (0, 0, 0, 0)
    return image


def write_texture(reader: PCKReader, res_path: str, out: Path) -> str:
    spine_assets.extract_png_import(reader, f"{res_path}.import", out)
    if out.is_relative_to(IMG_ROOT):
        # Plain images ship as WebP; Spine pages keep the PNG names their atlas names.
        webp = out.with_suffix(".webp")
        image = Image.open(out)
        # Only the entry icons: other images have soft art edges this rule would eat.
        (clear_edge_strips(image) if out.parent.name == "entries" else image).save(webp, "WEBP", quality=92, method=6)
        out.unlink()
        out = webp
    return "/" + str(out.relative_to(ROOT / "public"))


def write_binary(reader: PCKReader, res_path: str, out: Path) -> str:
    spine_assets.extract_binary_import(reader, f"{res_path}.import", out)
    return "/" + str(out.relative_to(ROOT / "public"))


def write_spine(reader: PCKReader, skel_data_res: str, folder: Path, reuse_skel: Path | None = None) -> dict:
    """A SpineSkeletonDataResource: its atlas pages and skeleton binary."""
    text = reader.read_file(skel_data_res).decode()
    paths = ext_paths(text)
    atlas_res = next(p for p in paths.values() if p.endswith(".atlas"))
    skel_res = next(p for p in paths.values() if p.endswith(".skel"))
    atlas_out = folder / Path(atlas_res).name
    atlas_url = write_binary(reader, atlas_res, atlas_out)
    textures = []
    for page in spine_assets.atlas_page_names(atlas_out):
        textures.append(write_texture(reader, str(Path(atlas_res).parent / page), folder / page))
    skel_out = folder / Path(skel_res).name
    write_binary(reader, skel_res, skel_out)
    # The character skeletons are already shipped for combat; keep one copy when the bytes match.
    if reuse_skel and reuse_skel.exists() and hashlib.md5(reuse_skel.read_bytes()).digest() == hashlib.md5(skel_out.read_bytes()).digest():
        skel_out.unlink()
        skel_out = reuse_skel
    mixes = [
        {"from": a, "to": b, "mix": float(m)}
        for a, b, m in re.findall(r'from = "([^"]+)"\nto = "([^"]+)"\nmix = ([0-9.]+)', text)
    ]
    default_mix = re.search(r"default_mix = ([0-9.]+)", text)
    return {
        "atlasUrl": atlas_url,
        "binaryUrl": "/" + str(skel_out.relative_to(ROOT / "public")),
        "textureUrls": textures,
        "defaultMix": float(default_mix.group(1)) if default_mix else 0.0,
        "mixes": mixes,
    }


def main() -> int:
    args = parse_args()
    reader = PCKReader(pck_path(args))
    read = lambda path: reader.read_file(path).decode()  # noqa: E731

    entries = []
    for entry_type in ENTRY_TYPES:
        name = snake(entry_type)
        icon = write_texture(reader, f"images/packed/blitz/entry_{name}.png", IMG_ROOT / f"entries/entry_{name}.png")
        token = write_texture(reader, f"images/packed/blitz/small_tokens/entry_{name}.png", IMG_ROOT / f"small_tokens/entry_{name}.png")
        entries.append({"type": entry_type, "key": name, "iconUrl": icon, "tokenUrl": token})

    loc: dict[str, dict] = {}
    for lang in LANGS:
        merchant = reader.read_json(f"localization/{lang}/merchant_room.json")
        enchant = reader.read_json(f"localization/{lang}/enchantments.json")
        static = reader.read_json(f"localization/{lang}/static_hover_tips.json")
        keywords = reader.read_json(f"localization/{lang}/card_keywords.json")
        characters = reader.read_json(f"localization/{lang}/characters.json")
        loc[lang] = {
            "merchant": {k: v for k, v in merchant.items() if k.startswith("MERCHANT.blitz") or k.startswith("MERCHANT.talk.blitz")},
            "enchantments": {e: {"title": enchant[f"{e}.title"], "description": enchant[f"{e}.description"]} for e in ENCHANTMENTS},
            "static": {"REPLAY_DYNAMIC": {"title": static["REPLAY_DYNAMIC.title"], "description": static["REPLAY_DYNAMIC.description"]}},
            "keywords": {"RETAIN": {"title": keywords["RETAIN.title"], "description": keywords["RETAIN.description"]}},
            "characters": {c: characters[f"{c}.shortTitle"] for c in CHARACTERS},
        }

    enchant_icons = {}
    for e in ENCHANTMENTS:
        enchant_icons[e] = write_texture(reader, f"images/enchantments/{e.lower()}.png", IMG_ROOT / f"enchantments/{e.lower()}.png")

    room = nodes(read("scenes/rooms/blitz_merchant_room.tscn"))
    button_text = read("scenes/rooms/blitz_merchant_button.tscn")
    button = nodes(button_text)
    inventory = nodes(read("scenes/merchant/merchant_inventory.tscn"))
    slot = nodes(read("scenes/merchant/blitz_merchant_entry.tscn"))
    tip = nodes(read("scenes/ui/hover_tip.tscn"))
    back = nodes(read("scenes/ui/back_button.tscn"))

    spine = {
        "merchant": write_spine(reader, "animations/backgrounds/blitz_merchant_room/top/blitz_merchant_top_skel_data.tres", SPINE_ROOT / "merchant"),
        "hand": write_spine(reader, "animations/backgrounds/merchant_room/hand/merchant_hand_skel_data.tres", SPINE_ROOT / "hand"),
        "characters": {},
    }
    for character in CHARACTERS:
        scene_path = f"scenes/merchant/characters/{character.lower()}_merchant.tscn"
        if scene_path not in reader.entries:
            continue
        scene_text = read(scene_path)
        sprite = nodes(scene_text)["SpineSprite"]
        skel_data = ext_paths(scene_text)[re.search(r'ExtResource\("([^"]+)"\)', sprite["skeleton_data_res"]).group(1)]
        c = character.lower()
        asset = write_spine(reader, skel_data, SPINE_ROOT / "characters" / c, ROOT / f"public/spine/sts2/characters/{c}/{c}.skel")
        asset["position"] = vec(sprite.get("position", "Vector2(0, 0)"))
        asset["scale"] = vec(sprite.get("scale", "Vector2(1, 1)"))
        spine["characters"][character] = asset

    merchant_button = room["SceneContainer/MerchantButton"]
    visual = button["MerchantVisual"]
    tokens = []
    for i in range(1, 7):
        holder = button[f"MerchantVisual/Token_{i}"]
        tokens.append({"slot": holder["slot_name"].strip('"'), "editorPosition": vec(holder["position"])})
    blitz_slots = [[num(inventory[f"SlotsContainer/BlitzSlots/MerchantBlitzEntry{suffix}"], side) for side in ("offset_left", "offset_top")]
                   for suffix in ["", "2", "3", "4", "5", "6"]]
    selection = inventory["SlotsContainer/BlitzSelectionText"]
    hand = inventory["MerchantHandContainer"]
    back_root = back["."]
    layout = {
        "screen": [1920, 1080],
        "room": {
            "bgContainer": {"offset": [num(room["SceneContainer/BgContainer"], "offset_left"), num(room["SceneContainer/BgContainer"], "offset_top")],
                            "scale": vec(room["SceneContainer/BgContainer"]["scale"])},
            # combat background layers (scenes/backgrounds/*/layers/*_bg_*_a.tscn): a centered TextureRect of 2764.8x1296.
            "bgLayerSize": [2764.8, 1296],
            "characterContainer": [num(room["SceneContainer/CharacterContainer"], "offset_left"), num(room["SceneContainer/CharacterContainer"], "offset_top")],
            "merchantButton": offsets(merchant_button),
            "merchantVisual": {"position": vec(visual["position"]), "scale": vec(visual["scale"]),
                               "skin": visual["preview_skin"].strip('"'), "animation": "animation"},
            "tokens": tokens,
        },
        "inventory": {
            "backstopAlpha": 0.8,
            "rug": {**offsets(inventory["SlotsContainer"]), "openY": 80, "closedY": -1000},
            "rugUrl": write_texture(reader, "images/rooms/merchant_room/shop_rug.png", IMG_ROOT / "shop_rug.png"),
            "slots": blitz_slots,
            "selectionText": {
                "anchor": [num(selection, "anchor_left"), num(selection, "anchor_top")],
                **offsets(selection),
                "fontSize": int(selection["MinFontSize"]),
                "outlineSize": int(selection["theme_override_constants/outline_size"]),
                "color": vec(selection["theme_override_colors/default_color"]),
                "outlineColor": vec(selection["theme_override_colors/font_outline_color"]),
            },
            "hand": {"position": vec(hand["position"]), "scale": vec(hand["scale"])},
            "backButton": offsets(back_root),
        },
        "slot": {
            "hitbox": offsets(slot["Hitbox"]),
            "shadow": {"offset": [num(slot["Hitbox/Icon/Shadow"], "offset_left"), num(slot["Hitbox/Icon/Shadow"], "offset_top")],
                       "modulate": vec(slot["Hitbox/Icon/Shadow"]["modulate"])},
        },
        "hoverTip": {
            "width": 360,
            "spacing": 5,
            "margin": {side: int(tip["TextContainer"][f"theme_override_constants/margin_{side}"]) for side in ("left", "top", "right", "bottom")},
            "outerMargin": {side: int(tip["."][f"theme_override_constants/margin_{side}"]) for side in ("right", "bottom")},
            "shadowRegionOffset": vec(tip["Shadow"]["region_rect"])[:2],
            "shadowModulate": vec(tip["Shadow"]["modulate"]),
            "titleFontSize": int(tip["TextContainer/VBoxContainer/HBoxContainer/Title"]["theme_override_font_sizes/font_size"]),
            "titleColor": vec(tip["TextContainer/VBoxContainer/HBoxContainer/Title"]["theme_override_colors/font_color"]),
            "descriptionFontSize": int(tip["TextContainer/VBoxContainer/Description"]["theme_override_font_sizes/normal_font_size"]),
            "descriptionColor": vec(tip["TextContainer/VBoxContainer/Description"]["theme_override_colors/default_color"]),
            "lineSeparation": int(tip["TextContainer/VBoxContainer/Description"]["theme_override_constants/line_separation"]),
            "textShadow": [int(tip["TextContainer/VBoxContainer/Description"]["theme_override_constants/shadow_offset_x"]),
                           int(tip["TextContainer/VBoxContainer/Description"]["theme_override_constants/shadow_offset_y"])],
            "titleIconGap": int(tip["TextContainer/VBoxContainer/HBoxContainer"]["theme_override_constants/separation"]),
        },
    }
    if "fire_base_blitz_merchant" not in button_text:
        print("warning: blitz_merchant_button.tscn no longer names its fire texture", file=sys.stderr)

    manifest = {
        "source": Path(pck_path(args)).as_posix().replace(str(Path.home()), "~"),
        "archiveVersion": args.archive_version,
        "entries": entries,
        "enchantIcons": enchant_icons,
        "spine": spine,
        "layout": layout,
        "loc": loc,
    }
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {MANIFEST.relative_to(ROOT)}, {len(entries)} entries, {len(spine['characters'])} merchant characters")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
