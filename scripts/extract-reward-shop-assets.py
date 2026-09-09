#!/usr/bin/env python3
"""Extract STS2 combat-reward, card-pick, and merchant-shop UI from the local PCK.

Outputs:
  public/images/sts2/ui/reward-screen/
    reward_panel.webp, reward_banner.webp, reward_item_button.webp,
    reward_skip_button.webp, reward_icon_*.webp, proceed_button.webp
  public/images/sts2/ui/merchant/
    shop_rug.webp, shop_sales_tag.webp, card_removal_00.webp, card_removal_05.webp
  public/images/sts2/vfx/glow_card_{rare,uncommon}.webp
  public/images/sts2/ui/combat/combat_reticle.webp

Sources:
  images/ui/reward_screen/*.png.import
  images/atlases/ui_atlas.sprites/proceed_button.tres
  images/rooms/merchant_room/*.png.import

reward_item_button HSV matches scenes/rewards/reward_button.tscn (h=1, s=1, v=0.8).
"""

from __future__ import annotations

import argparse
import importlib.util
from pathlib import Path

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path

_confirm_path = Path(__file__).resolve().parent / "extract-confirm-popup-assets.py"
_spec = importlib.util.spec_from_file_location("extract_confirm_popup_assets", _confirm_path)
assert _spec and _spec.loader
_confirm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_confirm)
apply_hsv = _confirm.apply_hsv
ATLAS_PATH_RE = _confirm.ATLAS_PATH_RE
ATLAS_REGION_RE = _confirm.ATLAS_REGION_RE

REWARD_IMPORTS = {
    "reward_panel": "images/ui/reward_screen/reward_panel.png.import",
    "reward_banner": "images/ui/reward_screen/reward_banner.png.import",
    "reward_item_button": "images/ui/reward_screen/reward_item_button.png.import",
    "reward_skip_button": "images/ui/reward_screen/reward_skip_button.png.import",
    "reward_icon_card": "images/ui/reward_screen/reward_icon_card.png.import",
    "reward_icon_card_removal": "images/ui/reward_screen/reward_icon_card_removal.png.import",
    "reward_icon_money": "images/ui/reward_screen/reward_icon_money.png.import",
    "reward_icon_rare": "images/ui/reward_screen/reward_icon_rare.png.import",
    "reward_icon_shared_relic": "images/ui/reward_screen/reward_icon_shared_relic.png.import",
    "reward_icon_special_card": "images/ui/reward_screen/reward_icon_special_card.png.import",
    "reward_icon_uncommon": "images/ui/reward_screen/reward_icon_uncommon.png.import",
}

MERCHANT_IMPORTS = {
    "shop_rug": "images/rooms/merchant_room/shop_rug.png.import",
    "shop_sales_tag": "images/rooms/merchant_room/shop_sales_tag.png.import",
    "card_removal_00": "images/rooms/merchant_room/card_removal_00.png.import",
    "card_removal_05": "images/rooms/merchant_room/card_removal_05.png.import",
}

CARD_GLOW_IMPORTS = {
    "glow_card_rare": "images/packed/vfx/generic/glow_card_rare.png.import",
    "glow_card_uncommon": "images/packed/vfx/generic/glow_card_uncommon.png.import",
}

RETICLE_IMPORT = "images/ui/combat/combat_reticle.png.import"

PROCEED_TRES = "images/atlases/ui_atlas.sprites/proceed_button.tres"

# scenes/rewards/reward_button.tscn ShaderMaterial
ITEM_BUTTON_HSV = (1.0, 1.0, 0.8)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path())
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def open_import_image(reader: PCKReader, import_path: str):
    ctex_path = parse_import_file(reader.read_file(import_path))
    if not ctex_path:
        raise ValueError(f"Could not resolve .ctex path from {import_path}")
    image = ctex_to_image(reader.read_file(ctex_path))
    if image is None:
        raise ValueError(f"Could not decode {ctex_path}")
    return image.convert("RGBA")


def crop_atlas_sprite(reader: PCKReader, tres_path: str):
    text = reader.read_file(tres_path).decode("utf-8", errors="replace")
    atlas_match = ATLAS_PATH_RE.search(text)
    region_match = ATLAS_REGION_RE.search(text)
    if not atlas_match or not region_match:
        raise ValueError(f"Could not parse atlas sprite {tres_path}")
    atlas_import_path = f"{atlas_match.group(1)}.import"
    atlas_image = open_import_image(reader, atlas_import_path)
    x, y, width, height = [int(float(part.strip())) for part in region_match.group(1).split(",")]
    return atlas_image.crop((x, y, x + width, y + height)).convert("RGBA")


def write_webp(path: Path, image, *, dry_run: bool, force: bool) -> bool:
    if path.exists() and not force and not dry_run:
        print(f"skip {path}")
        return False
    if dry_run:
        print(f"would write {path} ({image.size[0]}x{image.size[1]})")
        return True
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="WEBP", quality=90, method=6)
    print(f"wrote {path} ({image.size[0]}x{image.size[1]})")
    return True


def main() -> None:
    args = parse_args()
    reward_root = Path("public/images/sts2/ui/reward-screen")
    merchant_root = Path("public/images/sts2/ui/merchant")
    written = 0

    with PCKReader(args.pck) as reader:
        for name, import_path in REWARD_IMPORTS.items():
            image = open_import_image(reader, import_path)
            if name == "reward_item_button":
                image = apply_hsv(image, *ITEM_BUTTON_HSV)
            if write_webp(
                reward_root / f"{name}.webp",
                image,
                dry_run=args.dry_run,
                force=args.force,
            ):
                written += 1

        proceed = crop_atlas_sprite(reader, PROCEED_TRES)
        if write_webp(
            reward_root / "proceed_button.webp",
            proceed,
            dry_run=args.dry_run,
            force=args.force,
        ):
            written += 1

        for name, import_path in MERCHANT_IMPORTS.items():
            image = open_import_image(reader, import_path)
            if write_webp(
                merchant_root / f"{name}.webp",
                image,
                dry_run=args.dry_run,
                force=args.force,
            ):
                written += 1

        glow_root = Path("public/images/sts2/vfx")
        for name, import_path in CARD_GLOW_IMPORTS.items():
            image = open_import_image(reader, import_path)
            if write_webp(
                glow_root / f"{name}.webp",
                image,
                dry_run=args.dry_run,
                force=args.force,
            ):
                written += 1

        reticle = open_import_image(reader, RETICLE_IMPORT)
        if write_webp(
            Path("public/images/sts2/ui/combat/combat_reticle.webp"),
            reticle,
            dry_run=args.dry_run,
            force=args.force,
        ):
            written += 1

    print(f"done: {written} files")


if __name__ == "__main__":
    main()
