#!/usr/bin/env python3
"""Extract the Vexing Puzzlebox music and sound effects from the FMOD banks in the local PCK.

Each output mixes the FSB5 samples an FMOD event layers together (layer1 + layer2 ...),
picked by sample name, and encodes AAC like the STS1 sounds.

Needs `vgmstream-cli` and `ffmpeg` on PATH (brew install vgmstream ffmpeg).

Outputs public/audio/sts2/*.m4a.
"""

from __future__ import annotations

import argparse
import struct
import subprocess
import tempfile
from pathlib import Path

from scripts.lib.pck import PCKReader, default_pck_path

OUTPUT_ROOT = Path("public/audio/sts2")

# Output name -> (sample names layered by the FMOD event, AAC bitrate).
SOUNDS: dict[str, tuple[tuple[str, ...], str]] = {
    # event:/music/... merchant room, Overgrowth.
    "merchant_act1": (("STS2_Merchant_Act1_v2",), "96k"),
    # event:/sfx/ui/clicks/ui_click
    "ui_click_1": (("sts2_sfx_ui_click_layer1_rr1_v1_unm", "sts2_sfx_ui_click_layer2_rr1_v1_unm"), "96k"),
    "ui_click_2": (("sts2_sfx_ui_click_layer1_rr2_v1_unm", "sts2_sfx_ui_click_layer2_rr2_v1_unm"), "96k"),
    # event:/sfx/ui/clicks/ui_back
    "ui_back": (("sts2_sfx_ui_back_layer1_rr1_v1", "sts2_sfx_ui_back_layer2_rr1_v1"), "96k"),
    # event:/sfx/ui/clicks/ui_checkbox_on / _off (NTickbox)
    "checkbox_on": (("sts2_sfx_ui_settings_check_on_v2",), "96k"),
    "checkbox_off": (("sts2_sfx_ui_settings_check_off_v1",), "96k"),
    # Card movement slides and stacks.
    "card_slide_1": (("sts2_sfx_cardmvmt_slide_v1_rr1",), "96k"),
    "card_slide_2": (("sts2_sfx_cardmvmt_slide_v1_rr2",), "96k"),
    "card_slide_3": (("sts2_sfx_cardmvmt_slide_v1_rr3",), "96k"),
    "card_stack": (("sts2_sfx_cardmvmt_stack_v1_rr1",), "96k"),
    # event:/sfx/ui/gold/gold_1, played when gold is spent.
    "gold_few": (
        (
            "sts2_sfx_gold_few_layer1_rr1_v1",
            "sts2_sfx_gold_few_layer2_rr1_v1",
            "sts2_sfx_gold_few_layer3_rr1_v1",
        ),
        "96k",
    ),
    # event:/sfx/npcs/merchant/* (NMerchantInventory, NMerchantSlot)
    "merchant_thank_you_1": (("sts2_sfx_VO_merchant_thank_yous_v1_rr1",), "96k"),
    "merchant_thank_you_2": (("sts2_sfx_VO_merchant_thank_yous_v1_rr2",), "96k"),
    "merchant_thank_you_3": (("sts2_sfx_VO_merchant_thank_yous_v1_rr3",), "96k"),
    "merchant_disappointment_1": (("sts2_sfx_VO_merchant_dissapointment_v1_rr1",), "96k"),
    "merchant_disappointment_2": (("sts2_sfx_VO_merchant_dissapointment_v1_rr2",), "96k"),
    "merchant_disappointment_3": (("sts2_sfx_VO_merchant_dissapointment_v1_rr3",), "96k"),
    "merchant_welcome_1": (("sts2_sfx_VO_merchant_welcome_v1_rr1",), "96k"),
    "merchant_welcome_2": (("sts2_sfx_VO_merchant_welcome_v1_rr2",), "96k"),
    "merchant_laugh_1": (("sts2_sfx_VO_merchant_laughter_v1_rr1",), "96k"),
    "merchant_laugh_2": (("sts2_sfx_VO_merchant_laughter_v1_rr2",), "96k"),
    # event:/sfx/ui/treasure/treasure_act1
    "treasure": (("sts2_sfx_ui_treasure_a1_v4",), "96k"),
    # A thrown Potion-Shaped Rock lands: the rock bowlbug's rock attack over the base hit impact.
    "rock_hit": (("STS2_SFX_E-A2_WorkerBug-Rock-Attack_v1", "STS2_SFX_HitImpact_Base_Medium_1_v1"), "96k"),
    # A wrong quiz answer costs a life: the heavy base hit impact the player takes damage with.
    "life_lost": (("STS2_SFX_HitImpact_Base_Heavy_1_v1",), "96k"),
    # A discarded Potion-Shaped Rock drops.
    "rock_drop": (("sts1_sfx_DropRelic_Rocky",), "96k"),
}


def fsb_sample_names(bank: bytes) -> list[str]:
    """Sample names of every FSB5 block in an FMOD bank, in vgmstream subsong order."""
    names: list[str] = []
    position = 0
    while (start := bank.find(b"FSB5", position)) >= 0:
        version, count, header_size, _name_size, _data_size, _mode = struct.unpack_from("<6I", bank, start + 4)
        name_table = start + (0x3C if version == 1 else 0x40) + header_size
        for offset in struct.unpack_from(f"<{count}I", bank, name_table):
            name_start = name_table + offset
            names.append(bank[name_start:bank.index(b"\0", name_start)].decode())
        position = start + 4
    return names


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", type=Path, default=default_pck_path())
    parser.add_argument("--only", help="Comma-separated output names to rebuild; default all.")
    args = parser.parse_args()
    only = set(args.only.split(",")) if args.only else None

    pck = PCKReader(args.pck)
    with tempfile.TemporaryDirectory() as temp:
        work = Path(temp)
        samples: dict[str, tuple[Path, int]] = {}
        for entry in pck.entries:
            if not entry.startswith("banks/desktop/") or entry.endswith(".strings.bank"):
                continue
            bank_path = work / Path(entry).name
            data = pck.read_file(entry)
            bank_path.write_bytes(data)
            for index, name in enumerate(fsb_sample_names(data), start=1):
                samples.setdefault(name, (bank_path, index))

        OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
        for output, (names, bitrate) in SOUNDS.items():
            if only and output not in only:
                continue
            layers = []
            for name in names:
                if name not in samples:
                    raise SystemExit(f"No FSB sample named {name}")
                bank_path, index = samples[name]
                wav = work / f"{name}.wav"
                subprocess.run(
                    ["vgmstream-cli", "-i", "-s", str(index), "-o", str(wav), str(bank_path)],
                    check=True,
                    capture_output=True,
                )
                layers.append(wav)
            dest = OUTPUT_ROOT / f"{output}.m4a"
            command = ["ffmpeg", "-y", "-loglevel", "error"]
            for layer in layers:
                command += ["-i", str(layer)]
            if len(layers) > 1:
                command += ["-filter_complex", f"amix=inputs={len(layers)}:normalize=0"]
            command += ["-c:a", "aac", "-b:a", bitrate, str(dest)]
            subprocess.run(command, check=True)
            print(f"{dest} {dest.stat().st_size // 1024} KiB")


if __name__ == "__main__":
    main()
